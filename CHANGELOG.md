# Changelog

## 0.4.0
- **Agente `orchestrator`, hilo principal por defecto.** El `settings.json` del plugin fija `"agent": "orchestrator"`: piensa, clasifica, habla con el usuario y delega; no tiene `Edit`, `Write` ni `NotebookEdit` y hereda el modelo de la sesión. Los demás agentes pasan a ser sus subagentes.
- **Agente `fixer` (haiku, esfuerzo bajo):** cambios triviales L0 (≤3 archivos) y documentos que el orquestador dicta (`spec.md`, plan de L1, `brainstorm.md`, `docs/system/`).
- `gate`: clave nueva `noEditAgents` (por defecto `orchestrator`); bloquea cualquier edición de esos agentes y les indica a quién delegar. Vacíala para volver a un hilo principal que edita.
- `verify` corre también en el `SubagentStop` de `fixer` (`verifyAgents`: `builder`, `fixer`; matcher de `hooks.json` actualizado). **Instalaciones previas** conservan su `verifyAgents: ["builder"]`: añade `"fixer"` a mano en `.forja/config.json` (el Stop del hilo principal verifica de todos modos al terminar el turno).
- `build`: L1 deja de ejecutarse en línea; cada rebanada va a un `builder` en L1 y en L2. El `plan.md` lo escribe `designer` (L2) o `fixer` al dictado (L1).
- `debug`, `idea`, `brainstorm`, `init`, `triage`, `ship`, `retro`: donde antes el hilo principal escribía, ahora delega. `builder` acepta también un bug ya diagnosticado; `designer` escribe el plan de L2.
- `templates/CLAUDE.md` y el mensaje de `SessionStart` describen el reparto.
- Sin verificar en sesión viva: que `agent_type` llegue a los hooks del hilo principal con el ajuste `agent` (la doc lo confirma para `--agent`). Si no llega, la garantía es la lista de herramientas del agente.

## 0.3.0
- **Instalador:** Superpowers pasa a opt-in (`--with-superpowers`); `--no-superpowers` queda obsoleto (aviso, sin efecto). Motivo: inyecta su skill en cada sesión y choca con una skill dueña por fase.
- Opciones nuevas: `--full` (Boost, MCP, Playwright, LSP, frontend-design; sin superpowers/caveman/graphify), `--with-lsp` (php-lsp y typescript-lsp + intelephense y typescript-language-server), `--with-frontend-design`, `--with-playwright-mcp`, `--boost-update-hook`.
- Playwright CLI es lo que usa por defecto el agente qa (menor coste en tokens según la doc de Playwright); el MCP es opt-in.
- Boost: `boost:install` solo se lanza con terminal (`/dev/tty` incluso en `curl | bash`); sin terminal avisa en vez de colgarse. Las trampas del repo se recomiendan en `.ai/rules` (`record-rule`).
- `--new` usa `laravel new NOMBRE --database=sqlite --react --npm --boost --no-interaction` (verificado en laravel.com/for/agents).
- `templates/CLAUDE.md` reducido a ~21 líneas (enrutado por skill, L0 implícito, ahorro de tokens, Compact instructions, trampas en `.ai/rules`).
- `templates/settings.json`: deniega leer secretos habituales (claves, `auth.json` de Composer, `~/.ssh`, `~/.aws`) y editar `.env*`; **ya no deniega `Read(./node_modules/**)`** (el instalador retira esa regla de instalaciones previas). `allow` acotado a lectura/verificación y en sintaxis Bash y PowerShell: `pint --test`, `php artisan test`, `tsc --noEmit`, `vitest run`, `forja status/metrics` (sin comodines que escriban, descarguen o ejecuten código arbitrario; el instalador retira los allow más amplios de borradores previos).
- `install-files.mjs`: copia cualquier plantilla de `templates/`; fusiona claves nuevas de `forja.config.json` en `.forja/config.json` sin pisar valores; une `permissions.allow`; crea `docs/system/`.
- Las skills de flujo inyectan el estado con el CLI del plugin (`node "${CLAUDE_PLUGIN_ROOT}/scripts/forja.mjs" status --line`), que no aborta la skill si `.forja/` no existe; `allowed-tools` lleva reglas `Bash(...)` y `PowerShell(...)` (en Windows la inyección usa PowerShell). `infra`, `visual-ref` y `security-audit` son solo de usuario (`disable-model-invocation`).
- El gate protege `.forja/` y `.claude/settings*.json` frente al agente; `bash-guard` bloquea opciones de escritura (`sort -o`, `--output`) a los agentes de solo lectura y acepta `git -C`/`--no-pager`, `cd` y `findstr`.
- Configuración: la plantilla incluye `neverEdit`, `outputMaxChars` y `verifyAgents`; las claves que el usuario ya tenía (incluidas listas como `protectedPaths`) se conservan al actualizar.
- `build` no usa worktrees por defecto (sin `vendor/` ni `node_modules/` verify no tiene checks).
- Contrato 0.3.0 del resto del plugin (hooks, skills, agentes, CLI): L0 implícito, guardas para PowerShell, skills init/debug/infra/backend/frontend/visual-ref/security-audit/test/qa, agente qa, `status --line`, tareas de 15–30 min. Ver README.
- README reescrito; pruebas nuevas en `tests/install.test.mjs`.

## 0.2.0
- Nueva skill `/forja:brainstorm` (fase 0, opcional) para ideas difusas: envuelve `superpowers:brainstorming` con anulaciones (salida en `docs/specs/<slug>/brainstorm.md`, sin saltar a planes ni código) y trae versión integrada si Superpowers no está.
- `triage` detecta ideas difusas y remite a brainstorm; usa el "nivel sugerido". `idea` parte de `brainstorm.md` sin repetir preguntas.

## 0.1.0 — prototipo
- Triage por niveles L0/L1/L2 con aprobaciones humanas (spec, plan) registradas por hook.
- 8 skills (`triage`, `idea`, `design`, `build`, `verify`, `ship`, `approve`, `retro`) y 5 agentes (`explorer`, `designer`, `builder`, `validator`, `security`).
- Hooks: gate de aprobaciones, guardas de Bash (y solo lectura para revisores), formato, verificación con caché y log recortado, métricas de tokens, estado de sesión.
- Instalador idempotente (`install.sh`) con opciones para Laravel Boost, Superpowers, Graphify, Caveman, MCP y Playwright CLI.
- Pendiente: smoke test en sesión viva (ver README), versión canal `stable`/`latest` del marketplace.
