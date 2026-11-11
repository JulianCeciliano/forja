---
name: init
description: "Arranque de un sistema con Forja. Modo nuevo (proyecto desde cero) o adopción (proyecto Laravel existente): deja docs/system/overview.md y backlog.md sin mega-spec. Solo se invoca a petición del usuario."
disable-model-invocation: true
argument-hint: "<nuevo | adopcion> <descripción del sistema, opcional>"
---

# Init — de cero (o de un repo existente) a overview y backlog

Corre en el hilo principal. `docs/` no está protegido: no necesita triage. No escribe código de la app ni una spec gigante: cada feature pasará luego por `/forja:triage`. Donde dice "escribe" o "añade", el orquestador decide el contenido y lo dicta a **forja:fixer**.

## Modo nuevo
1. Entrevista corta con AskUserQuestion (máx. 2 rondas, opciones concretas, una recomendada): dominio y problema → roles de usuario → módulos principales → decisiones de stack (auth, BD, colas, pagos, correo) → plazos o restricciones. No preguntes lo que puedas decidir con valores por defecto de Laravel.
2. Escribe `docs/system/overview.md` (≤1 página): dominio, roles, módulos y decisiones de stack con una línea de motivo.
3. Escribe `docs/system/backlog.md`: features priorizadas (P0 base técnica, auth y roles primero), cada una con una línea de alcance y nivel probable. Sin criterios de aceptación: eso lo hace `idea`/`plan` por feature.
4. Base técnica: pide al usuario que corra `/forja:infra` (entornos, Docker/Sail, BD, colas, caché, CI; solo él puede invocarla). Sugiere definir la base de diseño con la skill `frontend` como primera feature.

## Modo adopción
1. Mapea el repo con el agente `explorer` (módulos, rutas, modelos, tests, CI) y pide ≤10 líneas con rutas.
2. Si Laravel Boost ofrece la skill `infer-conventions`, úsala para fijar convenciones; si no, deduce las que el explorer vea repetidas.
3. Escribe el mismo `docs/system/overview.md` describiendo lo que existe, y un `backlog.md` solo con lo pendiente que el usuario mencione.
4. Añade a CLAUDE.md solo trampas no deducibles del código (≤15 líneas).

## Cierre
En 3 líneas: qué quedó escrito y el siguiente paso literal: "Corre `/forja:triage <primera feature del backlog>`."
