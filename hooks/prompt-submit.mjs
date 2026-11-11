// UserPromptSubmit: registra aprobaciones humanas.
// El modelo nunca participa: el hook lee el texto que escribió el usuario (/forja:approve spec|plan).
import { approve, hasForja, projectDir, readInput } from './lib.mjs';

const input = readInput();
const root = projectDir(input);
if (!hasForja(root)) process.exit(0);

const m = String(input.prompt ?? '').match(/^\s*\/(?:forja:)?approve\s+(spec|plan)\b/i);
if (!m) process.exit(0);

const kind = m[1].toLowerCase();
const r = approve(root, kind);
// stdout de UserPromptSubmit se añade al contexto de Claude.
console.log(
  r.ok
    ? `FORJA: ${kind} aprobada por el usuario (nivel ${r.level}, feature "${r.feature}", hash ${r.hash}). Ya puedes continuar con la siguiente fase.`
    : `FORJA: la aprobación de ${kind} NO se registró: ${r.reason}. Díselo al usuario y corrige el motivo.`,
);
process.exit(0);
