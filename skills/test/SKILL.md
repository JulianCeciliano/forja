---
name: test
description: "Estrategia y escritura de tests para Laravel + Inertia con Pest: qué probar según el tipo de cambio, feature tests con aserciones de Inertia, autorización por rol, regresión por bug, arquitectura, browser tests, y cómo correr solo lo relevante con salida compacta. Cárgala al escribir o decidir tests."
argument-hint: "[cambio o área a probar]"
---

# Tests

Boost trae la skill `pest-testing` (sintaxis, datasets, mocks): úsala y Search Docs para la API. Aquí: qué probar, a qué nivel y cómo gastar poco contexto.

## Pirámide para Laravel + Inertia
1. **Feature tests (la base)**: petición HTTP real contra la app con BD de test. Cubren ruta, middleware, FormRequest, Policy, Action y respuesta Inertia (`assertInertia` con componente y props).
2. **Unit tests**: solo donde hay lógica pura (cálculos, enums, value objects, reglas de negocio). No testees getters ni Eloquent.
3. **Arquitectura** (`arch()`): pocas reglas baratas: `preset()->laravel()`, `preset()->security()`, sin `dd/dump`, controladores sin acceso directo a otras capas que prohibas.
4. **Browser tests** (Pest `visit()`): pocos, solo flujos críticos donde importa el JS real (login, pago, formulario complejo) y `assertNoSmoke()`. Lo exploratorio es de la skill `qa`.
5. **Front**: `tsc --noEmit` siempre; Vitest solo si hay lógica en TS/JS (utilidades, hooks con reglas, formateadores). No testees componentes de presentación.

## Qué probar según el cambio
- Endpoint o página nueva: camino feliz, validación inválida (un caso por regla relevante), no autenticado, autenticado sin permiso, y prop Inertia esperada.
- Policy o rol: matriz usuario × acción (propietario, otro usuario, admin, invitado). Cada ruta protegida tiene su caso "no autorizado" y el de recurso ajeno (IDOR).
- Migración o dato: test del comportamiento tras la migración si transforma datos; factory actualizada.
- Job o evento: se despacha (`Queue::fake`), ejecuta idempotente (corrido dos veces) y falla con gracia.
- Dinero, fechas, estados: casos límite (cero, redondeo, cambio de zona, transiciones inválidas).
- **Bug**: primero un test que falle por la causa real, luego el arreglo; el test se queda como regresión. Sin test reproductor no se da por arreglado.

## Datos
- Factories con estados con nombre (`->admin()`, `->suspended()`); cada test crea lo que necesita, sin depender de seeders ni de orden. `RefreshDatabase` (o `LazilyRefreshDatabase`).
- Fakes para lo externo (`Http::fake`, `Mail::fake`, `Storage::fake`, `Queue::fake`); nunca red real. Congela el tiempo con `travelTo`.
- Activa `preventLazyLoading` en tests para que un N+1 falle.

## Correr solo lo relevante, salida compacta
- Un archivo o filtro: `php artisan test --compact tests/Feature/X.php` o `--filter=nombre`; tras verde parcial, la suite completa una vez (`--parallel` si el proyecto lo soporta).
- Fallos: relee solo las líneas del error (`| tail -40`); no pegues trazas completas. `--stop-on-failure` mientras iteras.
- Browser tests aparte: `./vendor/bin/pest tests/Browser`; capturas y trazas en `tests/Browser/Screenshots` y `Traces` (en `.gitignore`).
- Los hooks ya corren pint, tests y tipos al terminar: no los repitas a mano salvo para depurar.

## Cobertura con criterio
No persigas un porcentaje. Exige: cada criterio de aceptación de la spec con al menos un test, cada ruta protegida con su caso no autorizado, cada bug con su regresión. Si mides cobertura (`--coverage`), úsala para encontrar ramas de negocio sin probar, no para rellenar.

## Hecho cuando
Tests nuevos fallaron antes del código (RED), pasan después, nombran el comportamiento (no la implementación), y no dependen de orden, red ni hora real. Antipatrones: mockear lo que se está probando, asserts solo de "status 200", tests que repiten la implementación.
