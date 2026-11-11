# Checklist de QA en navegador

## Flujos E2E
- Camino feliz completo y un camino de error (validación, permiso denegado, 404, sesión caducada).
- Después de cada acción: URL esperada, mensaje de feedback, dato persistido (recarga y compruébalo).
- Doble clic en enviar no duplica; botón atrás y recarga no rompen el estado.
- Roles: repite el flujo clave con un usuario sin permiso (debe ver 403 o no ver la acción).

## Consola y red
- Cero `error` en consola; avisos de React (keys, hydration) cuentan como hallazgo.
- Sin peticiones 4xx/5xx inesperadas, sin duplicadas, sin CORS ni contenido mixto.
- Peticiones Inertia: respuesta con la forma esperada y sin props sensibles (revisa una respuesta con `get_network_request` o equivalente).
- Peticiones en cascada o N peticiones iguales: señal de problema de carga (candidato a prefetch, `Deferred` o caché).

## Rendimiento
Mide en perfil realista (throttling de red y CPU moderado, caché fría) con build de producción (`npm run build`), no el servidor de Vite.
Umbrales "buenos" de Core Web Vitals (percentil 75): LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1. Verifica los umbrales vigentes en web.dev si dudas.
- Traza con recarga: LCP y su elemento, CLS y qué lo causa, tareas largas, bloqueo de render.
- Peso: JS inicial razonable para el tipo de app (referencia: bajo unos cientos de KB comprimidos por ruta); revisa chunks grandes, dependencias pesadas importadas enteras y falta de división por página. Imágenes: tamaño, formato moderno, dimensiones y `loading`.
- Consultas lentas: cruza con logs del servidor (tiempo de respuesta por ruta) antes de culpar al front.

## Accesibilidad
- `lighthouse_audit` (accesibilidad) como primera pasada; recuerda que automatiza solo una parte.
- Manual: recorrer con Tab (orden, foco visible, sin trampas), diálogos con Esc y foco devuelto, formularios con etiquetas y errores anunciados, contraste, zoom 200 %.

## Responsive y tema
- 375, 768 y 1280 px; orientación apaisada del móvil si hay navegación fija. Sin desborde horizontal, sin texto cortado, objetivos táctiles ≥ 44 px.
- Tema claro y oscuro (`emulate` con `colorScheme` o `browser_emulate_media`).

## Regresión visual
- Capturas de referencia por vista clave en la carpeta de evidencia (ver SKILL) (`<vista>-<ancho>-<tema>.png`). Compara con la versión anterior y reporta diferencias no pedidas.
- Para regresión permanente, usa Pest `assertScreenshotMatches()` en el repo (skill `test`) en pocas vistas estables; evita capturas con datos o fechas variables.

## Formato de hallazgo
```
### [alta] Título corto
Pasos: 1... 2...   Esperado: ...   Actual: ...
Evidencia: <carpeta de evidencia>/archivo.png   Consola/red: ...
Arreglo propuesto: ...   Regresión: test feature | browser | manual
```
