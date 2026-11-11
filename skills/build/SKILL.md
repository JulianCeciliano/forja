---
name: build
description: "Plan y construcción (L1 y L2): define plan.md en rebanadas verticales, pide su aprobación y lo ejecuta con TDD delegando cada rebanada en un subagente builder."
argument-hint: "<slug de la feature, opcional>"
allowed-tools: Bash(node *forja.mjs* status --line) PowerShell(node *forja.mjs* status --line)
---

# Plan y construcción

Estado: !`node "${CLAUDE_PLUGIN_ROOT}/scripts/forja.mjs" status --line`

Exige L1 o L2; L2 además spec aprobada. Funciona completa por sí sola. El orquestador decide y delega: no escribe el plan ni el código.

## A. Plan (si `plan.md` no está aprobado)
1. El plan son **rebanadas verticales** de 15–30 min, 3–6 por feature; cada una atraviesa datos, backend y UI y demuestra un criterio de aceptación. Sin código pegado: rutas, contrato (entradas/salidas, rutas HTTP, props) y el test que lo prueba. Cada rebanada anota qué skill de dominio aplica (`backend`, `frontend`, `test`). Si ya hay `design.md` o spec, no se repite el diseño.
   - **L1**: decide tú las rebanadas (mira el código con `explorer` si hace falta) y dicta el contenido a **forja:fixer** para que rellene `docs/specs/<slug>/plan.md` con el formato de `plan-lite.md`.
   - **L2**: delega en **forja:designer** pasando las rutas de `spec.md` y `design.md`; escribe `docs/specs/<slug>/plan.md` desde la plantilla y responde ≤10 líneas con la lista de rebanadas.
2. Comprueba con el resumen que las rebanadas cubren los criterios de la spec; si no, pide la corrección al mismo agente.
3. Pide: "Revisa `plan.md` y escribe `/forja:approve plan`." y detente.

## B. Ejecución (plan aprobado)
Crea o cambia a la rama `feat/<slug>`.

**Un subagente por rebanada, en L1 y en L2**: delega en **forja:builder** pasando solo la ruta de `plan.md` y el id `S<n>`; pide commit y resumen ≤10 líneas (cambios, test, desviaciones). Cada builder arranca en frío: por eso son rebanadas y no micro-tareas. Siempre en secuencia, en el árbol principal. No uses `isolation: worktree` salvo que el usuario lo pida: un worktree nuevo no trae `vendor/` ni `node_modules/`, así que el hook verify no encuentra checks y pasa en vacío; si el usuario lo exige, lanza `/forja:verify` tras integrar en el árbol principal.

Si un builder reporta una desviación o que la rebanada es imposible, decide tú (replantear la rebanada, volver al plan con el usuario) antes de lanzar la siguiente.

## Ahorro
- No leas diffs ni logs largos: confía en el resumen y en los hooks (Stop y SubagentStop verifican).
- Si el hook reporta fallos al terminar tu turno, manda la corrección al builder (o a `fixer` si es trivial) antes de seguir.
- Al terminar: `/forja:verify`.
