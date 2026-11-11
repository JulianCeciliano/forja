// Núcleo de Forja: estado, config y utilidades compartidas por hooks y CLI. Sin dependencias.
// En el proyecto vive copiado como .forja/lib.mjs (lo hace el instalador): no importes nada fuera de este archivo.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const LEVELS = ['L0', 'L1', 'L2'];
export const RANK = { L0: 0, L1: 1, L2: 2 };
// Qué aprobaciones humanas exige cada nivel antes de tocar código.
export const REQUIRED = { L1: ['plan'], L2: ['spec', 'plan'] };

// Patrones de ruta (relativas a la raíz del proyecto, con "/"):
//  - terminan en "/"  -> prefijo de carpeta        ("app/")
//  - contienen "*"    -> glob sobre la ruta entera ("vite.config.*", "docker-compose*")
//  - otro caso        -> archivo exacto            ("artisan", "bootstrap/app.php")
export const DEFAULT_CONFIG = {
  // Si no hay nivel y se edita código: true = L0 implícito (salvo sensitivePaths); false = sin puerta.
  enforceTriage: true,
  // Rutas que cuentan como "código" y pasan por la puerta (Laravel + Inertia/React).
  protectedPaths: [
    'app/', 'routes/', 'database/', 'resources/', 'config/', 'src/', 'lib/', 'tests/', 'bootstrap/', 'public/',
    '.github/', 'docker/', 'composer.json', 'package.json', 'artisan', 'vite.config.*', 'tsconfig*.json',
    'phpunit.xml*', 'pint.json', 'eslint.config.*', 'tailwind.config.*', 'postcss.config.*', 'components.json',
    'Dockerfile*', 'docker-compose*', 'compose*.y*ml',
  ],
  // Excepciones a protectedPaths (artefactos generados).
  protectedExclude: ['public/build/', 'public/hot', 'public/storage/'],
  // Rutas donde el L0 implícito NO aplica: exigen /forja:triage antes de editar.
  sensitivePaths: [
    'database/migrations/', 'app/Policies/', 'routes/', 'config/auth.php', 'config/sanctum.php',
    'app/Http/Middleware/', 'bootstrap/app.php', '.github/workflows/', 'docker/', 'Dockerfile*',
    'docker-compose*', 'compose*.y*ml',
  ],
  // Archivos que nunca se editan (basename). .env.example sí se permite.
  neverEdit: ['.env'],
  // L0 (cambio trivial) solo puede tocar N archivos distintos antes de exigir triage.
  l0MaxFiles: 3,
  // Verificación (Stop y SubagentStop de verifyAgents).
  checkTimeoutSec: 300,
  verifyTimeoutSec: 1500, // presupuesto total de verify; el timeout de hooks.json (1800 s) debe superarlo
  maxFailLoops: 3,
  outputMaxLines: 40,
  outputMaxChars: 3500,
  // null = autodetección (Laravel + React/Inertia). O lista de { name, cmd, when: regex de archivos [, args] }.
  // Con "args" (array) se ejecuta sin shell (portable en Windows); sin "args", cmd pasa por la shell del sistema.
  checks: null,
  // 'stop' = formatea solo los archivos cambiados al verificar (defecto, no obliga a releer archivos);
  // 'edit' = formatea tras cada Edit/Write (modo anterior); 'off' = nunca.
  formatMode: 'stop',
  // Subagentes de solo lectura: solo comandos de lectura/test y solo escriben bajo docs/.
  readOnlyAgents: ['validator', 'security', 'explorer', 'qa'],
  // Subagentes que solo escriben bajo docs/ pero no están limitados en Bash.
  docsOnlyAgents: ['designer'],
  // Subagentes cuyo SubagentStop ejecuta verify.
  verifyAgents: ['builder', 'fixer'],
  // Agentes que no editan ningún archivo (el orquestador piensa y delega; sus subagentes sí editan).
  noEditAgents: ['orchestrator'],
  extraReadOnlyCommands: [],
};

export function readInput() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

// ---------- rutas, raíces y worktrees ----------

// Ruta real (expande nombres cortos de Windows y symlinks) aunque el archivo aún no exista.
export function realish(p) {
  let cur = path.resolve(String(p));
  const rest = [];
  for (;;) {
    try {
      return path.join(fs.realpathSync.native(cur), ...rest.reverse());
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return path.resolve(String(p));
      rest.push(path.basename(cur));
      cur = parent;
    }
  }
}

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 8000 });
  return r.status === 0 ? r.stdout.trim() : null;
}

