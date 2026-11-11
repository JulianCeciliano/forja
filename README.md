# Forja

Flujo de desarrollo con AI para **Claude Code**, pensado para Laravel + React (Inertia) y para gastar pocos tokens sin perder calidad. Es un plugin delgado: la sesión principal es el orquestador, los subagentes hacen trabajo aislado y **los hooks (no el modelo) imponen lo que no puede fallar**: aprobaciones humanas, tests verdes antes de terminar y guardas contra comandos destructivos.

> Estado: 0.3.0. Cubierto por pruebas automáticas (`node --test tests/`) y `claude plugin validate`. **No** se ha probado aún en una sesión viva con modelo: ver [Primera sesión: smoke test](#primera-sesión-smoke-test). No hay cifras de ahorro medidas: ver [Experimento A/B](#experimento-ab-medir-el-ahorro-real).

## Instalación

```bash
# Desde un clon, en la raíz de tu proyecto Laravel (macOS, Linux o Git Bash en Windows)
/ruta/a/forja/install.sh --full

# Sin clonar (tras publicar el repo en GitHub)
curl -fsSL https://raw.githubusercontent.com/JulianCeciliano/forja/main/install.sh | FORJA_REPO=JulianCeciliano/forja bash -s -- --full

# Proyecto nuevo (React + Inertia, SQLite, npm y Boost, sin preguntas)
./install.sh --new mi-app --full

# Ver qué haría, sin ejecutar nada
./install.sh --full --dry-run
```

Es idempotente: repítelo para actualizar. Qué instala siempre: la capa de archivos (`.forja/`, bloque en `CLAUDE.md`, `.claude/settings.json`), el plugin `forja` y Laravel Boost (salvo `--no-boost`).

| Opción | Qué hace | Comando exacto |
|---|---|---|
| `--full` | Atajo recomendado: Boost + `--with-mcp` + `--with-playwright` + `--with-lsp` + `--with-frontend-design`. **No** incluye superpowers, caveman ni graphify | (suma los de abajo) |
| `--with-mcp` | Context7 y Chrome DevTools MCP | `claude mcp add --scope project --transport http context7 https://mcp.context7.com/mcp` (forma remota de la doc de Context7; sin API key, con clave añade `--header`) y `claude mcp add --scope project chrome-devtools -- npx -y chrome-devtools-mcp@latest` (la forma `npx` genérica de su README; también tiene plugin propio). En Windows nativo, si un MCP con `npx` no conecta, la doc de Context7 usa `cmd /c npx ...`; **no está confirmado en la doc de Claude Code**, por eso el instalador no lo aplica y solo avisa |
| `--with-playwright` | Playwright CLI + skills (lo que prefiere el agente `qa`) | `npm install -g @playwright/cli@latest`, `playwright-cli install --skills`, `playwright-cli install-browser chromium` (este último no aparece en el README de `@playwright/cli`: si falla, el instalador solo avisa; usa un Chrome instalado con `playwright-cli open --browser=chrome`) |
| `--with-playwright-mcp` | Además, Playwright MCP (exploración larga con estado) | `claude mcp add --scope project playwright -- npx @playwright/mcp@latest` |
| `--with-lsp` | Code intelligence (diagnósticos tras editar y navegación por símbolo, menos lecturas de archivos) | `npm install -g intelephense`, `npm install -g typescript-language-server typescript`, `claude plugin install php-lsp@claude-plugins-official --scope user`, `claude plugin install typescript-lsp@claude-plugins-official --scope user` |
| `--with-frontend-design` | Plugin oficial de Anthropic para UI con criterio de diseño | `claude plugin install frontend-design@claude-plugins-official --scope project` |
| `--with-graphify` | Grafo del código (opt-in) | `pipx install graphifyy`, `graphify claude install`, `graphify hook install`, `graphify update .` |
| `--with-caveman` | Respuestas más cortas (opt-in) | `claude plugin marketplace add JuliusBrussee/caveman` + `claude plugin install caveman@caveman` |
| `--with-superpowers` | Superpowers (opt-in) | `claude plugin install superpowers@claude-plugins-official --scope project` |
| `--boost-update-hook` | Añade `@php artisan boost:update --ansi` a `post-update-cmd` de `composer.json` (opt-in; reescribe `composer.json` con 4 espacios) | edición JSON por `scripts/install-files.mjs` |
| `--new NOMBRE` | Proyecto nuevo | `laravel new NOMBRE --database=sqlite --react --npm --boost --no-interaction` |
| `--no-boost`, `--files-only`, `--dry-run` | Sin Boost / solo archivos / solo mostrar | |

`--no-superpowers` sigue aceptándose pero está obsoleto y no hace nada.

**Por qué Superpowers es opt-in:** inyecta su skill completa en cada sesión y ordena invocar skills "ante un 1% de probabilidad", lo que choca con la regla de Forja de una skill dueña por fase y cuesta tokens en cada turno.

**Graphify y Caveman** siguen siendo opt-in: prometen ahorro, pero no hay medición propia aquí. Actívalos solo si el [A/B](#experimento-ab-medir-el-ahorro-real) te lo confirma en tu proyecto.

### Laravel Boost

`php artisan boost:install` es interactivo. El instalador lo lanza solo si hay terminal (también en `curl | bash`, conectándolo a `/dev/tty`); sin terminal no se cuelga: avisa y deja el comando para que lo ejecutes tú. En el asistente elige Claude Code y **instala las skills** (se cargan bajo demanda; las guías se cargan siempre).

- Mantén Boost al día con `php artisan boost:update`; si quieres automatizarlo, `--boost-update-hook` lo añade a `post-update-cmd` (no se impone).
- **Las trampas del repo van en las reglas de proyecto de Boost** (`.ai/rules`, herramienta `record-rule`: "recuerda que el dinero va en centavos enteros"), no en `CLAUDE.md`: cada regla declara los globs a los que aplica y solo se lee al tocar esas rutas. Para un sistema existente, la skill `infer-conventions` de Boost las deduce del código. Registra las reglas con `record-rule`, no a mano (el índice se regenera al registrarlas).

## Flujo: qué skill según el caso

`/forja:triage` es un enrutador por tipo de tarea. Ante la duda, empieza ahí.

| Caso | Ruta |
|---|---|
| Sistema nuevo desde cero | `/forja:init` (genera `docs/system/overview.md` y backlog) → features con `/forja:triage` |
| Adoptar un sistema existente | `/forja:init` (mapea el sistema → `docs/system/overview.md` + backlog) |
| Idea difusa | `/forja:brainstorm` → `/forja:triage` |
| Bug | `/forja:debug` (reproducir, aislar, corregir con test) |
| Feature pequeña (L0: ≤3 archivos, rutas no sensibles) | editar directo: la primera edición asigna L0 sin triage; el hook Stop verifica |
| Feature mediana (L1) | `/forja:triage` → plan ligero → aprobar → `/forja:build` → `/forja:verify` |
| Feature grande o riesgosa (L2) | `/forja:idea` → `/forja:design` → `/forja:build` → `/forja:verify` → `/forja:ship` (spec y plan aprobados) |
| UI / rediseño con referencias | `visual-ref` (referencias de otros sitios con el navegador) + `frontend` (+ plugin `frontend-design` si lo instalaste) |
| Infra / despliegue | skill `infra` |
| Auditoría de seguridad de toda la app | skill `security-audit` (agente `security`) |
| QA de navegador (E2E, consola, red, rendimiento, accesibilidad) | skill `qa` (agente `qa`) |
| Refactor | `/forja:triage`; skills `backend`/`frontend` y `test`; verify exige tests verdes |
| Migración de datos | rutas sensibles: exige `/forja:triage` (L1/L2), plan con rollback |
| Actualización de dependencias | `/forja:triage`; verify completo (pint, tests, tsc, vitest) |
| Hotfix | `/forja:debug` + L0 si cabe; si toca ruta sensible, `/forja:triage` y `/forja:ship` |
| Integración de terceros | L1/L2; Context7 para la doc vigente de la librería y skill `backend` |

Skills de flujo (11): `triage`, `brainstorm`, `idea`, `design`, `build`, `verify`, `debug` (las invoca también el modelo) y `ship`, `approve`, `retro`, `init` (solo el usuario). De dominio (7): `backend`, `frontend`, `test`, `qa` (las invoca el modelo) e `infra`, `visual-ref`, `security-audit` (solo el usuario: `/forja:infra`, etc.). Las de solo usuario tienen `disable-model-invocation: true`: no cuestan tokens en el listado y ninguna otra skill ni agente puede invocarlas. Agentes (6): `explorer`, `designer`, `builder`, `validator`, `security`, `qa`.

| Nivel | Cuándo | Aprobaciones |
|---|---|---|
| **L0** | cambio de ≤3 archivos, sin rutas sensibles | ninguna (implícito, sin triage) |
| **L1** | feature mediana, 1 módulo | plan |
| **L2** | grande o riesgosa | spec + plan |

Las tareas del plan son **rebanadas verticales de 15–30 minutos** (3–6 por feature), cada una con su test.

`/forja:retro` al cerrar: mide tokens reales, fusiona la spec en `docs/system/` y propone ≤3 mejoras.

## Herramientas de navegador

| Herramienta | Para qué | Coste en contexto |
|---|---|---|
| **Playwright CLI** (`@playwright/cli`) | Flujos E2E y QA: el agente ejecuta comandos de shell | Bajo: salida concisa y skills bajo demanda |
| **Playwright MCP** | Exploración larga con estado de navegador persistente | Alto: esquemas de herramientas y snapshots en contexto |
| **Chrome DevTools MCP** | Consola, red, trazas de rendimiento, depuración de la página | Medio: servidor MCP; úsalo cuando haga falta inspección |
| **Pest 4 browser tests** (`pestphp/pest-plugin-browser`) | Pruebas de navegador que se quedan en el repo como regresión, ejecutadas por `php artisan test` | Cero en sesión; son código |

**Qué usa el agente `qa`:** Playwright CLI por defecto, y Chrome DevTools MCP para consola/red/rendimiento. Motivo: la documentación de Playwright compara CLI y MCP y rate el CLI como de menor coste en tokens (el MCP mantiene esquemas y snapshots en contexto), y el README de Playwright MCP recomienda CLI + skills para agentes de código. Playwright MCP queda como opt-in para exploración larga. Las cifras de ahorro que circulan (4x, 40x) son de blogs, no de estudios controlados: no las doy por buenas; mídelo con el A/B. El agente `qa` corre en contexto aislado para que los snapshots no contaminen la sesión principal.

Para proyectos Laravel conviene además escribir los flujos críticos como tests de navegador de Pest (`composer require pestphp/pest-plugin-browser --dev`, `npm install playwright@latest`, `npx playwright install`; añade `tests/Browser/Screenshots` y `tests/Browser/Traces` a `.gitignore`). Forja no lo instala por ti. Nota: la página de docs que consulté correspondía a la rama 5.x de Pest; comprueba la versión que usas.

## Qué hace cada hook (harness-only: cero tokens de contexto)

| Evento | Script | Función |
|---|---|---|
| UserPromptSubmit | `prompt-submit` | Registra `/forja:approve spec\|plan` leyendo lo que escribió el usuario; el modelo no puede aprobar |
| PreToolUse Edit/Write/NotebookEdit | `gate` | **L0 implícito**: sin triage, la primera edición de código asigna L0 (máx. 3 archivos). Rutas sensibles (migraciones, Policies, routes, auth, middleware, CI, Docker) exigen `/forja:triage`. Editar la spec/plan tras aprobar la invalida; no se aprueba una plantilla sin rellenar; `.env`, `.forja/` (estado, config, lib, CLI) y `.claude/settings*.json` protegidos frente al agente; agentes de solo lectura y `designer` solo escriben bajo `docs/` |
| PreToolUse Bash / PowerShell | `bash-guard` | Bloquea `push --force`, `reset --hard`, `clean -f`, `branch -D`, `rm -rf`/`Remove-Item -Recurse` fuera de carpetas de build, `migrate:fresh`/`reset`/`db:wipe` sin `APP_ENV=testing`, `curl\|sh`, `iwr\|iex`, `-EncodedCommand`, formateo de discos, `forja.mjs approve` y escrituras a `state.json`, en Bash **y PowerShell**; los subagentes de solo lectura (`readOnlyAgents`: validator, security, explorer, qa) solo ejecutan comandos de lectura/test (git, ls/cat/grep/rg, `artisan test`, pint `--test`, tsc, vitest, playwright, equivalentes de PowerShell) |
| PostToolUse Edit/Write | `format` | **Inerte** salvo `"formatMode": "edit"` en `.forja/config.json` (formatea tras cada edición; obliga a releer archivos, por eso no es el defecto) |
| Stop | `verify`, `metrics` | pint `--test` + tests + tsc + vitest solo si cambió código (sin commitear o commiteado desde la última verificación que pasó, aunque el árbol esté limpio); con `formatMode: "stop"` (defecto) formatea antes los archivos cambiados con pint/prettier; ≤40 líneas de log; corta bucles tras `maxFailLoops` (3) intentos; si el mismo código ya falló no repite el bloqueo en un turno nuevo |
| SubagentStop | `verify`, `metrics` | `verify` corre también al terminar los agentes de `verifyAgents` (por defecto `builder`); `metrics` registra tokens reales del transcript en `.forja/metrics.jsonl` |
| SessionStart | `session-start` | 1–2 líneas de estado; L0 no se hereda entre sesiones; funciona en worktrees |

Los hooks de Edit/Write no vigilan la shell: un comando de Bash o PowerShell que escriba código (`sed -i`, `>`, `tee`) **no pasa por la puerta de aprobaciones** (ver [Modelo de confianza](#modelo-de-confianza-límites-honestos)). La tabla refleja el contrato de 0.3.0; los detalles finos viven en `hooks/` y se comprueban con `tests/hooks.test.mjs`.

## Diseño para gastar pocos tokens

- **Lo que se carga siempre** es pequeño: el bloque de `CLAUDE.md` (~21 líneas) y las descripciones de skills/agentes. Mídelo con `claude plugin details forja` (línea `Always-on` y filas por componente); no hay cifras fijadas aquí porque cambian con cada versión.
- Triage enruta por tipo de tarea: lo trivial no paga spec, plan ni subagentes.
- Subagentes solo donde rinden (exploración, validación, seguridad, QA en contexto aislado); respuestas ≤10 líneas, el detalle va a archivos en `docs/specs/<feature>/`.
- `verify` cachea una huella del código: sin cambios no repite checks.
- Una skill dueña por fase: por eso Superpowers es opt-in.
- Code intelligence (`--with-lsp`): según la [guía de costes de Claude Code](https://code.claude.com/docs/en/costs), reduce lecturas de archivos.
- `.claude/settings.json` instalado: deniega secretos, permite sin preguntar solo `pint --test`, `php artisan test`, `tsc --noEmit`, `vitest run` y `forja status/metrics` (en sintaxis Bash y PowerShell; reglas exactas en `templates/settings.json`). Ya **no** deniega leer `node_modules` (los tipos de una librería son necesarios al depurar; las instalaciones anteriores pierden esa regla al actualizar).
- Ver el consumo real: `node .forja/forja.mjs metrics` y `/usage`.

## Modelo de confianza (límites honestos)

Los hooks son **guardarraíles contra la deriva del modelo, no una frontera de seguridad** contra un agente hostil: `bash-guard` es heurístico (regex) y el nivel L0 lo fija el propio modelo (acotado a 3 archivos y a rutas no sensibles). Para secretos y estado usa además las reglas `deny` instaladas. Límites conocidos: la puerta de aprobaciones solo vigila Edit/Write/NotebookEdit, no la shell (un `sed -i` o `> archivo` desde Bash/PowerShell escribe código sin aprobaciones; `bash-guard` solo cierra las escrituras a `state.json`); el agente `qa` puede ejecutar `playwright-cli` completo (incluida evaluación de scripts de página y capturas a cualquier ruta) porque lo necesita para probar; y un worktree enlazado sin `vendor/`/`node_modules/` verifica en vacío. Las aprobaciones solo se registran desde el texto del usuario o desde `! node .forja/forja.mjs approve ...` en tu terminal. Los plugins de terceros (Superpowers, Caveman, MCP) ejecutan código o instrucciones con tus permisos: revísalos antes de activarlos.

## Configuración

`.forja/config.json` (plantilla `templates/forja.config.json`; todo lo que falte usa el defecto de `hooks/lib.mjs`): `enforceTriage`, `protectedPaths`, `protectedExclude`, `sensitivePaths`, `neverEdit`, `l0MaxFiles`, `checks` (`null` = autodetección; o lista `{name, cmd, when}` / `{name, cmd, args, when}`), `checkTimeoutSec`, `verifyTimeoutSec` (presupuesto total de verify; el timeout de 1800 s de `hooks.json` debe superarlo), `maxFailLoops`, `outputMaxLines`, `outputMaxChars`, `formatMode` (`stop` | `edit` | `off`), `readOnlyAgents` (validator, security, explorer, qa), `docsOnlyAgents` (designer), `verifyAgents` (builder), `extraReadOnlyCommands`. Patrones de ruta: terminan en `/` = prefijo, con `*` = glob sobre la ruta entera, si no = archivo exacto. **Al reinstalar solo se añaden claves que faltan; una clave que ya tenías se conserva tal cual, incluidas las listas** (un `protectedPaths` antiguo no recibe las rutas nuevas de los defectos: bórralo de `.forja/config.json` y reinstala para adoptarlos). Los modelos de cada agente están en `agents/*.md`: ajústalos según `/usage`. `node .forja/forja.mjs status --line` imprime el estado en una línea. Comandos del CLI: `status [--line]`, `level <L0|L1|L2> [slug] [--force]`, `approve <spec|plan>`, `done`, `metrics`. Las skills inyectan el estado con el CLI del plugin (`${CLAUDE_PLUGIN_ROOT}/scripts/forja.mjs`), que no falla aunque `.forja/` no exista.

## Primera sesión: smoke test

Estos puntos dependen del comportamiento de Claude Code en vivo y **no se han verificado con modelo**. Compruébalos una vez:

1. `/hooks` muestra los hooks de `forja`. Si no, `claude --debug` y revisa errores de carga.
2. **L0 implícito:** sin triage, pide un cambio trivial en `app/`: debe permitirse la primera edición y asignarse L0 (`node .forja/forja.mjs status`). Pide editar una migración o `routes/`: debe bloquearse pidiendo `/forja:triage`.
3. `/forja:triage <feature grande>` → L2 → `/forja:idea` → `/forja:approve spec`: debe aparecer "spec aprobada". **Si no aparece**, el campo `prompt` del hook `UserPromptSubmit` no llegó: usa `! node .forja/forja.mjs approve spec`. Prueba también aprobar una plantilla sin rellenar: debe rechazarse.
4. **PowerShell bloqueado:** pide a Claude que ejecute `git push --force` (o `Remove-Item -Recurse -Force` fuera de build) con la herramienta PowerShell y también con Bash: ambos deben bloquearse.
5. Lanza el validator y pídele `rm algo`: debe bloquearse. Si no, el `agent_type` que recibe el hook no coincide con `validator`/`forja:validator`.
6. Al terminar el builder, `verify` debe correr en SubagentStop; al terminar un turno con código cambiado, en Stop (y aplicar pint/prettier).
7. Con `--with-playwright`: `/forja:verify` o la skill `qa` en una página local; el informe debe quedar en `docs/specs/<slug>/reviews/qa.md` con evidencia como archivos.
8. En un worktree (`claude --worktree`), el estado y los hooks deben funcionar. **Límite declarado:** un worktree nuevo no trae `vendor/` ni `node_modules/`, así que `verify` no encuentra checks y pasa en vacío; la skill `build` no usa worktrees salvo que lo pidas, y la verificación real ocurre en el Stop del árbol principal tras integrar.
9. `node .forja/forja.mjs metrics` tras una sesión debe mostrar tokens (si sale vacío, el formato del transcript difiere y hay que ajustar `hooks/metrics.mjs`).
10. Inyección de estado: las skills usan `` !`node "${CLAUDE_PLUGIN_ROOT}/scripts/forja.mjs" status --line` `` con reglas `allowed-tools` para Bash y PowerShell. Se probó una vez con `claude -p` y una skill de prueba en Windows (la shell de inyección fue PowerShell; sin la regla `PowerShell(...)` abortaba); falta confirmarlo con las skills reales y en macOS/Linux.
11. `agent_type` que reciben los hooks de subagentes (`validator`, `forja:validator`...) y que `effort` del frontmatter se aplique (con `haiku` solo vale en la API de Anthropic; en Bedrock/Vertex/Foundry el alias resuelve a Haiku 4.5, que no admite `effort`).

## Experimento A/B (medir el ahorro real)

Elige dos features equivalentes. Una con la configuración que quieres probar (por ejemplo Forja + Graphify + Caveman) y otra solo con Forja (desactiva los plugins con `/plugin` o instálalos en otra copia). Al terminar cada una compara:

- `node .forja/forja.mjs metrics` (out, in nuevo, cache_read) y `/usage`;
- `claude plugin details forja` y de cada plugin extra (coste `Always-on`);
- calidad: ¿pasaron igual los criterios de aceptación y `verify`?

Repítelo al menos dos veces: una sola ejecución tiene mucha varianza. Ninguna cifra de ahorro de este repo está medida.

## Desarrollo

```bash
node --test tests/                  # hooks, CLI e instalador
claude plugin validate .            # manifiestos
claude --plugin-dir . plugin details forja   # coste en tokens (si ya está instalado: claude plugin details forja)
```

Estructura: `skills/` (18: flujo y dominio), `agents/` (6), `hooks/` (scripts Node sin dependencias), `scripts/` (CLI e instalador de archivos), `templates/` (toda plantilla nueva se copia a `.forja/templates/`), `tests/`.
