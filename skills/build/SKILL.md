---
name: build
description: "Plan y construcción (L1 y L2): redacta plan.md en rebanadas verticales, pide su aprobación y lo ejecuta con TDD, en línea (L1) o con un subagente builder por rebanada (L2)."
argument-hint: "<slug de la feature, opcional>"
allowed-tools: Bash(node *forja.mjs* status --line) PowerShell(node *forja.mjs* status --line)
---

# Plan y construcción

Estado: !`node "${CLAUDE_PLUGIN_ROOT}/scripts/forja.mjs" status --line`

Exige L1 o L2; L2 además spec aprobada. Funciona completa por sí sola.

## A. Plan (si `plan.md` no está aprobado)
1. Redacta `docs/specs/<slug>/plan.md` (L1: formato de `plan-lite.md`) desde la plantilla: **rebanadas verticales** de 15–30 min, 3–6 por feature; cada una atraviesa datos, backend y UI y demuestra un criterio de aceptación. Sin código pegado: rutas, contrato (entradas/salidas, rutas HTTP, props) y el test que lo prueba.
2. Si ya hay `design.md` o spec, no repitas el diseño. Anota en cada rebanada qué skill de dominio aplica (`backend`, `frontend`, `test`).
3. Pide: "Revisa `plan.md` y escribe `/forja:approve plan`." y detente.

## B. Ejecución (plan aprobado)
Crea o cambia a la rama `feat/<slug>`.

- **L1, en línea**: ejecuta las rebanadas tú mismo con TDD (RED → GREEN → refactor); carga `backend`/`frontend`/`test` cuando la rebanada lo toque. Un commit por rebanada.
- **L2, subagente por rebanada**: delega en **forja:builder** pasando solo la ruta de `plan.md` y el id `S<n>`; pide commit y resumen ≤10 líneas (cambios, test, desviaciones). Cada builder arranca en frío: por eso son rebanadas y no micro-tareas. Siempre en secuencia, en el árbol principal. No uses `isolation: worktree` salvo que el usuario lo pida: un worktree nuevo no trae `vendor/` ni `node_modules/`, así que el hook verify no encuentra checks y pasa en vacío; si el usuario lo exige, verifica tú tras integrar en el árbol principal (Stop real o `/forja:verify`).

## Ahorro
- No leas diffs ni logs largos: confía en el resumen y en los hooks (Stop y SubagentStop verifican).
- Si el hook reporta fallos, corrígelos antes de seguir.
- Al terminar: `/forja:verify`.
