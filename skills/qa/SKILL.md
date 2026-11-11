---
name: qa
description: "QA en navegador de la aplicación: flujos E2E, errores de consola y de red, rendimiento (Core Web Vitals, peso), accesibilidad, responsive y regresión visual, con Playwright o Chrome DevTools MCP. Cárgala al probar la app en el navegador o al verificar una pantalla."
argument-hint: "[flujo, URL o área a probar]"
---

# QA en navegador

Ejecuta esto **en el agente `qa`** (contexto aislado), no en la sesión principal: los snapshots y trazas son muy caros en tokens. El orquestador pasa URL, flujo y criterio; el agente guarda evidencia en archivos y responde en **≤10 líneas** con hallazgos y rutas.

## Herramienta según la tarea
| Necesidad | Usa |
|---|---|
| Flujo E2E reproducible, formularios, login, regresión | Playwright CLI (`playwright-cli`, ahorra tokens) o Playwright MCP (`browser_*`) si hay que explorar |
| Tests E2E permanentes en el repo | Pest browser tests (skill `test`) |
| Errores de consola, red, estilos computados | Chrome DevTools MCP (`list_console_messages`, `list_network_requests`, `get_network_request`) |
| Rendimiento: traza, Web Vitals, peso | Chrome DevTools MCP (`performance_start_trace` / `performance_stop_trace` / `performance_analyze_insight`) |
| Auditoría (a11y, SEO, buenas prácticas) | Chrome DevTools MCP (`lighthouse_audit`) |
| Responsive, tema oscuro | `resize_page`/`emulate` (DevTools) o `browser_resize`/`browser_emulate_media` (Playwright) |
| Errores del servidor y del navegador del proyecto | Boost: último error, logs, logs de navegador |
Si una herramienta no está instalada, usa la otra o pide instalarla; no instales por tu cuenta. Los nombres exactos de herramienta pueden variar con la versión: consulta la lista de herramientas disponibles.

## Control de tokens
- Prefiere capturas a archivo (`filePath`/`--filename`) y trazas a archivo; lee solo el resumen. Evita `take_snapshot`/`browser_snapshot` completos de páginas grandes: escopa a un elemento o usa `filePath` y busca con Grep.
- Consola: filtra por tipo (`error`, `warn`); red: filtra por tipo de recurso y fallos (4xx/5xx), pagina.
- Una pasada por flujo; no exploración abierta. Cierra el navegador al terminar.

## Procedimiento
1. Define 1-3 flujos críticos (feliz + un error) desde la spec o el pedido. Datos de prueba: usuario sembrado, nunca credenciales reales.
2. Ejecútalos y registra por paso: resultado, errores de consola y fallos de red.
3. Revisa las áreas de [checklist.md](checklist.md) que apliquen (ábrelo: criterios y umbrales de rendimiento, a11y, responsive y regresión visual).
4. Guarda evidencia como archivos: `docs/specs/<slug>/reviews/qa/` si pertenece a una feature, si no `docs/qa/evidence/<fecha>/` (capturas, trazas, informes).
5. Informe: `docs/specs/<slug>/reviews/qa.md` si pertenece a una feature; si no, `docs/qa/<fecha>.md`. Hallazgos con severidad (bloqueante, alta, media, baja), pasos para reproducir, evidencia y arreglo propuesto.
6. Convierte cada hallazgo bloqueante o alto en una tarea priorizada (con test de regresión cuando sea automatizable) y devuélvelos al orquestador; los demás, en una lista corta.

## Hecho cuando
Los flujos pasan en navegador con consola y red limpias, el informe existe con evidencia en archivos y cada hallazgo tiene tarea o decisión explícita de no actuar.
