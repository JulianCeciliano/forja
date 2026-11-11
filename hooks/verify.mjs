// Stop (y SubagentStop de builder y fixer): no se da la tarea por terminada si los checks fallan (exit 2 devuelve el control).
// Cubre el código sin commitear Y lo commiteado desde la última verificación que pasó (HEAD verificado en el estado).
// Ahorro de tokens: se salta si no cambió nada desde el último pase, formatea al final (no en cada edición),
// no repite un fallo sobre el mismo código y solo devuelve las líneas relevantes del log.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { agentIn, block, hasForja, loadConfig, loadState, locate, readInput, saveState, spawnTool } from './lib.mjs';

const input = readInput();
const { root, work } = locate(input);
if (!hasForja(root)) process.exit(0);

const cfg = loadConfig(root);
if (input.hook_event_name === 'SubagentStop' && !agentIn(input, cfg.verifyAgents)) process.exit(0);

const state = loadState(root);
if (!input.stop_hook_active) state.fail_count = 0; // turno nuevo del usuario

// Huellas por worktree: el principal usa los campos de primer nivel; los enlazados, state.wt[<ruta>].
const slot = work === root ? state : ((state.wt ??= {})[work] ??= {});

const git = (...args) => spawnSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: work, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
const lines = (s) => String(s || '').split(/\r?\n/).filter(Boolean);

// -uall: lista cada archivo sin seguimiento (si no, un directorio nuevo aparece como "app/" y no detecta ediciones).
const porcelain = git('status', '--porcelain', '-uall');
if (porcelain.status !== 0) process.exit(0); // no es un repo git
const dirty = lines(porcelain.stdout).map((l) => l.slice(3).replace(/^"|"$/g, '').split(' -> ').pop());

const headR = git('rev-parse', '--verify', '-q', 'HEAD');
const head = headR.status === 0 ? headR.stdout.trim() : null;

// Base de comparación para lo commiteado: último HEAD verificado > merge-base con la rama por defecto > HEAD al iniciar la sesión.
const isAncestor = (sha) => !!sha && git('merge-base', '--is-ancestor', sha, 'HEAD').status === 0;
function defaultBranchBase() {
  const cands = [];
  const sym = git('symbolic-ref', '--short', '-q', 'refs/remotes/origin/HEAD');
  if (sym.status === 0 && sym.stdout.trim()) cands.push(sym.stdout.trim());
  cands.push('main', 'master', 'develop', 'origin/main', 'origin/master');
  for (const c of cands) {
    const mb = git('merge-base', c, 'HEAD');
    if (mb.status === 0 && mb.stdout.trim()) return mb.stdout.trim();
  }
  return null;
}
let base = null;
if (head) {
  if (isAncestor(slot.last_pass_head)) base = slot.last_pass_head;
  else {
    const mb = defaultBranchBase();
    if (mb && mb !== head) base = mb; // en la propia rama por defecto el merge-base es HEAD: no sirve
    else if (isAncestor(state.base_head)) base = state.base_head;
  }
}
// Sin base: no sabemos qué se commiteó sin verificar, así que se verifica todo el código versionado.
const committed = !head ? [] : base ? lines(git('diff', '--name-only', base, 'HEAD').stdout) : lines(git('ls-files').stdout);

const CODE = /\.(php|js|jsx|ts|tsx|vue|css|json)$/;
const code = [...new Set([...dirty, ...committed])].filter(
  (f) => !/^(docs|\.forja|\.claude|vendor|node_modules)\//.test(f) && (f.endsWith('/') || CODE.test(f)),
);
if (code.length === 0) process.exit(0);

// Huella: HEAD + estado de cada archivo de código. Si no cambió desde el último pase, no repetimos checks.
const fingerprint = () =>
  crypto
    .createHash('sha256')
    .update(
      `${head}|` +
        code
          .map((f) => {
            try {
              const s = fs.statSync(path.join(work, f));
              return `${f}:${s.size}:${Math.floor(s.mtimeMs)}`;
            } catch {
              return `${f}:gone`;
            }
          })
          .join('|'),
    )
    .digest('hex')
    .slice(0, 16);
