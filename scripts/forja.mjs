#!/usr/bin/env node
// CLI de Forja. En el proyecto vive en .forja/forja.mjs (junto a lib.mjs y templates/).
//   node .forja/forja.mjs status [--line]            (--line: una línea compacta, siempre exit 0; para inyectar en skills)
//   node .forja/forja.mjs level <L0|L1|L2> [slug]     (clasifica la tarea y prepara docs/specs/<slug>/)
//   node .forja/forja.mjs approve <spec|plan>        (alternativa manual para el usuario: "! node ...")
//   node .forja/forja.mjs done                       (cierra la feature; el contador L0 se conserva)
//   node .forja/forja.mjs metrics                    (resumen de tokens por feature/agente)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const inProject = path.basename(here) === '.forja';
const [cmd, ...args] = process.argv.slice(2);
const wantsLine = cmd === 'status' && args.includes('--line');

let lib;
try {
  lib = await import(fs.existsSync(path.join(here, 'lib.mjs')) ? './lib.mjs' : '../hooks/lib.mjs');
} catch (e) {
  if (wantsLine) {
    console.log('FORJA sin estado');
    process.exit(0);
  }
  throw e;
}
const { RANK, REQUIRED, approvalStatus, approve, carry, defaultState, forjaPaths, loadConfig, loadState, saveState, slugify } = lib;

// El estado vive en el worktree principal: desde un worktree enlazado se resuelve hacia allí.
const base = inProject ? path.dirname(here) : path.resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());
const root = lib.locate({ cwd: base }).root;
const templatesDir = [path.join(here, 'templates'), path.join(root, '.forja', 'templates'), path.join(here, '..', 'templates')].find((d) => fs.existsSync(d));
const out = (s) => console.log(s);
const fail = (s) => {
  console.error(`forja: ${s}`);
  process.exit(1);
};

function copyTemplate(name, dest) {
  if (fs.existsSync(dest)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(templatesDir, name), dest);
  return true;
}

function statusLine() {
  try {
    if (!fs.existsSync(forjaPaths(root).dir)) return out('FORJA no instalado');
    const s = loadState(root);
    if (!s.level) return out('FORJA sin nivel');
    const parts = [`nivel=${s.level}`];
    if (s.feature) parts.push(`feature=${s.feature}`);
    if (REQUIRED[s.level]) {
      for (const k of REQUIRED[s.level]) parts.push(`${k}=${s.approvals?.[k] ? 'aprobada' : 'pendiente'}`);
      parts.push(approvalStatus(root, s).ok ? 'código=desbloqueado' : 'código=BLOQUEADO');
    } else {
      parts.push(`archivos=${(s.l0_files || []).length}/${loadConfig(root).l0MaxFiles}`);
    }
    out(`FORJA ${parts.join(' ')}`);
  } catch {
    out('FORJA sin estado');
  }
}

function status() {
  if (args.includes('--line')) return statusLine();
  const s = loadState(root);
  out(`nivel:    ${s.level ?? '(sin triage)'}`);
  out(`feature:  ${s.feature ?? '-'}`);
  if (REQUIRED[s.level]) {
    const st = approvalStatus(root, s);
    for (const k of REQUIRED[s.level]) out(`${k.padEnd(9)} ${s.approvals?.[k] ? 'aprobada' : 'pendiente'}`);
    out(st.ok ? 'código:   desbloqueado' : `código:   BLOQUEADO (${st.problems.join('; ')})`);
  }
  if (s.level === 'L0') out(`L0 archivos: ${(s.l0_files || []).length}/${loadConfig(root).l0MaxFiles}${s.l0_implicit ? ' (implícito)' : ''}`);
}

