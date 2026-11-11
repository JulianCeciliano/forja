// PreToolUse (Bash y PowerShell): guardas deterministas. Ambas herramientas traen el comando en tool_input.command.
//  1) Comandos destructivos (git push --force, reset --hard, rm -rf / Remove-Item -Recurse fuera de carpetas de build, migrate:fresh, iwr|iex...).
//  2) El modelo no puede aprobar ni tocar el estado desde la shell.
//  3) Subagentes de solo lectura (validator, security, explorer, qa): solo comandos de lectura/test.
import { agentIn, block, hasForja, loadConfig, projectDir, readInput } from './lib.mjs';

const input = readInput();
const root = projectDir(input);
if (!hasForja(root)) process.exit(0);

const cfg = loadConfig(root);
const cmd = String((input.tool_input || {}).command || '');
if (!cmd.trim()) process.exit(0);
const isPS = input.tool_name === 'PowerShell';

// --- 2) estado y aprobaciones ---
if (/forja\.mjs\s+approve\b/.test(cmd)) {
  block('FORJA: las aprobaciones las da el usuario escribiendo /forja:approve spec|plan. No las ejecutes tú.');
}
if (/forja\.mjs[^|;&]*--force\b/.test(cmd)) {
  block('FORJA: --force es solo para el usuario.');
}
const WRITERS = [
  '>', '\\btee\\b', 'tee-object', '\\bsed\\s+-i', '\\bmv\\b', '\\bcp\\b', '\\brm\\b', '\\btruncate\\b', 'writeFile', 'writeAll',
  '\\bpython', 'set-content', '\\bsc\\b', 'out-file', 'add-content', '\\bac\\b', 'clear-content', '\\bclc\\b',
  'remove-item', '\\bri\\b', 'move-item', '\\bmi\\b', 'copy-item', '\\bcpi\\b', '\\bcopy\\b', '\\bmove\\b', '\\bdel\\b',
  '\\berase\\b', 'rename-item', '\\brni\\b', 'new-item', 'set-item', '\\[io\\.file\\]', 'fs\\.write', 'openwrite',
];
if (/state\.json/i.test(cmd) && new RegExp(`(${WRITERS.join('|')})`, 'i').test(cmd)) {
  block('FORJA: .forja/state.json no se modifica a mano. Usa: node .forja/forja.mjs level <L0|L1|L2> <slug>');
}

