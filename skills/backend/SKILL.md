---
name: backend
description: "Decisiones y antipatrones para escribir backend Laravel + Inertia: capas, Eloquent sin N+1, migraciones seguras, transacciones, colas, props de Inertia, validación y autorización, dinero y fechas. Cárgala al crear o modificar controladores, modelos, migraciones, jobs o props."
argument-hint: "[área: capas | datos | colas | props | rendimiento]"
---

# Backend

Boost ya enseña la API de Laravel: ante una duda de sintaxis usa la herramienta Search Docs de Boost, no memoria. Respeta `.ai/rules` del proyecto (tienen prioridad sobre estos defaults). Aquí solo hay decisiones y qué rechazar.

## Defaults
- **Controlador fino**: recibe FormRequest, autoriza, llama, devuelve `Inertia::render` o redirect. Sin consultas encadenadas ni reglas de negocio.
- **FormRequest** para toda entrada: `rules()` explícitas, `authorize()` o Policy, `validated()` (nunca `all()`/`request()->input` hacia `create`).
- **Policy** por modelo, registrada y llamada con `authorize()`/`Gate` en cada acción; las rutas anidadas validan que el hijo pertenece al padre (`scopeBindings`). Autorización y validación viven siempre en servidor, aunque la UI oculte el botón.
- **Action** (clase de un método, `__invoke`/`handle`) cuando la lógica se usa desde 2+ sitios (controlador, job, comando), toca varios modelos o necesita transacción. Con un solo uso y pocas líneas, déjala en el controlador. Nada de capas Service/Repository genéricas que solo reenvían a Eloquent.
- **Eloquent**: lógica de consulta en scopes y relaciones; casts (`enum`, `decimal`, `datetime`, `encrypted`); `$fillable` explícito.
- **Enums** respaldados para estados y tipos; **dinero** en enteros (centavos) o `decimal` con cast y una moneda explícita, nunca `float`; **fechas** en UTC con `CarbonImmutable` si el proyecto lo usa.
- **Nombres**: seguir lo existente; modelos singulares, tablas plurales, acciones como verbo (`ApproveInvoice`), rutas con nombre, recursos REST salvo que el dominio pida verbos.

## Procedimiento
1. Antes de escribir, localiza el patrón vecino (un controlador y su Policy del mismo módulo) y repítelo.
2. Test primero (feature test con aserciones de Inertia; ver skill `test`).
3. Revisa tu diff contra los antipatrones de [reference.md](reference.md) (ábrelo cuando toques datos, colas o props; trae el detalle de N+1, migraciones, transacciones, idempotencia y props).
4. Comprueba con las herramientas de Boost: esquema de BD antes de escribir migraciones, Last Error y Read Log Entries si algo falla, no adivines.

## Antipatrones a rechazar
- Consulta dentro de un bucle o en un accessor sin eager loading (N+1). En `AppServiceProvider::boot`: `Model::preventLazyLoading(! app()->isProduction())`; en dev y tests también `Model::shouldBeStrict()` si el proyecto lo admite.
- `Model::unguard()`, `$guarded = []`, `$request->all()` hacia el modelo.
- Pasar el modelo entero a `Inertia::render` (expone `password`, `remember_token`, columnas internas, relaciones cargadas de más). Usa API Resource o arrays explícitos.
- Efectos secundarios (correo, HTTP externo, cobros) dentro de una transacción de BD sin `afterCommit`.
- `DB::raw`/`whereRaw` con entrada del usuario sin bindings.
- Editar una migración ya aplicada en otros entornos; migraciones que borran o renombran columnas en uso en un solo paso.
- Capturar excepciones para ocultarlas (`catch (\Throwable)` sin relanzar ni registrar).
- Listados sin `paginate()`/`cursorPaginate()` ni límite.

## Hecho cuando
Tests de feature verdes (incluido el caso no autorizado y la entrada inválida), sin N+1 en el flujo (los tests con `preventLazyLoading` activo no lanzan), Pint limpio y ninguna prop con datos que el cliente no necesita.
