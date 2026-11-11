---
name: design
description: Diseño técnico de una feature L2 a partir de la spec aprobada (datos, rutas, páginas, estados de UI, autorización, riesgos), delegado en el agente designer.
argument-hint: "<slug de la feature, opcional>"
allowed-tools: Bash(node *forja.mjs* status --line) PowerShell(node *forja.mjs* status --line)
---

# Diseño técnico

Estado: !`node "${CLAUDE_PLUGIN_ROOT}/scripts/forja.mjs" status --line`

Exige L2 y spec aprobada; si no, di qué falta y detente.

1. Delega en **forja:designer** pasando rutas, no contenido:
   - Objetivo: diseño técnico de `docs/specs/<slug>/spec.md`.
   - Skills de dominio que debe cargar según la spec: `backend` (datos, rutas, validación), `frontend` (páginas y estados de UI). Si la spec pide infraestructura o referencias visuales, el designer solo lo anota: `/forja:infra` y `/forja:visual-ref` los corre el usuario.
   - Salida: `docs/specs/<slug>/design.md` (≤1.5 páginas) y resumen ≤10 líneas.
   - Límites: no implementar; escribir solo bajo `docs/`.
2. Debe cubrir: modelo de datos y migraciones (con rollback), rutas y controladores, páginas Inertia y estados (vacío, carga, error), Policies, FormRequests, requisitos de infra/seguridad aplicables y riesgos.
3. Lee solo el resumen; abre `design.md` si contradice la spec.
4. Siguiente: `/forja:build` (genera `plan.md` y pide aprobarlo).

Si el diseño revela una spec incompleta, devuélvelo al usuario; no la edites.
