// PostToolUse (Edit|Write): formato por edición. SOLO actúa con "formatMode": "edit" en .forja/config.json.
// Por defecto (formatMode "stop") el formato lo hace verify al terminar, solo sobre los archivos cambiados:
// formatear tras cada Edit cambia el archivo y obliga al modelo a releerlo (más tokens).
// Cero tokens: no imprime nada y nunca falla.
import fs from 'node:fs';
import path from 'node:path';
import { hasForja, loadConfig, locate, readInput, relFromRoots, realish, spawnTool } from './lib.mjs';

try {
  const input = readInput();
  const { root, work } = locate(input);
  if (!hasForja(root) || loadConfig(root).formatMode !== 'edit') process.exit(0);

  const file = (input.tool_input || {}).file_path;
  if (!file) process.exit(0);
  const abs = realish(path.resolve(work, String(file)));
  const rel = relFromRoots([work], abs);
  if (rel === null || !fs.existsSync(abs)) process.exit(0);

  const run = (argv) => spawnTool(argv, { cwd: work, timeout: 20000, stdio: 'ignore' });
  const prettierPkg = path.join(work, 'node_modules', 'prettier', 'package.json');
  if (/\.php$/.test(rel) && fs.existsSync(path.join(work, 'vendor/bin/pint'))) {
    run(['php', 'vendor/bin/pint', rel, '--quiet']);
  } else if (/\.(ts|tsx|js|jsx|css|json)$/.test(rel) && fs.existsSync(prettierPkg)) {
    const pj = JSON.parse(fs.readFileSync(prettierPkg, 'utf8'));
    const bin = path.join(work, 'node_modules', 'prettier', typeof pj.bin === 'string' ? pj.bin : pj.bin?.prettier || 'bin/prettier.cjs');
    if (fs.existsSync(bin)) run([process.execPath, bin, '--write', '--log-level', 'silent', rel]);
  }
} catch {
  /* formatear es best-effort */
}
process.exit(0);