function level() {
  const lv = (args[0] || '').toUpperCase();
  const force = args.includes('--force');
  const slugArg = args.slice(1).find((a) => !a.startsWith('--'));
  if (!(lv in RANK)) fail('uso: level <L0|L1|L2> [slug]');
  const cur = loadState(root);
  const active = cur.feature && REQUIRED[cur.level];

  if (active && !force) {
    if (RANK[lv] < RANK[cur.level]) fail(`hay una feature activa (${cur.feature}, ${cur.level}); no se puede bajar a ${lv}. Cierra con "done" o pide al usuario --force.`);
    if (slugArg && slugify(slugArg) !== cur.feature) fail(`hay una feature activa (${cur.feature}). Cierra con "done" antes de empezar otra.`);
  }

  if (lv === 'L0') {
    // El contador de archivos NO se reinicia (si no, "done && level L0" evadiría el límite): solo --force (usuario),
    // SessionStart startup/clear o subir a L1/L2.
    const kept = force ? [] : cur.l0_files || [];
    saveState(root, { ...defaultState(), ...carry(cur), l0_files: kept, level: 'L0' });
    const max = loadConfig(root).l0MaxFiles;
    return out(`nivel L0 (trivial). Máximo ${max} archivos de código${kept.length ? ` (ya van ${kept.length}; el contador solo lo reinicia el usuario con --force)` : ''}; los checks corren al terminar.`);
  }

  const slug = slugify(slugArg || cur.feature);
  if (!slug) fail('falta el slug de la feature (ej: level L2 tareas-rapidas)');
  if (cur.feature === slug && cur.level === lv) return out(`ya estás en ${lv} para "${slug}".`);

  const dir = path.join(root, 'docs', 'specs', slug);
  fs.mkdirSync(dir, { recursive: true });
  if (lv === 'L1') copyTemplate('plan-lite.md', path.join(dir, 'plan.md'));
  if (lv === 'L2') {
    copyTemplate('spec.md', path.join(dir, 'spec.md'));
    copyTemplate('plan.md', path.join(dir, 'plan.md'));
  }
  saveState(root, { ...defaultState(), ...carry(cur), l0_files: [], level: lv, feature: slug }); // subir de nivel limpia el contador L0
  out(`nivel ${lv}, feature "${slug}". Archivos en docs/specs/${slug}/. Aprobaciones requeridas: ${REQUIRED[lv].join(' + ')}.`);
}

function done() {
  saveState(root, { ...defaultState(), ...carry(loadState(root)) });
  out('feature cerrada, estado reiniciado (el contador L0 y las huellas de verify se conservan). Opcional: /forja:retro');
}

function cmdApprove() {
  const kind = (args[0] || '').toLowerCase();
  const r = approve(root, kind);
  if (!r.ok) fail(`no se aprobó ${kind}: ${r.reason}`);
  out(`${kind} aprobada (hash ${r.hash}) para "${r.feature}".`);
}

function metrics() {
  const file = forjaPaths(root).metrics;
  if (!fs.existsSync(file)) return out('sin métricas todavía (.forja/metrics.jsonl).');
  const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
  const byFeature = {};
  const last = {}; // sesión -> último acumulado visto
  let cacheRead = 0;
  rows.sort((x, y) => String(x.ts).localeCompare(String(y.ts)));
  for (const r of rows) {
    const f = r.feature || '(sin feature)';
    byFeature[f] ??= { out: 0, in: 0, sub: {} };
    const b = byFeature[f];
    if (r.event === 'SubagentStop') {
      const a = r.agent || 'subagente';
      b.sub[a] ??= { runs: 0, out: 0, in: 0 };
      b.sub[a].runs += 1; b.sub[a].out += r.out; b.sub[a].in += r.in + r.cache_write;
    } else {
      // Stop es acumulado por sesión: cada fila aporta solo el incremento sobre la anterior de esa sesión,
      // así una sesión que abarcó dos features no se cuenta dos veces. Si el acumulado baja (transcript nuevo), se toma entero.
      const cur = { out: r.out, in: r.in + r.cache_write, cr: r.cache_read };
      const prev = last[r.session] || { out: 0, in: 0, cr: 0 };
      const d = (k) => (cur[k] >= prev[k] ? cur[k] - prev[k] : cur[k]);
      b.out += d('out'); b.in += d('in'); cacheRead += d('cr');
      last[r.session] = cur;
    }
  }
  const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
  out('feature'.padEnd(28) + 'out'.padStart(9) + 'in(nuevo)'.padStart(11) + '  subagentes (runs/out)');
  for (const [f, b] of Object.entries(byFeature)) {
    const subs = Object.entries(b.sub).map(([a, v]) => `${a.split(':').pop()} ${v.runs}/${k(v.out)}`).join(', ');
    out(f.padEnd(28) + k(b.out).padStart(9) + k(b.in).padStart(11) + `  ${subs}`);
  }
  out(`\ncache_read total sesiones: ${k(cacheRead)} (se cobra ~10% del precio de entrada).`);
}

const commands = { status, level, done, approve: cmdApprove, metrics };
if (!commands[cmd]) {
  out('uso: node .forja/forja.mjs <status [--line]|level|approve|done|metrics>');
  process.exit(cmd ? 1 : 0);
}
commands[cmd]();
