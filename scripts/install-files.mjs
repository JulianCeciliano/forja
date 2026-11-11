#!/usr/bin/env node
// Copia la capa Forja a un proyecto de forma idempotente (sin tocar el CLI de Claude).
//   node install-files.mjs <proyecto> [--dry] [--boost-hook-only]
//   --boost-hook-only: solo añade `@php artisan boost:update --ansi` a post-update-cmd de composer.json (opt-in).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const project = path.resolve(args.find((a) => !a.startsWith('--')) || process.cwd());
const dry = args.includes('--dry');
const log = (s) => console.log(`   ${dry ? '[dry-run] ' : ''}${s}`);

if (!fs.existsSync(project)) {
  console.error(`install-files: no existe ${project}`);
  process.exit(1);
}

const put = (dest, content, label) => {
  log(label);
  if (dry) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
};
const read = (...p) => fs.readFileSync(path.join(src, ...p), 'utf8');
const rel = (p) => path.relative(project, p);
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// Fusiona solo las claves que faltan (recursivo en objetos); nunca toca valores existentes.
export function mergeMissing(current, tpl, prefix = '', added = []) {
  const out = { ...current };
  for (const [k, v] of Object.entries(tpl)) {
    if (!(k in out)) {
      out[k] = v;
      added.push(prefix + k);
    } else if (isObj(out[k]) && isObj(v)) {
      out[k] = mergeMissing(out[k], v, `${prefix}${k}.`, added).merged;
    }
  }
  return { merged: out, added };
}

// 0) Opt-in: boost:update en post-update-cmd de composer.json.
if (args.includes('--boost-hook-only')) {
  const cj = path.join(project, 'composer.json');
  if (!fs.existsSync(cj)) {
    console.error('install-files: no hay composer.json.');
    process.exit(1);
  }
  const cmd = '@php artisan boost:update --ansi';
  try {
    const j = JSON.parse(fs.readFileSync(cj, 'utf8'));
    j.scripts = j.scripts || {};
    const cur = j.scripts['post-update-cmd'];
    const list = cur === undefined ? [] : Array.isArray(cur) ? cur : [cur];
    if (list.includes(cmd)) log('composer.json ya tiene boost:update en post-update-cmd');
    else {
      j.scripts['post-update-cmd'] = [...list, cmd];
      put(cj, `${JSON.stringify(j, null, 4)}\n`, 'composer.json (+boost:update en post-update-cmd)');
    }
  } catch {
    console.error('install-files: composer.json no es JSON válido; no se modifica.');
    process.exit(1);
  }
  process.exit(0);
}

// 1) .forja/: CLI, lib, plantillas y config (la config del usuario no se pisa).
const forja = path.join(project, '.forja');
put(path.join(forja, 'forja.mjs'), read('scripts', 'forja.mjs'), `${rel(path.join(forja, 'forja.mjs'))} (actualizado)`);
put(path.join(forja, 'lib.mjs'), read('hooks', 'lib.mjs'), `${rel(path.join(forja, 'lib.mjs'))} (actualizado)`);

// Plantillas: todo lo que haya en templates/ salvo lo que tiene destino propio.
const SPECIAL = new Set(['CLAUDE.md', 'settings.json', 'forja.config.json']);
const tplDir = path.join(src, 'templates');
for (const t of fs.readdirSync(tplDir).sort()) {
  if (SPECIAL.has(t) || !fs.statSync(path.join(tplDir, t)).isFile()) continue;
  put(path.join(forja, 'templates', t), read('templates', t), `.forja/templates/${t}`);
}

// Config: se crea si falta; si existe, solo se añaden claves nuevas (los valores del usuario mandan).
const cfg = path.join(forja, 'config.json');
const cfgTpl = JSON.parse(read('templates', 'forja.config.json'));
if (!fs.existsSync(cfg)) {
  put(cfg, `${JSON.stringify(cfgTpl, null, 2)}\n`, '.forja/config.json');
} else {
  try {
    const { merged, added } = mergeMissing(JSON.parse(fs.readFileSync(cfg, 'utf8')), cfgTpl);
    if (added.length) put(cfg, `${JSON.stringify(merged, null, 2)}\n`, `.forja/config.json (+claves nuevas: ${added.join(', ')}; valores tuyos intactos)`);
    else log('.forja/config.json al día (se conserva)');
  } catch {
    console.error('install-files: .forja/config.json no es JSON válido; no se modifica.');
  }
}