// --- 1) comandos destructivos ---
// Rutas seguras de borrado recursivo (se normaliza \ a / y se quita ./).
const SAFE_RM = /^(node_modules|vendor|dist|build|coverage|\.next|\.turbo|\.vite|public\/build|bootstrap\/cache|storage\/framework\/(cache|views|sessions)|\.forja\/tmp)\/?$|^\/tmp\//;
const cleanTarget = (t) => t.replace(/^["']|["']$/g, '').replace(/\\/g, '/').replace(/^(\.\/)+/, '');
const targetsSafe = (targets) =>
  targets.length > 0 && targets.every((raw) => {
    const t = cleanTarget(raw);
    return !t.split('/').includes('..') && SAFE_RM.test(t);
  });
const RM_MSG = 'FORJA: borrado recursivo solo sobre carpetas de build (node_modules, vendor, dist, build, coverage...). Pide confirmación al usuario.';

const rmMatch = cmd.match(/\brm\s+((?:-[a-zA-Z]+\s+)+)([^|;&]*)/);
const rmRf = !!rmMatch && /[rR]/.test(rmMatch[1]) && /[fF]/.test(rmMatch[1]);
if (rmRf) {
  const targets = rmMatch[2].trim().split(/\s+/).filter(Boolean);
  if (!targetsSafe(targets)) block(RM_MSG);
}
// PowerShell / cmd: Remove-Item (ri, rm, rmdir, rd, del, erase) con -Recurse, o rd/rmdir/del con /s.
for (const seg of cmd.split(/&&|\|\||;|\||\n/).map((s) => s.trim().replace(/^&\s*/, '')).filter(Boolean)) {
  let tokens = seg.split(/\s+/);
  // powershell -Command "Remove-Item ..." / cmd /c "rd /s ...": evalúa el comando interior
  if (/^(powershell|pwsh|cmd)(\.exe)?$/i.test(tokens[0])) {
    const i = tokens.findIndex((t, k) => k > 0 && /^["']?(remove-item|ri|rm|rmdir|rd|del|erase)$/i.test(t));
    if (i < 0) continue;
    tokens = tokens.slice(i);
    tokens[0] = tokens[0].replace(/^["']/, '');
  }
  const head = tokens[0].toLowerCase();
  if (!/^(remove-item|ri|rm|rmdir|rd|del|erase)$/.test(head)) continue;
  const rest = tokens.slice(1);
  const recurse = rest.some((t) => /^-r(e(c(u(r(s(e)?)?)?)?)?)?(:.*)?$/i.test(t)) || rest.some((t) => /^\/s$/i.test(t));
  if (!recurse || (head === 'rm' && rmRf)) continue; // rm -rf ya se evaluó arriba
  const targets = [];
  for (let i = 0; i < rest.length; i++) {
    if (/^-(path|literalpath)$/i.test(rest[i])) { if (rest[i + 1]) targets.push(rest[++i]); continue; }
    if (/^-[a-z]/i.test(rest[i]) || /^\/[a-z]$/i.test(rest[i])) continue;
    targets.push(rest[i]);
  }
  if (!targetsSafe(targets)) block(RM_MSG);
}
if (/\bgit\s+push\b[^|;&]*(\s--force\b|\s-f\b)(?!-with-lease)/.test(cmd)) {
  block('FORJA: git push --force bloqueado. Usa --force-with-lease solo si el usuario lo pide.');
}
if (/\bgit\s+reset\s+--hard\b/.test(cmd) || /\bgit\s+clean\s+-[a-z]*f/.test(cmd) || /\bgit\s+branch\s+-D\b/.test(cmd)) {
  block('FORJA: comando git destructivo bloqueado (reset --hard / clean -f / branch -D). Pregunta al usuario.');
}
if (/artisan\s+(migrate:fresh|migrate:reset|db:wipe)\b/.test(cmd) && !/(APP_ENV=testing|--env[= ]testing|\$env:APP_ENV\s*=\s*['"]?testing)/i.test(cmd)) {
  block('FORJA: migrate:fresh / migrate:reset / db:wipe solo con APP_ENV=testing o --env=testing.');
}
if (/\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(ba|z)?sh\b/.test(cmd)) {
  block('FORJA: no se ejecutan scripts descargados con curl|sh.');
}
// PowerShell: descargar y ejecutar (iwr|iex, iex (irm ...), DownloadString), comandos codificados, formateo de discos.
if (/\b(iex|invoke-expression)\b/i.test(cmd) && /\b(iwr|irm|invoke-webrequest|invoke-restmethod|curl|wget|downloadstring|downloadfile|webclient)\b/i.test(cmd)) {
  block('FORJA: no se ejecutan scripts descargados (iwr|iex).');
}
if (/\b(powershell|pwsh)(\.exe)?\b[^|;&]*\s-(e|ec|en|enc|enco\w*|encodedcommand)\s/i.test(cmd)) {
  block('FORJA: no se ejecutan comandos PowerShell codificados (-EncodedCommand).');
}
if (/\b(format-volume|clear-disk|remove-partition|initialize-disk)\b/i.test(cmd) || /\bformat\s+[a-z]:/i.test(cmd)) {
  block('FORJA: comando de disco bloqueado.');
}

// --- 3) subagentes de solo lectura ---
if (agentIn(input, cfg.readOnlyAgents)) {
  const agent = input.agent_type;
  // curl/wget solo para GET a la app local (QA); nada que escriba archivos ni envíe datos.
  const localGet = (s) =>
    /^curl\b/.test(s) &&
    /\bhttps?:\/\/(localhost|127\.0\.0\.1|\[::1\]|[\w-]+\.test)(:\d+)?(\/|\s|$)/.test(s) &&
    !/\s(-X|--request|-d|--data\S*|-F|--form\S*|-T|--upload-file|-o|-O|--output|--remote-name|-K|--config|-u)\b/.test(s);
  const RO_ALLOW = [
    /^git\s+(-C\s+\S+\s+|--no-pager\s+)*(status|diff|log|show|blame|ls-files|rev-parse|remote\s+-v|branch\s+(--show-current|-v|--list))\b/,
    /^(ls|cat|head|tail|wc|grep|rg|pwd|echo|stat|file|tree|which|basename|dirname|sort|uniq|diff|jq|date|true|cd|findstr|where|php\s+(-v|--version)|npm\s+(-v|--version))\b/,
    /^find\b(?!.*(-exec|-delete|-ok))/,
    /^sed\b(?!.*\s-i)/,
    /^php\s+artisan\s+(test|route:list|about|list|model:show|db:show|--version)\b/,
    /^(\.\/)?vendor\/bin\/(pest|phpunit|phpstan|pint\b.*--test)\b/,
    /^php\s+(\.\/)?vendor\/bin\/(pest|phpunit|phpstan|pint\b.*--test)\b/,
    /^(npx|pnpm|yarn)\s+(tsc|vitest|eslint|prettier\b.*--check)\b/,
    // pruebas de navegador (QA): solo ejecutar la suite, nunca install/codegen/show-report (abren servidores o descargan)
    /^(npx|pnpm|yarn)\s+playwright\s+(test|--version)\b/,
    /^(\.\/)?node_modules\/\.bin\/(tsc|vitest|playwright|eslint)\b/,
    /^npm\s+(test|run\s+(test|lint|types|typecheck|e2e))\b/,
    /^playwright-cli\b/,
    /^composer\s+(show|validate|outdated|audit)\b/,
    /^node\s+(--version|-v|\.forja\/forja\.mjs\s+(status|metrics))\b/,
    localGet,
    ...cfg.extraReadOnlyCommands.map((s) => new RegExp(s)),
  ];
  // Equivalentes de lectura en PowerShell (sin Where-Object/ForEach-Object: ejecutan bloques de script).
  const PS_ALLOW = [
    /^(set-location|get-command|get-filehash|convertfrom-json|get-content|get-childitem|get-item|get-location|get-date|select-string|test-path|measure-object|select-object|sort-object|resolve-path|split-path|join-path|write-output|write-host)\b/i,
    /^(gc|gci|gi|gl|sls|ls|dir|cat|type|pwd|select|measure|sort|echo)\b/i,
  ];
  // Quita redirecciones inocuas y busca escrituras o sustituciones de comandos.
  const stripped = cmd.replace(/\d?>\s*&\d|&>\s*\/dev\/null|\d?>\s*\/dev\/null|\d?>\s*\$null/gi, '');
  if (/>/.test(stripped) || /\$\(|`/.test(stripped) || (isPS && /[{}]|\$env:|;\s*&/.test(stripped))) {
    block(`FORJA: ${agent} es de solo lectura: sin redirecciones, sustitución de comandos ni bloques de script.`);
  }
  if (/\bsort\b[^|;&]*\s-o\b|--output\b|--pre\b|-fprint|\btree\b[^|;&]*\s-o\b/i.test(stripped)) {
    block(`FORJA: ${agent} es de solo lectura: sin opciones que escriben archivos (sort -o, --output...).`);
  }
  const segments = cmd.split(/&&|\|\||;|\||\n/).map((s) => s.trim()).filter(Boolean);
  const allowed = (s) => {
    const n = s.replace(/\\/g, '/');
    const tests = isPS ? [...RO_ALLOW, ...PS_ALLOW] : RO_ALLOW;
    return tests.some((re) => (typeof re === 'function' ? re(s) : re.test(n)));
  };
  const denied = segments.find((s) => !allowed(s));
  if (denied) {
    block(`FORJA: ${agent} es de solo lectura; comando no permitido: "${denied.slice(0, 80)}". Devuelve el hallazgo al orquestador.`);
  }
}
process.exit(0);
