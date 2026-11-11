import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INSTALL_FILES = path.join(ROOT, 'scripts/install-files.mjs');
const INSTALL_SH = path.join(ROOT, 'install.sh');

const tmp = (files = {}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forja-inst-'));
  for (const [f, c] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), c);
  }
  return dir;
};
// Carpeta con ejecutables falsos ({nombre: cuerpo de shell}) para anteponer al PATH.
const fakeBin = (defs) => {
  const dir = tmp();
  for (const [name, body] of Object.entries(defs)) {
    fs.writeFileSync(path.join(dir, name), ['#!/bin/sh', body, ''].join(String.fromCharCode(10)));
    fs.chmodSync(path.join(dir, name), 0o755);
  }
  return dir;
};
const files = (dir, ...args) => spawnSync('node', [INSTALL_FILES, dir, ...args], { encoding: 'utf8' });
const sh = (dir, ...args) => spawnSync('bash', [INSTALL_SH, ...args], { cwd: dir, encoding: 'utf8' });
const json = (dir, f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));

test('install.sh --full --dry-run lista los comandos verificados y no escribe', () => {
  const dir = tmp({ artisan: '' });
  const r = sh(dir, '--full', '--dry-run');
  assert.equal(r.status, 0, r.stderr);
  const out = r.stdout;
  for (const cmd of [
    'composer require laravel/boost --dev',
    'php artisan boost:install',
    'claude mcp add --scope project --transport http context7 https://mcp.context7.com/mcp',
    'claude mcp add --scope project chrome-devtools -- npx -y chrome-devtools-mcp@latest',
    'npm install -g @playwright/cli@latest',
    'playwright-cli install --skills',
    'npm install -g intelephense',
    'npm install -g typescript-language-server typescript',
    'claude plugin install php-lsp@claude-plugins-official --scope user',
    'claude plugin install typescript-lsp@claude-plugins-official --scope user',
    'claude plugin install frontend-design@claude-plugins-official --scope project',
  ]) assert.ok(out.includes(cmd), `falta: ${cmd}`);
  assert.ok(!/superpowers|caveman|graphify/.test(out.replace(/Superpowers/g, '')), '--full no incluye superpowers, caveman ni graphify');
  assert.deepEqual(fs.readdirSync(dir), ['artisan'], 'dry-run no escribe nada');
});

test('install.sh: superpowers solo con --with-superpowers; --no-superpowers es no-op con aviso', () => {
  const dir = tmp({ artisan: '' });
  const base = sh(dir, '--dry-run');
  assert.equal(base.status, 0, base.stderr);
  assert.ok(!base.stdout.includes('superpowers@'), 'no se instala por defecto');
  const on = sh(dir, '--with-superpowers', '--dry-run');
  assert.ok(on.stdout.includes('claude plugin install superpowers@claude-plugins-official --scope project'));
  const legacy = sh(dir, '--no-superpowers', '--dry-run');
  assert.equal(legacy.status, 0);
  assert.match(legacy.stderr, /obsoleto/);
  assert.ok(!legacy.stdout.includes('superpowers@'));
});

test('install.sh: caveman, graphify y playwright-mcp son opt-in', () => {
  const dir = tmp({ artisan: '' });
  const base = sh(dir, '--dry-run').stdout;
  for (const s of ['caveman@caveman', 'graphify', '@playwright/mcp', 'chrome-devtools-mcp', 'php-lsp']) assert.ok(!base.includes(s), `${s} no debe estar por defecto`);
  const on = sh(dir, '--with-caveman', '--with-graphify', '--with-playwright-mcp', '--dry-run').stdout;
  for (const s of ['caveman@caveman', 'graphify claude install', 'claude mcp add --scope project playwright -- npx @playwright/mcp@latest']) assert.ok(on.includes(s), s);
});

