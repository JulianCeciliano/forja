# Áreas de infraestructura: decisiones y checklist

Comprueba comandos y versiones con Search Docs de Boost o la doc de Laravel 13 antes de aplicarlos. Comprueba la versión mínima de PHP en la doc de tu versión de Laravel.

## Entorno local
- Herd: lo más rápido en macOS y Windows, sin contenedores. Sail (Docker): paridad con producción (versión de BD, Redis, Meilisearch) o equipo heterogéneo. Docker propio solo si producción ya es Docker.
- En el starter kit, `composer run dev` levanta servidor, cola, logs y Vite; `composer dev:ssr` añade SSR.
- [ ] Un comando documentado levanta todo desde un clon limpio (`composer install`, `npm install`, `cp .env.example .env`, `php artisan key:generate`, `php artisan migrate --seed`).

## Base de datos
- Por defecto PostgreSQL o MySQL/MariaDB gestionado en producción. SQLite: local, tests y apps pequeñas de un solo nodo (WAL activo, copia del archivo).
- Índices: claves foráneas, columnas de filtro u orden frecuentes y únicos de negocio. Confirma con `EXPLAIN` antes de añadir más.
- Backups automáticos, cifrados, con retención y **restauración probada** al menos una vez. Anota RPO/RTO aceptados.
- [ ] Zona horaria UTC en BD; conversión solo en presentación.
- [ ] Si el flujo lo permite, el usuario de BD de la app no tiene privilegios de DDL en producción.

## Colas y Horizon
- Cola `database`: suficiente con poco volumen y sin Redis. Redis + Horizon cuando hay varias colas, prioridades, métricas o volumen alto. Horizon exige Redis y no soporta Redis Cluster.
- `retry_after` > timeout del worker > timeout del job. En Horizon, `timeout` unos segundos por debajo de `retry_after`.
- Despliegue: `php artisan queue:restart` (o `horizon:terminate`) para cargar el código nuevo; Supervisor o la plataforma reinicia el proceso. `stopwaitsecs` mayor que el job más largo.
- Con métricas de Horizon: `Schedule::command('horizon:snapshot')->everyFiveMinutes()`; dashboard tras el Gate `viewHorizon`.
- [ ] Jobs idempotentes, con `tries` y `backoff`; `failed_jobs` monitorizada.

## Caché, sesiones, Redis
- Un solo Redis para caché, sesión y colas es válido al inicio, con prefijos distintos. Con más de un servidor, la sesión va en `database` o `redis`, nunca en `file`.
- Cache locks y rate limiting necesitan un store compartido entre servidores.
- [ ] `CACHE_PREFIX` y `REDIS_PREFIX` únicos por app y entorno.

## Archivos
- Disco local si hay un servidor; S3 compatible (S3, R2, Spaces) si hay más de uno, despliegues sin estado o archivos grandes. Disco `public` solo para lo público; lo privado con URLs temporales.
- [ ] `php artisan storage:link` en el despliegue si se usa `public`.
- [ ] Límites coherentes: `client_max_body_size` de Nginx, `upload_max_filesize`, `post_max_size` y la regla de validación.

## Correo
- Local: Mailpit, Mailtrap o `log`. Producción: proveedor transaccional (Postmark, SES, Resend, Mailgun) con SPF, DKIM y DMARC en el DNS.
- Envíos siempre por cola.
- [ ] Remitente y `MAIL_*` por entorno; webhooks de rebotes si importa la entregabilidad.

## Scheduler
- Una sola entrada de cron: `* * * * * cd /ruta && php artisan schedule:run`. Con varios servidores, `onOneServer()` y caché compartida; `withoutOverlapping()` en tareas largas.
- [ ] Tareas en `routes/console.php`; `php artisan schedule:list` las muestra.

## SSR de Inertia
- Solo con SEO público, previews sociales o primer render lento medido. Un panel tras login no lo necesita.
- Con SSR: `npm run build:ssr`, proceso Node supervisado (`php artisan inertia:start-ssr`), reinicio en cada despliegue. En desarrollo, con el plugin de Vite de Inertia 3 el SSR corre dentro de `npm run dev`.

