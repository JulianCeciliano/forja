# Checklist de auditoría (Laravel + Inertia + React)

Formato de hallazgo para los subagentes: `[severidad] título | archivo:línea | explotación (1-2 líneas) | arreglo (1 línea)`.

## A. Autorización
- Matriz rutas × roles: para cada ruta de `route:list` anota middleware, Policy/Gate usado y roles que deben acceder. Marca rutas sin `auth` o sin autorización a nivel de recurso.
- Controladores que cargan modelos por id sin `authorize()`, Policy o consulta acotada al dueño/tenant (IDOR). Route model binding sin `scopeBindings` en rutas anidadas.
- Acciones de escritura protegidas solo por ocultar el botón en React. Políticas con `return true` o `before()` demasiado permisivo.
- Consultas sin alcance de tenant/equipo; `withoutGlobalScopes` injustificado; búsquedas y exportaciones que ignoran permisos.
- Endpoints de API, descargas y archivos: ¿exigen autorización por recurso?

## B. Autenticación, sesiones, rate limiting
- Rate limiting en login, registro, recuperación de contraseña, 2FA, envío de correos/SMS y endpoints costosos. Bloqueo por usuario+IP.
- Reglas de contraseña, verificación de correo, 2FA donde hay datos sensibles; regeneración de sesión al iniciar sesión; invalidación al cambiar contraseña.
- Cookies: `secure`, `http_only`, `same_site`; `SESSION_DOMAIN`; duración razonable.
- Tokens (Sanctum/API): alcance mínimo, expiración, no en URL ni en logs. Enumeración de usuarios por mensajes o tiempos.
- Impersonación, "login as", rutas de depuración y puertas traseras.

## C. Entrada
- Mass assignment: `$guarded = []`, `unguard`, `create($request->all())`; campos como `role`, `is_admin`, `team_id` asignables.
- Validación: acciones sin FormRequest/`validate`; reglas `exists`/`unique` sin alcance; archivos e IDs sin tipo ni tamaño.
- SQL: `DB::raw`, `whereRaw`, `orderByRaw`, `selectRaw`, nombres de columna u orden tomados de la entrada sin lista blanca.
- Subidas: tipo por MIME real y extensión permitida, tamaño, nombre generado, destino fuera de `public` salvo lo público, sin ejecución de lo subido, SVG como vector de XSS.
- SSRF y redirecciones abiertas: `Http::get($input)`, `redirect($input)`, `redirect()->intended` sin validar.
- Deserialización, `unserialize`, `eval`, `exec`/`shell_exec`/`Process` con entrada del usuario, `include` dinámico.

## D. Salida
- XSS: `dangerouslySetInnerHTML`, `innerHTML`, `{!! !!}`, `href`/`src` con `javascript:` desde datos, HTML de usuarios renderizado (Markdown sin sanitizar). Props de Inertia con contenido de usuario que se pinta como HTML.
- Props expuestas: modelos completos a `Inertia::render` (`password`, `remember_token`, tokens, emails ajenos, campos internos); `HandleInertiaRequests::share` con datos de más; la página inicial incluye todas las props en el HTML (`data-page`): lo que no debe ver el cliente no puede viajar ahí.
- Respuestas de error con trazas o consultas; `APP_DEBUG`.
- Clave APP y datos cifrados: qué se guarda en claro y debería cifrarse (`encrypted` cast).

## E. Secretos, configuración, cabeceras
- Secretos en el repo, historial, `config/*.php` literales, front (`VITE_*` expone al cliente: nada secreto), logs y `.env.example`. `.env` accesible desde web; `public/` como única raíz.
- Producción: `APP_DEBUG=false`, `APP_ENV=production`, HTTPS, HSTS, cabeceras (`nosniff`, anti-framing, `Referrer-Policy`), CSP si existe, CORS (`config/cors.php` sin `*` con credenciales), proxies de confianza.
- Rutas o paneles de depuración abiertos: Telescope, Horizon, Pulse, `/docs`, Ignition, `phpinfo` sin Gate.
- CSRF: rutas fuera del grupo `web` o excepciones en `validateCsrfTokens(except:)` injustificadas; formularios que no usan el flujo de Inertia.

## F. Dependencias, colas, webhooks, logs
- `composer audit`, `npm audit --omit=dev`; paquetes abandonados; versiones de framework sin soporte.
- Webhooks entrantes: firma verificada con comparación en tiempo constante y tolerancia de tiempo; idempotencia; sin confiar en el cuerpo para autorizar.
- Jobs: datos sensibles en el payload; jobs que actúan con permisos más amplios que el usuario que los originó.
- Logs: contraseñas, tokens, datos personales, tarjetas; `Log::info($request->all())`; retención.
- Comandos Artisan y rutas internas ejecutables desde la web.

## Comandos útiles (salida a archivo; los corre el orquestador: los subagentes no pueden redirigir)
- `php artisan route:list --json > docs/security/.work/routes.json`
- `composer audit --format=json > docs/security/.work/composer-audit.json`
- `npm audit --omit=dev --json > docs/security/.work/npm-audit.json`
- Grep dirigido: `DB::raw|whereRaw|orderByRaw|dangerouslySetInnerHTML|{!!|unserialize|\$guarded = \[\]|->all\(\)|withoutGlobalScopes`