test('install.sh --new usa los flags de laravel new sin preguntas (dry-run)', () => {
  const bin = fakeBin({ laravel: 'exit 0' });
  const r = spawnSync('bash', [INSTALL_SH, '--new', 'mi-app', '--files-only', '--dry-run'], {
    cwd: tmp(),
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes('laravel new mi-app --database=sqlite --react --npm --boost --no-interaction'), r.stdout);
});

test('install.sh --new sin laravel cae a composer create-project (dry-run)', () => {
  const r = sh(tmp(), '--new', 'mi-app', '--files-only', '--dry-run');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes('laravel new mi-app --database=sqlite') || r.stdout.includes('composer create-project laravel/laravel mi-app'), r.stdout);
});

test('install.sh: opción desconocida falla', () => {
  const r = sh(tmp(), '--nope', '--dry-run');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /opción desconocida/);
});

test('install.sh: con composer/php/claude falsos no se cuelga ni falla si boost:install no puede correr', () => {
  const bin = fakeBin({ composer: 'exit 0', claude: 'exit 0', php: 'echo "php llamado: $*" >&2; exit 9' });
  const dir = tmp({ artisan: '' });
  const r = spawnSync('bash', [INSTALL_SH, '--no-boost'], { cwd: dir, encoding: 'utf8', input: '', timeout: 60000, env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` } });
  assert.equal(r.status, 0, r.stderr);
  const withBoost = spawnSync('bash', [INSTALL_SH], { cwd: dir, encoding: 'utf8', input: '', timeout: 60000, env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` } });
  assert.equal(withBoost.status, 0, withBoost.stderr);
  // Sin tty: avisa del comando manual. Con /dev/tty disponible (terminal real): intenta correrlo y avisa del fallo del php falso.
  assert.match(withBoost.stderr, /sin terminal interactivo|boost:install no terminó/);
});

test('install-files: copia cualquier plantilla nueva de templates/', () => {
  const tplDir = path.join(ROOT, 'templates');
  const extra = path.join(tplDir, '__test-extra.md');
  fs.writeFileSync(extra, '# extra\n');
  try {
    const dir = tmp();
    assert.equal(files(dir).status, 0);
    for (const t of ['spec.md', 'plan.md', 'plan-lite.md', '__test-extra.md']) assert.ok(fs.existsSync(path.join(dir, '.forja/templates', t)), t);
    for (const t of ['CLAUDE.md', 'settings.json', 'forja.config.json']) assert.ok(!fs.existsSync(path.join(dir, '.forja/templates', t)), `${t} tiene destino propio`);
    assert.ok(fs.existsSync(path.join(dir, 'docs/specs/.gitkeep')));
    assert.ok(fs.existsSync(path.join(dir, 'docs/system/.gitkeep')));
  } finally {
    fs.rmSync(extra, { force: true });
  }
});

test('install-files: fusiona claves nuevas de config sin pisar valores del usuario', () => {
  const tpl = json(ROOT, 'templates/forja.config.json');
  const keys = Object.keys(tpl);
  assert.ok(keys.length >= 3);
  const dropped = keys.find((k) => k !== 'l0MaxFiles');
  const user = { l0MaxFiles: 7, miClave: 'mía' }; // le faltan casi todas las claves de la plantilla
  const dir = tmp({ '.forja/config.json': JSON.stringify(user) });
  const r = files(dir);
  assert.equal(r.status, 0, r.stderr);
  const cfg = json(dir, '.forja/config.json');
  assert.equal(cfg.l0MaxFiles, 7, 'valor del usuario intacto');
  assert.equal(cfg.miClave, 'mía', 'clave propia conservada');
  assert.deepEqual(cfg[dropped], tpl[dropped], 'clave nueva añadida con el valor por defecto');
  for (const k of keys) assert.ok(k in cfg, `falta ${k}`);
  const first = fs.readFileSync(path.join(dir, '.forja/config.json'), 'utf8');
  assert.equal(files(dir).status, 0);
  assert.equal(fs.readFileSync(path.join(dir, '.forja/config.json'), 'utf8'), first, 'idempotente');
});

test('install-files: --dry no escribe nada', () => {
  const dir = tmp();
  const r = files(dir, '--dry');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /dry-run/);
  assert.deepEqual(fs.readdirSync(dir), []);
});