## Variables y secretos
- Nunca en el repo ni en logs. En producción: gestor de secretos de la plataforma o `.env` creado en el servidor. `env()` solo dentro de `config/*` (con `config:cache`, fuera de config devuelve null).
- Lista en `infra.md` las variables requeridas con descripción, sin valores. `.env.example` completo y sin secretos reales.
- [ ] `APP_KEY` distinta por entorno y guardada fuera del repo (rotarla invalida sesiones y datos cifrados).
- [ ] Anotado quién rota las claves de terceros y cuándo.

## CI (GitHub Actions)
Jobs mínimos, con caché de Composer y npm y `concurrency` para cancelar ejecuciones viejas:
1. `vendor/bin/pint --test`
2. `php artisan test --compact` (con el mismo motor de BD que producción si difiere)
3. Tipos: `npx tsc --noEmit` (o el script `types` del proyecto); lint si existe
4. `npm run build`
5. `composer audit` y `npm audit --omit=dev` (falla en alta o crítica; el resto, aviso)
Permisos `contents: read` por defecto; acciones fijadas a versión mayor o SHA; secretos solo donde hacen falta. Dependabot o Renovate para actualizaciones.
- [ ] El workflow pasa en una rama real y la rama `main` lo exige para fusionar.

## Despliegue
- Laravel Cloud: menos operación (cómputo, BD, caché, almacenamiento y reinicios gestionados). Elígelo si el usuario no quiere administrar servidores.
- Forge: servidor propio en un proveedor de VPS; más control y menor coste, pero el parcheo y la seguridad del servidor son tuyos.
- Vapor: solo si ya se está en AWS Lambda con cargas muy variables.
- Docker propio: si ya hay orquestador o requisito de portabilidad.
- Orden del despliegue: código nuevo, `composer install --no-dev --optimize-autoloader`, build del front, `php artisan migrate --force`, `php artisan optimize`, recargar colas, Horizon, SSR y Octane (`php artisan reload` donde aplique), health check. Modo mantenimiento solo si es inevitable.
- Zero-downtime: releases con symlink atómico (Forge, Envoyer, Cloud lo dan) o rolling en contenedores. Migraciones compatibles hacia atrás: expandir (columna nullable, doble escritura), desplegar, migrar datos, contraer (borrar) en un despliegue posterior.
- Rollback: redeploy de la release anterior; el esquema debe seguir siendo compatible con ella. `migrate:rollback` en producción solo si la migración es reversible y sin pérdida de datos.
- [ ] Backup de BD justo antes de migraciones que alteran datos.

## Observabilidad
- Logs: canal `stack` con `daily`, o stderr en contenedores; `LOG_LEVEL=warning` o `error` en producción; sin datos personales ni tokens.
- Errores: un solo servicio (Nightwatch, Sentry, Flare o similar). Alerta en errores nuevos y en jobs fallidos.
- Health check: `/up` integrado; amplíalo con el evento `DiagnosingHealth` (BD, caché) si hace falta. Monitor externo de uptime.
- [ ] Alguien recibe la alerta y se probó provocando un error.

## Configuración de producción
- `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL` con https. `php artisan optimize` en cada despliegue (config, rutas, vistas, eventos).
- HTTPS forzado en el proxy o servidor; con balanceador, proxies de confianza (`trustProxies`); HSTS cuando HTTPS esté estable.
- Cabeceras: `X-Content-Type-Options: nosniff`, `X-Frame-Options` o `frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`. CSP solo si se puede mantener (empieza en report-only).
- Cookies de sesión: `SESSION_SECURE_COOKIE=true`, `same_site=lax`, `http_only`.
- Raíz web = `public/`; `.env`, `storage` y `vendor` inaccesibles.
- [ ] `php artisan about` en producción confirma entorno, debug apagado y cachés activas.
- [ ] `php artisan migrate:status` limpio; cola y scheduler funcionando.

## Plantilla de docs/system/infra.md
```
# Infraestructura
Actualizado: AAAA-MM-DD
| Área | Decisión | Porqué | Cambiaría si |
|---|---|---|---|
| Local | | | |
| BD | | | |
| Colas | | | |
| Caché y sesión | | | |
| Archivos | | | |
| Correo | | | |
| Scheduler | | | |
| SSR | | | |
| CI | | | |
| Despliegue | | | |
| Observabilidad | | | |
## Variables de entorno (sin valores)
## Despliegue y rollback (pasos)
## Pendiente del usuario
```