let fp = fingerprint();
if (slot.last_pass_fp === fp) process.exit(0);

// El mismo código ya falló y esto no es una continuación del bucle de corrección: no obligues a arreglar trabajo ajeno.
if (slot.last_fail_fp === fp && !input.stop_hook_active) {
  console.log(
    JSON.stringify({ systemMessage: `FORJA: "${slot.last_fail_name || 'verify'}" sigue fallando y el código no cambió desde el último intento; no se repite el bloqueo. Edita algo o corre /forja:verify.` }),
  );
  process.exit(0);
}

const exists = (p) => fs.existsSync(path.join(work, p));
const present = (list) => list.filter((f) => !f.endsWith('/') && exists(f));
const touches = (re) => code.some((f) => re.test(f));
const deadline = Date.now() + cfg.verifyTimeoutSec * 1000;
const baseEnv = { ...process.env, CI: '1', NO_COLOR: '1', FORCE_COLOR: '0' };

// Binario de un paquete npm resuelto desde su package.json: se lanza con node, sin shims .cmd (portable en Windows).
function nodeBin(pkg, name) {
  try {
    const pj = JSON.parse(fs.readFileSync(path.join(work, 'node_modules', pkg, 'package.json'), 'utf8'));
    const rel = typeof pj.bin === 'string' ? pj.bin : pj.bin?.[name];
    const bin = rel && path.join(work, 'node_modules', pkg, rel);
    return bin && fs.existsSync(bin) ? bin : null;
  } catch {
    return null;
  }
}
const chunks = (arr, n = 40) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// ---- 1) Formato de los archivos cambiados (antes de los checks) ----
if (cfg.formatMode === 'stop') {
  const quiet = (argv, ms = 120000) =>
    spawnTool(argv, { cwd: work, stdio: 'ignore', timeout: Math.min(ms, Math.max(1000, deadline - Date.now())) });
  try {
    const php = present(code.filter((f) => /\.php$/.test(f)));
    if (php.length && exists('vendor/bin/pint')) for (const c of chunks(php)) quiet(['php', 'vendor/bin/pint', '--quiet', ...c]);
    const prettier = nodeBin('prettier', 'prettier');
    const web = present(code.filter((f) => /\.(ts|tsx|js|jsx|css|json)$/.test(f)));
    if (web.length && prettier) for (const c of chunks(web)) quiet([process.execPath, prettier, '--write', '--log-level', 'silent', ...c]);
  } catch {
    /* formatear es best-effort */
  }
  fp = fingerprint(); // el formato cambió mtimes: la huella guardada es la posterior
}

// ---- 2) Checks ----
let checks = cfg.checks;
if (!checks) {
  checks = [];
  const phpFiles = present(code.filter((f) => /\.php$/.test(f)));
  if (touches(/\.php$/)) {
    if (exists('vendor/bin/pint') && phpFiles.length) {
      checks.push({ name: 'pint', argv: ['php', 'vendor/bin/pint', '--test', ...(phpFiles.length <= 150 ? phpFiles : [])] });
    }
    // --compact (Laravel 11+/Pest) acorta la salida; si el runner no lo conoce se reintenta sin él.
    if (exists('artisan')) checks.push({ name: 'tests php', argv: ['php', 'artisan', 'test', '--compact'], compact: true });
  }
  const tsc = nodeBin('typescript', 'tsc');
  if (touches(/\.(ts|tsx)$/) && exists('tsconfig.json') && tsc) {
    checks.push({ name: 'tsc', argv: [process.execPath, tsc, '--noEmit'] });
  }
  const vitest = nodeBin('vitest', 'vitest');
  if (touches(/\.(js|jsx|ts|tsx|vue)$/) && vitest) {
    checks.push({ name: 'vitest', argv: [process.execPath, vitest, 'run', ...(base ? ['--changed', base] : []), '--passWithNoTests', '--reporter=dot'] });
  }
} else {
  checks = checks.filter((c) => !c.when || touches(new RegExp(c.when)));
}

