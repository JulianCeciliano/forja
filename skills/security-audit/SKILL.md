---
name: security-audit
description: "Auditoría de seguridad de toda la aplicación Laravel + Inertia + React (no solo el diff): autorización por rutas y roles, auth y sesiones, inyección, XSS, CSRF, subidas, secretos, configuración de producción, dependencias, props expuestas. Escribe docs/security/audit-FECHA.md y convierte hallazgos en tareas con test."
argument-hint: "[alcance: todo | área | carpeta]"
disable-model-invocation: true
---

# Auditoría de seguridad

Distinta del agente `security` (revisa el diff de una feature). Esta recorre toda la aplicación. Para el diff pendiente de una rama, complementa con el comando integrado `/security-review` de Claude Code.
Solo hallazgos **explotables o probables**, con evidencia `archivo:línea`; sin listas de buenas prácticas genéricas.

## Procedimiento
1. **Mapa** (tú, barato): `php artisan route:list --json` (a archivo, no al contexto), lista de modelos, policies, middleware, `config/` sensible. Si existe `graphify-out/`, úsalo. Guarda el inventario en `docs/security/.work/inventory.md`.
2. **Reparto**: lanza en paralelo subagentes de solo lectura (`forja:security`; el explorer no puede escribir), uno por área de [checklist.md](checklist.md) (ábrelo: define cada área con qué buscar y comandos). Áreas: (A) autorización y matriz rutas×roles, (B) autenticación, sesiones y rate limiting, (C) entrada: validación, mass assignment, SQL, subidas, (D) salida: XSS y props de Inertia, (E) secretos, configuración, cabeceras, CORS, cookies, (F) dependencias, colas, webhooks y logs. Cada uno recibe: su área, la ruta del inventario, el formato de hallazgo y la instrucción de escribir `docs/security/.work/<area>.md` y responder en ≤10 líneas.
3. **Dependencias**: `composer audit` y `npm audit --omit=dev` (salida a archivo; resume por severidad y si el paquete vulnerable se usa de verdad).
4. **Consolida** leyendo solo los archivos de área: deduplica, **confirma cada hallazgo alto o crítico** leyendo el código citado (o con un test que lo demuestre) y descarta falsos positivos y lo que el framework ya mitiga.
5. **Informe** `docs/security/audit-AAAA-MM-DD.md`: resumen (alcance, qué no se cubrió), tabla por severidad (crítica, alta, media, baja), y por hallazgo: título, `archivo:línea`, escenario de explotación en 1-2 líneas, arreglo propuesto, y la matriz de autorización rutas×roles como anexo.
6. **Tareas**: cada hallazgo confirmado pasa a una tarea con **test de regresión** (el test falla por la vulnerabilidad y pasa tras el arreglo). Preséntalas al usuario ordenadas por severidad; el arreglo entra por `/forja:triage` (auth, permisos y secretos son rutas sensibles) y `/forja:build`. No arregles dentro de la auditoría.

## Reglas
- Los subagentes no editan código ni ejecutan nada que escriba fuera de `docs/`. No se leen ni muestran valores de `.env`; solo se comprueba que existan las claves y que `.env` esté fuera del repo y de `public/`.
- Severidad por impacto × facilidad: crítica = toma de cuenta, ejecución de código o fuga masiva sin autenticación; alta = escalada o acceso a datos ajenos autenticado; media = requiere condiciones o interacción; baja = endurecimiento.
- Incierto no es hallazgo: márcalo "por verificar" con lo que falta para confirmarlo.

## Hecho cuando
El informe existe con alcance y límites explícitos, cada hallazgo alto o crítico está confirmado con evidencia, y cada confirmado tiene tarea con test de regresión.
