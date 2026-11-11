# Backend: detalle de decisiones

Verifica nombres de API con la herramienta Search Docs de Boost (Laravel 13, Inertia 3, Pest 4).

## Eloquent y rendimiento
- Eager loading: `with()` en la consulta, `load()`/`loadMissing()` tras route model binding, `withCount`/`withSum` en vez de contar en PHP. Restringe columnas: `with('author:id,name')`.
- `preventLazyLoading` en dev y tests convierte los N+1 en excepciones. En producción, solo registra (`handleLazyLoadingViolationUsing`) en lugar de romper.
- Índices: en cada clave foránea y en columnas de `where`/`orderBy` frecuentes; compuestos con el orden (igualdad primero, rango después). Un único de negocio es un `unique`, no una validación sola (carrera entre peticiones).
- Paginación: `paginate()` para UI con páginas; `cursorPaginate()` para tablas grandes o scroll infinito. Nunca `all()` sobre tablas que crecen. `chunkById`/`lazyById` para procesos masivos; `upsert` e inserciones por lotes en lugar de bucles.
- Caché: solo con una medición que lo justifique; clave versionada con el dato que invalida; `Cache::remember` con TTL; invalida en el evento que cambia el dato. `Cache::flexible` (stale-while-revalidate) para datos caros y tolerantes.

## Migraciones con datos existentes
- Añadir columna NOT NULL a una tabla con filas: nullable o con default, rellenar en lotes, y luego endurecer en otra migración.
- Renombrar o borrar: expandir → desplegar código que usa ambas → migrar datos → desplegar código nuevo → contraer. Nunca en un solo despliegue.
- Índices en tablas grandes: `CREATE INDEX CONCURRENTLY` (PostgreSQL) fuera de transacción (`$withinTransaction = false`); en MySQL valora herramientas online.
- Datos: migraciones de esquema separadas de migraciones de datos (comando o job reanudable, idempotente).
- Cada migración con `down()` solo si es realmente reversible; si no, documenta que el rollback es restaurar backup.
- Prueba la migración sobre una copia con datos realistas antes de producción.

## Transacciones y consistencia
- `DB::transaction()` para cambios que deben ser atómicos; corta y sin llamadas de red dentro. Reintentos con el segundo argumento solo ante deadlocks.
- Despacha jobs y eventos con `afterCommit` (propiedad `$afterCommit` o `->afterCommit()`) para que el worker no vea datos sin confirmar.
- Contadores y saldos: actualización atómica (`increment`) o `lockForUpdate()` dentro de transacción, no leer-modificar-escribir.
- Unicidad concurrente: restricción única en BD + captura de la violación; `firstOrCreate`/`updateOrCreate` solo con índice único respaldándolos.

## Colas e idempotencia
- Un job puede ejecutarse dos veces: hazlo idempotente (clave de idempotencia, comprobar estado antes de actuar, `updateOrCreate`, registro de procesados).
- Pasa IDs o modelos simples (`SerializesModels` recarga), no objetos grandes. Define `tries`, `backoff`, `timeout` y `failed()`.
- `ShouldBeUnique` o `WithoutOverlapping` para evitar duplicados; recuerda que consumen intentos.
- Envío de correo y notificaciones por cola. Webhooks entrantes: verifica la firma, guarda el evento y responde 2xx rápido; procesa en un job con idempotencia por id de evento.
- Llamadas HTTP externas: `Http::timeout()->retry()` con límites y manejo del fallo; nunca sin timeout.

## Props de Inertia
- Comparte lo mínimo. `HandleInertiaRequests::share` corre en cada petición: solo usuario autenticado reducido (id, nombre, email, permisos necesarios), flash y datos de layout baratos.
- Reducción explícita: API Resource (`UserResource`) o `->only([...])`; nunca el modelo completo. Revisa `$hidden`, relaciones cargadas y atributos calculados.
- Props pesadas o secundarias: `Inertia::defer()` (cargan tras el primer render, con `<Deferred>` en React); `Inertia::optional()` para cargar solo bajo petición explícita (partial reload con `only`); `Inertia::merge()` para paginación acumulativa. Los datos que se evalúan en cada visita van en closures para que las partial reloads no los calculen. Confirma la API exacta en `search-docs`.
- Los permisos para la UI (`can: { update: true }`) se calculan en servidor; la UI solo los refleja.
- Errores de validación llegan automáticamente como `errors`; no devuelvas JSON a mano para formularios Inertia.
- Redirecciones tras POST/PUT/DELETE (303 en PUT/PATCH/DELETE); `back()` con flash para feedback.

## Errores
- Excepciones de dominio con nombre propio, convertidas a respuesta en `bootstrap/app.php` (`withExceptions`). Mensajes al usuario genéricos; detalle al log con contexto (id, no datos personales).
- `report()` para lo que debe alertar; `dontReport` para ruido. Falla rápido en entradas imposibles (`abort_unless`, `findOrFail`).
- En APIs, respuestas de error con forma consistente y códigos HTTP correctos.

## Validación y autorización
- Reglas de existencia con alcance (`Rule::exists(...)->where('team_id', ...)`): un `exists:projects,id` sin alcance permite referenciar datos ajenos.
- Subidas: `File::types()`, tamaño máximo, almacenamiento fuera de `public` salvo lo público; nombre generado, nunca el original.
- Roles y permisos: Policies para decisiones por recurso; `Gate::before` solo para super-admin explícito. Prueba cada Policy con un usuario sin acceso (ver skill `test`).

## Convenciones
- Un caso de uso por Action; Actions en `app/Actions/<Dominio>`. Eventos para efectos desacoplados, no para flujo principal.
- Rutas con nombre y agrupadas por middleware; Wayfinder genera las funciones de ruta para el front: no escribas URLs a mano en React.
- Sigue Pint (preset del proyecto) y tipado estricto (`declare(strict_types=1)` si el proyecto lo usa).
