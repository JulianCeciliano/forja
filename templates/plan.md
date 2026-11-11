# Plan: <nombre de la feature>

> 3–6 rebanadas verticales de 15–30 min. Cada una atraviesa datos, backend y UI, demuestra un criterio de aceptación con un test y deja un commit. Sin código pegado: rutas, contrato y test.

## Orden y dependencias
S1 → S2 → S3 (marca con "‖" solo las que no comparten archivos)

## Rebanadas
### S1 — <resultado observable>
- Demuestra: AC<n>
- Skills: `backend` · `frontend` · `test` (las que apliquen)
- Archivos: `app/...`, `resources/js/Pages/...`, `tests/Feature/...`
- Contrato: <ruta HTTP, entradas/salidas, props de la página, estados de UI>
- Test que lo prueba (RED primero): `php artisan test --compact --filter=...`
- Commit: `feat: ...`

## Migraciones, infra y riesgos
- <migración y rollback, datos existentes, variables o servicios nuevos, permisos>

## Criterios de aceptación cubiertos
AC1 → S1, S2
