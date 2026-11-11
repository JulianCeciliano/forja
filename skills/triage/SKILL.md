---
name: triage
description: Enruta cualquier tarea por tipo (bug, feature, UI, infra, refactor, migración, hotfix, API de terceros, docs, spike...) y nivel (L0/L1/L2). Obligatorio solo para L1/L2 y rutas sensibles; lo trivial (≤3 archivos) arranca como L0 implícito sin triage.
argument-hint: "<descripción de la tarea>"
allowed-tools: Bash(node *forja.mjs* status --line) PowerShell(node *forja.mjs* status --line) Bash(node .forja/forja.mjs level *) Bash(node .forja/forja.mjs done) PowerShell(node .forja/forja.mjs level *) PowerShell(node .forja/forja.mjs done)
---

# Triage — qué ruta y cuánto proceso

Estado: !`node "${CLAUDE_PLUGIN_ROOT}/scripts/forja.mjs" status --line`

Más proceso = más tokens: el nivel más bajo que no arriesgue calidad. L0 implícito: la primera edición sin nivel lo asigna (≤3 archivos); exige triage tocar migraciones, Policies, routes, auth, middleware, CI o Docker, o pasar de 3 archivos.

| Nivel | Señales | Ruta |
|---|---|---|
| L0 | ≤3 archivos, sin datos/auth/pagos/rutas nuevas | editar directo; el hook Stop verifica |
| L1 | 1 módulo, ≤8 archivos, sin riesgo de datos/seguridad | `plan.md` ligero → aprobar → `/forja:build` → `/forja:verify` |
| L2 | auth, pagos, permisos, datos reales, >8 archivos, requisitos poco claros | `/forja:idea` → `/forja:design` → `/forja:build` → `/forja:verify` → `/forja:ship` |

## Ruta por tipo de tarea
| Tipo | Ruta |
|---|---|
| Sistema nuevo desde cero | `/forja:init`; después cada feature del backlog por triage |
| Proyecto existente que adopta Forja | `/forja:init` (modo adopción) |
| Idea difusa | `/forja:brainstorm`, luego vuelve aquí |
| Bug | `/forja:debug` (L0 si ≤3 archivos; si toca datos o auth, L1+) |
| Feature | L0/L1/L2 según la tabla |
| UI nueva o rediseño | L1/L2 + skill `frontend` (+ `/forja:visual-ref` si hay referencias, la corre el usuario); estados de UI en la spec |
| Infra, despliegue, CI | L2 + `/forja:infra` (la corre el usuario); `security` en verify |
| Auditoría de seguridad | `/forja:security-audit` (la corre el usuario); solo informe en `docs/`; cada arreglo es una tarea triageada aparte |
| QA, rendimiento, accesibilidad | skill `qa` (agente `qa`); sin nivel si no edita código |
| Refactor sin cambio de comportamiento | L1; test de caracterización antes, mismos tests verdes después, sin mezclar features |
| Migración de datos | L2 + `/forja:infra`; dry-run, backup, rollback, idempotente; nunca `migrate:fresh` |
| Actualizar dependencias o versión de Laravel/Inertia | L1 (L2 si es salto mayor); rama propia, guía de upgrade vía Search Docs de Boost, un salto a la vez, suite completa antes y después, `qa` si cambia el front |
| Hotfix en producción | `/forja:debug` + L0/L1 mínimo; test de regresión, sin refactor, PR directo con `/forja:ship` |
| Integración con API de terceros | L1 (L2 si son pagos o webhooks) + `backend` y `test`; fakes en tests, firma e idempotencia en webhooks, secretos solo por `.env`; `security` en verify |
| Solo documentación | sin nivel: editar `docs/` o README directo |
| Spike o prototipo desechable | `level L1 spike-<slug>` en rama `spike/<slug>`; conclusiones en `docs/specs/<slug>/spike.md`; el código no se mergea, adoptarlo es otra tarea |

Skills que solo escribe el usuario (el modelo no puede invocarlas; pídeselo): `/forja:init`, `/forja:infra`, `/forja:visual-ref`, `/forja:security-audit`, `/forja:approve`, `/forja:ship`, `/forja:retro`.

## Pasos
1. Si hay `docs/specs/*/brainstorm.md` de esta tarea, parte de su nivel sugerido. Si no puedes decir en 2 frases qué, para quién y cómo se verifica, recomienda `/forja:brainstorm`.
2. Lee la tarea ($ARGUMENTS). Mira como máximo 2–3 archivos o delega en `explorer`.
3. Elige tipo y nivel; ante la duda, el más alto. Pregunta con AskUserQuestion solo si la duda es real.
4. Registra: `node .forja/forja.mjs level L0` o `level L1|L2 <slug>` (crea `docs/specs/<slug>/`).
5. Responde en 2 líneas: tipo, nivel y siguiente paso.

## Reglas
- Nunca bajes de nivel una feature activa; si crece, sube (`level L2 <mismo-slug>`). Si el hook bloquea por "L0 permite como máximo 3 archivos", reclasifica.
- Terminada: `node .forja/forja.mjs done`.