test('install-files: settings une allow/deny, respeta lo del usuario y retira la regla antigua de node_modules', () => {
  const dir = tmp({
    '.claude/settings.json': JSON.stringify({ permissions: { allow: ['Bash(ls)'], deny: ['Read(./node_modules/**)', 'Read(./foo)'] } }),
  });
  assert.equal(files(dir).status, 0);
  const s = json(dir, '.claude/settings.json');
  assert.ok(s.permissions.allow.includes('Bash(ls)') && s.permissions.allow.includes('Bash(php artisan test *)'));
  assert.ok(s.permissions.deny.includes('Read(./foo)'));
  assert.ok(!s.permissions.deny.includes('Read(./node_modules/**)'), 'node_modules ya no se deniega');
  for (const r of ['Edit(./.env)', 'Read(./.env)', 'Read(./auth.json)', 'Read(~/.ssh/**)']) assert.ok(s.permissions.deny.includes(r), r);
  assert.ok(!s.permissions.allow.some((r) => /rm |git push|curl/.test(r)), 'allow solo de lectura/test');
  const first = fs.readFileSync(path.join(dir, '.claude/settings.json'), 'utf8');
  files(dir);
  assert.equal(fs.readFileSync(path.join(dir, '.claude/settings.json'), 'utf8'), first, 'idempotente');
});

