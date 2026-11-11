// SessionStart: inyecta 1-2 líneas con el estado (barato), limpia el contador L0 entre tareas
// y anota el HEAD inicial (base de verify para lo commiteado durante la sesión).
import { spawnSync } from 'node:child_process';
import { hasForja, loadState, locate, readInput, saveState } from './lib.mjs';

const input = readInput();
const { root, work } = locate(input);
if (!hasForja(root)) process.exit(0);

const state = loadState(root);
const fresh = ['startup', 'clear'].includes(input.source);
let dirty = false;
// L0 (explícito o implícito) y su contador son por tarea: en sesión nueva o tras /clear no se heredan.
if (fresh && (state.level === 'L0' || (state.l0_files || []).length)) {
  if (state.level === 'L0') Object.assign(state, { level: null, feature: null, approvals: {}, fail_count: 0 });
  Object.assign(state, { l0_files: [], l0_implicit: false });
  dirty = true;
}
if (fresh || !state.base_head) {
  const h = spawnSync('git', ['rev-parse', '--verify', '-q', 'HEAD'], { cwd: work, encoding: 'utf8' });
  if (h.status === 0 && h.stdout.trim() && h.stdout.trim() !== state.base_head && work === root) {
    state.base_head = h.stdout.trim();
    dirty = true;
  }
}
if (dirty) saveState(root, state);

if (!state.level) {
  console.log('FORJA activo, sin nivel: cambio trivial → fixer (L0, ≤3 archivos); rutas sensibles o algo mayor → /forja:triage.');
} else {
  const ap = state.approvals || {};
  const fmt = (k) => (ap[k] ? 'aprobada' : 'pendiente');
  const parts = [`nivel=${state.level}`];
  if (state.feature) parts.push(`feature=${state.feature}`);
  if (state.level === 'L2') parts.push(`spec=${fmt('spec')}`);
  if (state.level !== 'L0') parts.push(`plan=${fmt('plan')}`);
  console.log(`FORJA ${parts.join(' ')}. Estado en .forja/state.json (solo lectura para ti).`);
}
process.exit(0);
