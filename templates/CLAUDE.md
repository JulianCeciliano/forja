<!-- forja:start -->
# Forja
Flujo con hooks que imponen aprobaciones y tests (Bash y PowerShell). Estado: `node .forja/forja.mjs status`. Nunca edites `.forja/state.json`; las aprobaciones (`/forja:approve spec|plan`) las escribe solo el usuario.

## Qué skill usar (una dueña por fase; ante la duda, `/forja:triage`)
- Sin código previo o adopción de un sistema existente: `/forja:init` · idea difusa: `/forja:brainstorm` · bug: `/forja:debug`
- Cambio pequeño (≤3 archivos): editar directo, la primera edición asigna L0 sin triage. Rutas sensibles (migraciones, Policies, routes, auth, middleware, CI, Docker) exigen `/forja:triage`.
- Feature L1/L2: `/forja:triage` → idea/design/build/verify/ship. Tareas = rebanadas verticales de 15–30 min (3–6 por feature).

## Comandos del proyecto (ajústalos)
- PHP: `php artisan test` · `vendor/bin/pint` · JS: `node_modules/.bin/tsc --noEmit` · `node_modules/.bin/vitest run`

## Ahorro de tokens
- Orientarte: grafo (`graphify-out/`) o explorer antes de leer archivos sueltos. Subagentes responden ≤10 líneas; el detalle va a un archivo en `docs/specs/<feature>/`.
- `/clear` entre features. Salida de comandos acotada (`--filter`, `| tail -40`).

## Trampas del repo
Van en `.ai/rules` (Boost, herramienta `record-rule`): solo se cargan para las rutas que aplican. No las acumules aquí.

## Compact instructions
Al compactar conserva: feature activa y nivel, rutas de spec/plan, tareas hechas y pendientes, fallos de test sin resolver y decisiones aprobadas. Descarta logs y salidas de comandos.
<!-- forja:end -->
