// PreToolUse (Edit|Write|NotebookEdit): puerta de aprobación humana.
//  - Sin nivel: editar código asigna L0 implícito (cuenta para l0MaxFiles), salvo rutas sensibles (piden /forja:triage).
//  - L1/L2: sin las aprobaciones vigentes no se edita código.
//  - Subagentes de solo lectura y designer: solo escriben bajo docs/ (usa agent_type del input).
// Estado y config se leen del worktree principal; las rutas se calculan respecto al worktree donde está el archivo.
import fs from 'node:fs';
import path from 'node:path';
import {
  agentIn, approvalStatus, block, forjaPaths, hasForja, loadConfig, loadState, locate,
  matchPath, readInput, realish, relFromRoots, saveState,
} from './lib.mjs';

const input = readInput();
const { root, work } = locate(input);
if (!hasForja(root)) process.exit(0);

const ti = input.tool_input || {};
const file = ti.file_path || ti.notebook_path || ti.path;
if (!file) process.exit(0);
const cfg = loadConfig(root);
const abs = realish(path.resolve(work, String(file)));
const rel = relFromRoots([work, root], abs);

// --- subagentes limitados a docs/ ---
if (agentIn(input, [...cfg.readOnlyAgents, ...cfg.docsOnlyAgents])) {
  const scratch = input.scratchpad_dir ? realish(input.scratchpad_dir) : null;
  const inScratch = scratch && (abs === scratch || abs.startsWith(scratch + path.sep));
  if (!inScratch && (rel === null || !rel.startsWith('docs/') || rel.split('/').includes('..'))) {
    block(`FORJA: el agente ${input.agent_type} solo puede escribir bajo docs/ (informes en docs/specs/<slug>/reviews/). No edites ${rel ?? file}; devuelve el hallazgo al orquestador.`);
  }
}

if (rel === null) process.exit(0); // fuera del proyecto
const base = path.posix.basename(rel);

if (rel === '.forja/state.json' || abs === realish(forjaPaths(root).state)) {
  block('FORJA: state.json solo lo modifican los hooks y el CLI. Si necesitas cambiar de nivel usa: node .forja/forja.mjs level <L0|L1|L2> <slug>');
}
// Config, lib y CLI de Forja y los ajustes de Claude Code los cambia el usuario, no el agente (si no, bastaría editar config.json para saltar la puerta).
if (rel === '.claude/settings.json' || rel === '.claude/settings.local.json' || (rel.startsWith('.forja/') && !rel.startsWith('.forja/tmp/'))) {
  block(`FORJA: ${rel} no se edita desde el agente (configuración de Forja/permisos). Pídele al usuario que lo haga.`);
}
const isEnvFile = cfg.neverEdit.some((n) => (base === n || base.startsWith(`${n}.`)) && !base.endsWith('.example'));
if (isEnvFile) {
  block(`FORJA: ${base} no se edita desde el agente (secretos). Pídele al usuario que lo haga.`);
}

const isCode = matchPath(rel, cfg.protectedPaths) && !matchPath(rel, cfg.protectedExclude);
if (!isCode) process.exit(0); // docs/, .forja/, etc. siempre permitidos

const state = loadState(root);
const sensitive = matchPath(rel, cfg.sensitivePaths);
const sensitiveMsg = `FORJA: ${rel} es una ruta sensible (migraciones, policies, rutas, auth, middleware, CI o Docker). Clasifica primero con /forja:triage; no aplica el L0 implícito.`;

let dirty = false;
if (!state.level) {
  if (!cfg.enforceTriage) process.exit(0);
  if (sensitive) block(sensitiveMsg);
  state.level = 'L0'; // L0 implícito
  state.l0_implicit = true;
  dirty = true;
}

if (state.level === 'L0') {
  if (state.l0_implicit && sensitive) block(sensitiveMsg);
  const files = state.l0_files || [];
  if (!files.includes(rel)) {
    if (files.length >= cfg.l0MaxFiles) {
      block(`FORJA: L0 permite como máximo ${cfg.l0MaxFiles} archivos. Esto ya no es trivial: reclasifica con /forja:triage (L1/L2).`);
    }
    state.l0_files = [...files, rel];
    dirty = true;
  }
  if (dirty) saveState(root, state);
  process.exit(0);
}

const status = approvalStatus(root, state);
if (!status.ok) {
  block(
    `FORJA: nivel ${state.level}, no se puede editar código todavía: ${status.problems.join('; ')}. ` +
      'Pídele al usuario que revise y escriba /forja:approve spec o /forja:approve plan. No edites código hasta entonces.',
  );
}
process.exit(0);