function findUp(start, test) {
  let cur = start;
  for (;;) {
    if (test(cur)) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
}

const located = new Map();

// root = donde viven .forja/ (estado y config) y docs/: el worktree principal.
// work = raíz del worktree donde trabaja Claude (igual a root si no hay worktree enlazado).
export function locate(input = {}) {
  const envDir = process.env.CLAUDE_PROJECT_DIR ? realish(process.env.CLAUDE_PROJECT_DIR) : null;
  const start = realish(input.cwd || envDir || process.cwd());
  const key = `${start}|${envDir}`;
  if (located.has(key)) return located.get(key);

  let top = null;
  let mainTop = null;
  const out = git(start, ['rev-parse', '--path-format=absolute', '--show-toplevel', '--git-common-dir']);
  if (out) {
    const [t, common] = out.split(/\r?\n/);
    if (t) top = realish(t);
    if (common && path.basename(common) === '.git') mainTop = realish(path.dirname(common));
  }
  const has = (d) => !!d && hasForja(d);
  let root;
  if (has(mainTop)) root = mainTop;
  else if (has(envDir)) root = envDir;
  else root = findUp(start, has) || envDir || start;

  let work = root;
  if (top && mainTop && top !== mainTop) {
    // worktree enlazado: misma subcarpeta del proyecto, pero dentro del worktree
    const offset = path.relative(mainTop, root);
    work = offset.startsWith('..') ? top : path.join(top, offset);
  }
  const res = { root, work };
  located.set(key, res);
  return res;
}

// Raíz del estado/config (worktree principal).
export function projectDir(input = {}) {
  return locate(input).root;
}

// Raíz del worktree actual (para rutas relativas, git y checks).
export function workDir(input = {}) {
  return locate(input).work;
}

export function forjaPaths(root) {
  const dir = path.join(root, '.forja');
  return {
    dir,
    state: path.join(dir, 'state.json'),
    config: path.join(dir, 'config.json'),
    metrics: path.join(dir, 'metrics.jsonl'),
  };
}

// Los hooks son inertes en proyectos sin .forja/ (el plugin no estorba en otros repos).
export function hasForja(root) {
  return fs.existsSync(forjaPaths(root).dir);
}

// Campos que sobreviven a "done" y a "level L0" (huellas de verify y contador L0).
const CARRY = ['l0_files', 'last_pass_fp', 'last_pass_head', 'base_head', 'wt'];
export function carry(state) {
  return Object.fromEntries(CARRY.filter((k) => state[k] !== undefined).map((k) => [k, state[k]]));
}

export function defaultState() {
  return {
    level: null, feature: null, approvals: {}, l0_files: [], l0_implicit: false, fail_count: 0,
    last_pass_fp: null, last_pass_head: null, last_fail_fp: null, last_fail_name: null, base_head: null,
  };
}

export function loadState(root) {
  try {
    return { ...defaultState(), ...JSON.parse(fs.readFileSync(forjaPaths(root).state, 'utf8')) };
  } catch {
    return defaultState();
  }
}

export function saveState(root, state) {
  const p = forjaPaths(root);
  fs.mkdirSync(p.dir, { recursive: true });
  const tmp = `${p.state}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
  fs.renameSync(tmp, p.state);
}

export function loadConfig(root) {
  let user = {};
  try {
    user = JSON.parse(fs.readFileSync(forjaPaths(root).config, 'utf8'));
  } catch {
    /* sin config propia */
  }
  return { ...DEFAULT_CONFIG, ...user };
}

export function sha(file) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16);
  } catch {
    return null;
  }
}

export function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function artifactPath(root, feature, kind) {
  return path.join(root, 'docs', 'specs', feature, `${kind}.md`);
}

// Ruta relativa a `root` en formato posix; null si queda fuera. Resuelve rutas reales (Windows 8.3, symlinks).
export function relPath(root, file) {
  const abs = realish(path.resolve(root, String(file)));
  const rel = path.relative(realish(root), abs);
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}

// Ruta relativa del archivo: primero respecto al worktree actual, luego al principal.
export function relFromRoots(roots, file) {
  for (const r of roots) {
    const rel = relPath(r, file);
    if (rel !== null) return rel;
  }
  return null;
}

// ¿La ruta relativa casa con algún patrón? (ver formato junto a DEFAULT_CONFIG)
export function matchPath(rel, patterns = []) {
  return patterns.some((p) => {
    if (p.endsWith('/')) return rel.startsWith(p);
    if (p.includes('*')) {
      const re = new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`);
      return re.test(rel);
    }
    return rel === p;
  });
}

// ¿El agent_type del hook es uno de `names`? Acepta "validator" y "forja:validator".
export function agentIn(input, names = []) {
  const agent = String(input.agent_type || '').toLowerCase();
  return !!agent && names.some((n) => agent === n || agent.endsWith(`:${n}`));
}

// ---------- plantillas ----------

function templateFile(name) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const d of [path.join(here, 'templates'), path.join(here, '..', 'templates')]) {
    const f = path.join(d, name);
    if (fs.existsSync(f)) return f;
  }
  return null;
}