const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
// Líneas que suelen contener el fallo real (PHPUnit/Pest/Laravel, vitest, tsc, pint).
const FAIL_LINE = /(\bFAIL(ED|URE|URES)?\b|✕|✖|×|⨯|Failed asserting|\bError\b|Exception|\bexpected\b|There w(as|ere) \d+ (failure|error)|\.php:\d+|error TS\d+|Tests?:\s+\d+)/i;
function trim(text) {
  const all = text.replace(ANSI, '').split('\n').filter((l) => l.trim() !== '');
  const max = cfg.outputMaxLines;
  let out;
  if (all.length <= max) out = all;
  else {
    // Muestra las primeras líneas de fallo (con 2 de contexto) y la cola (resumen); si no hay fallos reconocibles, solo la cola.
    const hits = all.map((l, i) => (FAIL_LINE.test(l) ? i : -1)).filter((i) => i >= 0);
    const tailN = hits.length ? Math.min(8, Math.ceil(max / 4)) : max;
    const keep = new Set();
    for (let i = all.length - tailN; i < all.length; i++) keep.add(i);
    let budget = max - tailN;
    for (const i of hits) {
      for (const j of [i, i + 1, i + 2]) {
        if (budget > 0 && j < all.length - tailN && !keep.has(j)) { keep.add(j); budget--; }
      }
      if (budget <= 0) break;
    }
    out = [];
    let prev = -1;
    for (const i of [...keep].sort((a, b) => a - b)) {
      if (prev >= 0 && i > prev + 1) out.push('…');
      out.push(all[i]);
      prev = i;
    }
  }
  let s = out.join('\n');
  if (s.length > cfg.outputMaxChars) s = `…${s.slice(-cfg.outputMaxChars)}`;
  return s;
}

let timeoutMs = 0;
function run(argv, c) {
  const left = deadline - Date.now();
  const opts = {
    cwd: work, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, env: baseEnv,
    timeout: Math.max(1000, Math.min(cfg.checkTimeoutSec * 1000, left)),
  };
  if (Array.isArray(argv)) return spawnTool(argv, opts);
  return spawnSync(c.cmd, [], { ...opts, shell: true });
}

for (const c of checks) {
  timeoutMs = Math.max(1000, Math.min(cfg.checkTimeoutSec * 1000, deadline - Date.now()));
  let argv = c.argv || (Array.isArray(c.args) ? [c.cmd, ...c.args] : null);
  let r = run(argv, c);
  if (c.compact && r.status !== 0 && /(option|opción).*(does not exist|no existe)|unknown option|unrecognized option/i.test(`${r.stdout}${r.stderr}`)) {
    argv = argv.filter((a) => a !== '--compact');
    r = run(argv, c);
  }
  if (r.status === 0) continue;

  state.fail_count = (state.fail_count || 0) + 1;
  slot.last_fail_fp = fp;
  slot.last_fail_name = c.name;
  if (input.stop_hook_active && state.fail_count > cfg.maxFailLoops) {
    saveState(root, { ...state, fail_count: 0 });
    console.log(
      JSON.stringify({ systemMessage: `FORJA: "${c.name}" sigue fallando tras ${cfg.maxFailLoops} intentos. Revisión manual necesaria.` }),
    );
    process.exit(0);
  }
  saveState(root, state);
  const why =
    r.error?.code === 'ETIMEDOUT' ? `timeout de ${Math.round(timeoutMs / 1000)}s`
    : r.error?.code === 'ENOENT' ? `no se encontró el ejecutable "${argv?.[0] ?? c.cmd}"`
    : `exit ${r.status}`;
  block(
    `FORJA verify: falló "${c.name}" (${why}). Corrige y vuelve a intentar (intento ${state.fail_count}/${cfg.maxFailLoops}).\n` +
      trim(`${r.stdout || ''}\n${r.stderr || ''}`),
  );
}

slot.last_pass_fp = fp;
slot.last_pass_head = head;
slot.last_fail_fp = null;
slot.last_fail_name = null;
state.fail_count = 0;
saveState(root, state);
process.exit(0);