// 2) .claude/settings.json: unión de permissions.deny/allow y env (sin sobrescribir lo del usuario).
const settingsPath = path.join(project, '.claude', 'settings.json');
let current = {};
if (fs.existsSync(settingsPath)) {
  try {
    current = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {
    console.error('install-files: .claude/settings.json no es JSON válido; no se modifica.');
    current = null;
  }
}
if (current !== null) {
  const tpl = JSON.parse(read('templates', 'settings.json'));
  // Reglas que versiones anteriores de Forja instalaron y que ya no se recomiendan.
  // (0.3.0: leer node_modules es útil al depurar tipos de una librería.)
  const legacyDeny = new Set(['Read(./node_modules/**)']);
  // allow de borradores previos que escribían (pint sin --test), descargaban (npx) o ejecutaban sin acotar.
  const legacyAllow = new Set(['Bash(vendor/bin/pint *)', 'Bash(vendor/bin/pest *)', 'Bash(npx tsc --noEmit *)', 'Bash(node_modules/.bin/tsc --noEmit *)', 'Bash(node_modules/.bin/vitest run *)']);
  const union = (a = [], b = []) => [...new Set([...a, ...b])];
  const merged = { ...current };
  merged.permissions = { ...(current.permissions || {}) };
  merged.permissions.deny = union((current.permissions?.deny || []).filter((r) => !legacyDeny.has(r)), tpl.permissions.deny);
  merged.permissions.allow = union((current.permissions?.allow || []).filter((r) => !legacyAllow.has(r)), tpl.permissions.allow);
  merged.env = { ...tpl.env, ...(current.env || {}) };
  put(settingsPath, `${JSON.stringify(merged, null, 2)}\n`, '.claude/settings.json (deny de secretos, allow acotado de lectura/test, MAX_MCP_OUTPUT_TOKENS)');
}

// 3) CLAUDE.md: bloque entre marcadores (se actualiza sin duplicar).
const claudeMd = path.join(project, 'CLAUDE.md');
const block = read('templates', 'CLAUDE.md').trim();
const BLOCK_RE = /<!-- forja:start -->[\s\S]*?<!-- forja:end -->/;
if (!fs.existsSync(claudeMd)) {
  put(claudeMd, `${block}\n`, 'CLAUDE.md (nuevo)');
} else {
  const text = fs.readFileSync(claudeMd, 'utf8');
  if (BLOCK_RE.test(text)) put(claudeMd, text.replace(BLOCK_RE, () => block), 'CLAUDE.md (bloque Forja actualizado)');
  else put(claudeMd, `${text.replace(/\s*$/, '')}\n\n${block}\n`, 'CLAUDE.md (bloque Forja añadido al final)');
}

// 4) docs/specs, docs/system y .gitignore
for (const d of ['specs', 'system']) {
  const keep = path.join(project, 'docs', d, '.gitkeep');
  if (!fs.existsSync(keep)) put(keep, '', `docs/${d}/.gitkeep`);
}

const giPath = path.join(project, '.gitignore');
const wanted = ['.forja/state.json', '.forja/state.json.tmp', '.forja/metrics.jsonl', '.forja/tmp/', 'CLAUDE.local.md'];
const gi = fs.existsSync(giPath) ? fs.readFileSync(giPath, 'utf8') : '';
const missing = wanted.filter((w) => !gi.split('\n').includes(w));
if (missing.length) {
  put(giPath, `${gi.replace(/\s*$/, '')}${gi ? '\n\n' : ''}# Forja\n${missing.join('\n')}\n`, `.gitignore (+${missing.length} entradas)`);
}

console.log(dry ? '   (dry-run: no se escribió nada)' : '   Capa Forja instalada en el proyecto.');