const norm = (t) => String(t).replace(/\r\n/g, '\n').trim();

// Motivo por el que el documento sigue siendo la plantilla; null si está rellenado.
export function templateProblem(kind, level, text) {
  const f = templateFile(kind === 'plan' && level === 'L1' ? 'plan-lite.md' : `${kind}.md`);
  const tpl = f ? fs.readFileSync(f, 'utf8') : '';
  if (tpl && norm(tpl) === norm(text)) return `${kind}.md es idéntica a la plantilla`;
  const markers = new Set(tpl.match(/<[^<>\n]{2,80}>/g) || []);
  if (!f) ['<nombre de la feature>', '<título corto>', '<contexto>', '<tarea>'].forEach((m) => markers.add(m));
  const left = [...markers].filter((m) => text.includes(m));
  if (left.length) return `${kind}.md aún tiene marcadores de plantilla sin rellenar (${left.slice(0, 3).join(', ')}${left.length > 3 ? ', …' : ''})`;
  return null;
}

// ¿Están vigentes las aprobaciones que exige el nivel? Editar el archivo tras aprobar las invalida.
export function approvalStatus(root, state) {
  const need = REQUIRED[state.level] || [];
  const problems = [];
  if (!state.feature) {
    problems.push('no hay feature activa (corre /forja:triage)');
  } else {
    for (const kind of need) {
      const a = state.approvals?.[kind];
      const h = sha(artifactPath(root, state.feature, kind));
      if (!h) problems.push(`falta docs/specs/${state.feature}/${kind}.md`);
      else if (!a) problems.push(`${kind} pendiente de aprobación`);
      else if (a.hash !== h) problems.push(`${kind} editada después de aprobarla`);
    }
  }
  return { ok: problems.length === 0, problems };
}

// Registra una aprobación humana. Solo la llaman el hook UserPromptSubmit y el CLI del usuario.
export function approve(root, kind) {
  const state = loadState(root);
  if (!['spec', 'plan'].includes(kind)) return { ok: false, reason: 'usa "spec" o "plan"' };
  if (!REQUIRED[state.level]) return { ok: false, reason: 'no hay nivel L1/L2 activo (corre /forja:triage)' };
  if (!REQUIRED[state.level].includes(kind)) {
    return { ok: false, reason: `el nivel ${state.level} no requiere aprobar ${kind}` };
  }
  if (kind === 'plan' && state.level === 'L2') {
    const specHash = sha(artifactPath(root, state.feature, 'spec'));
    if (!state.approvals?.spec || state.approvals.spec.hash !== specHash) {
      return { ok: false, reason: 'primero aprueba la spec (/forja:approve spec)' };
    }
  }
  const file = artifactPath(root, state.feature, kind);
  const h = sha(file);
  if (!h) return { ok: false, reason: `falta ${path.relative(root, file)}` };
  if (fs.statSync(file).size < 80) return { ok: false, reason: `${kind}.md está vacío` };
  const problem = templateProblem(kind, state.level, fs.readFileSync(file, 'utf8'));
  if (problem) return { ok: false, reason: `${problem}; rellénala antes de aprobar` };
  state.approvals = { ...state.approvals, [kind]: { hash: h, at: new Date().toISOString() } };
  saveState(root, state);
  return { ok: true, hash: h, feature: state.feature, level: state.level };
}

// ---------- ejecución portable ----------

// En Windows los ejecutables pueden ser .exe o shims .bat/.cmd (Herd, npm, composer): spawn sin shell solo lanza .exe.
function resolveExe(name) {
  if (process.platform !== 'win32') return name;
  const exts = (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean);
  const hasExt = /\.[a-z0-9]+$/i.test(name);
  const dirs = path.isAbsolute(name) ? [''] : (process.env.PATH || process.env.Path || '').split(path.delimiter).filter(Boolean);
  for (const d of dirs) {
    for (const e of hasExt ? [''] : exts) {
      const f = path.join(d, name + e);
      if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
    }
  }
  return name;
}

// spawnSync de argv = [exe, ...args] sin pasar por una shell salvo para .bat/.cmd (cmd /c con argumentos entrecomillados).
export function spawnTool(argv, opts = {}) {
  const exe = resolveExe(argv[0]);
  if (process.platform === 'win32' && /\.(bat|cmd)$/i.test(exe)) {
    const q = (a) => (/^[\w@%+=:,./\\-]+$/.test(a) ? a : `"${a.replace(/"/g, '""')}"`);
    return spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `"${[exe, ...argv.slice(1)].map(q).join(' ')}"`], { ...opts, windowsVerbatimArguments: true });
  }
  return spawnSync(exe, argv.slice(1), opts);
}

// Bloquea la acción: stderr vuelve a Claude como motivo (exit 2).
export function block(msg) {
  process.stderr.write(`${msg}\n`);
  process.exit(2);
}