test('install-files: el bloque de CLAUDE.md se actualiza sin duplicarse y respeta el texto del usuario', () => {
  const dir = tmp({ 'CLAUDE.md': '# Mío\n\nReglas.\n\n<!-- forja:start -->\nviejo\n<!-- forja:end -->\n\nFin.\n' });
  assert.equal(files(dir).status, 0);
  const text = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
  assert.equal((text.match(/forja:start/g) || []).length, 1);
  assert.ok(!text.includes('viejo'));
  assert.match(text, /^# Mío[\s\S]*Reglas\.[\s\S]*Fin\.\n$/);
  files(dir);
  assert.equal(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8'), text, 'idempotente');
});

test('templates/CLAUDE.md: bloque corto y con las secciones clave', () => {
  const t = fs.readFileSync(path.join(ROOT, 'templates/CLAUDE.md'), 'utf8').trim().split('\n');
  assert.equal(t[0], '<!-- forja:start -->');
  assert.equal(t[t.length - 1], '<!-- forja:end -->');
  assert.ok(t.length <= 27, `el bloque tiene ${t.length} líneas (objetivo ≤25 de contenido)`);
  const text = t.join('\n');
  for (const s of ['Compact instructions', '.ai/rules', '/forja:triage', 'L0']) assert.ok(text.includes(s), s);
});

test('install-files: --boost-hook-only añade boost:update a composer.json una sola vez', () => {
  const dir = tmp({ 'composer.json': JSON.stringify({ name: 'a/b', scripts: { 'post-update-cmd': ['@php artisan vendor:publish --tag=x'] } }) });
  assert.equal(files(dir, '--boost-hook-only').status, 0);
  const cmd = '@php artisan boost:update --ansi';
  assert.deepEqual(json(dir, 'composer.json').scripts['post-update-cmd'], ['@php artisan vendor:publish --tag=x', cmd]);
  assert.equal(files(dir, '--boost-hook-only').status, 0);
  assert.equal(json(dir, 'composer.json').scripts['post-update-cmd'].filter((c) => c === cmd).length, 1);
});

test('manifiestos: versión 0.3.0 y keywords', () => {
  const p = json(ROOT, '.claude-plugin/plugin.json');
  assert.equal(p.version, '0.3.0');
  for (const k of ['playwright', 'inertia', 'qa']) assert.ok(p.keywords.includes(k), k);
});

// ---- coherencia entre piezas (integración) ----
const frontOf = (file) => {
  const m = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, `${file}: sin frontmatter`);
  return { raw: m[1], body: fs.readFileSync(file, 'utf8').slice(m[0].length) };
};
const SKILLS = fs.readdirSync(path.join(ROOT, 'skills'));
const userOnly = SKILLS.filter((s) => /^disable-model-invocation:\s*true/m.test(frontOf(path.join(ROOT, 'skills', s, 'SKILL.md')).raw));

test('frontmatter: valores YAML planos sin ": " ni " #" sin comillas (YAML estricto)', () => {
  const files = [...SKILLS.map((s) => path.join(ROOT, 'skills', s, 'SKILL.md')), ...fs.readdirSync(path.join(ROOT, 'agents')).map((a) => path.join(ROOT, 'agents', a))];
  for (const f of files) {
    for (const line of frontOf(f).raw.split('\n')) {
      const m = line.match(/^([A-Za-z-]+):\s*(.*)$/);
      assert.ok(m, `${f}: línea rara "${line}"`);
      if (!/^(".*"|'.*')$/.test(m[2])) assert.ok(!/: | #|:$/.test(m[2]), `${path.basename(path.dirname(f))}/${path.basename(f)}: ${m[1]} necesita comillas`);
    }
  }
});

test('skills: el estado se inyecta con el CLI del plugin (no aborta sin .forja) y con reglas Bash y PowerShell', () => {
  let n = 0;
  for (const s of SKILLS) {
    const { raw, body } = frontOf(path.join(ROOT, 'skills', s, 'SKILL.md'));
    if (!body.includes('!`')) continue;
    n++;
    assert.ok(body.includes('!`node "${CLAUDE_PLUGIN_ROOT}/scripts/forja.mjs" status --line`'), `${s}: inyección`);
    assert.ok(!body.includes('!`node .forja/'), `${s}: no inyectes .forja/forja.mjs (aborta si no existe)`);
    assert.match(raw, /Bash\(node \*forja\.mjs\* status --line\)/, `${s}: regla Bash`);
    assert.match(raw, /PowerShell\(node \*forja\.mjs\* status --line\)/, `${s}: regla PowerShell`);
  }
  assert.ok(n >= 7);
});

test('skills y agentes no mandan invocar una skill de solo usuario', () => {
  assert.deepEqual(userOnly.sort(), ['approve', 'infra', 'init', 'retro', 'security-audit', 'ship', 'visual-ref']);
  const docs = [...SKILLS.map((s) => path.join(ROOT, 'skills', s, 'SKILL.md')), ...fs.readdirSync(path.join(ROOT, 'agents')).map((a) => path.join(ROOT, 'agents', a))];
  for (const f of docs) {
    const t = fs.readFileSync(f, 'utf8');
    for (const s of userOnly) {
      assert.ok(!new RegExp(`(carga|cárgala|invoca|usa|usar) (con la herramienta Skill )?(la )?skill \`${s}\``, 'i').test(t), `${f}: manda invocar ${s}`);
    }
  }
});

test('plantilla de config: incluye todas las claves de DEFAULT_CONFIG y coincide con sus valores', async () => {
  const { pathToFileURL } = await import('node:url');
  const { DEFAULT_CONFIG } = await import(pathToFileURL(path.join(ROOT, 'hooks/lib.mjs')).href);
  const tpl = json(ROOT, 'templates/forja.config.json');
  for (const k of Object.keys(DEFAULT_CONFIG)) assert.ok(k in tpl, `falta ${k} en la plantilla`);
  for (const k of Object.keys(tpl)) assert.ok(k in DEFAULT_CONFIG, `${k} no existe en DEFAULT_CONFIG`);
  assert.deepEqual(tpl, DEFAULT_CONFIG);
});

test('install-files: config antigua conserva sus listas y recibe las claves nuevas', () => {
  const dir = tmp({ '.forja/config.json': JSON.stringify({ protectedPaths: ['app/'], l0MaxFiles: 5 }) });
  assert.equal(files(dir).status, 0);
  const c = json(dir, '.forja/config.json');
  assert.deepEqual(c.protectedPaths, ['app/'], 'no pisa listas del usuario');
  assert.equal(c.l0MaxFiles, 5);
  for (const k of ['sensitivePaths', 'protectedExclude', 'formatMode', 'docsOnlyAgents', 'verifyAgents', 'verifyTimeoutSec', 'neverEdit', 'outputMaxChars']) assert.ok(k in c, `clave nueva ${k}`);
});
