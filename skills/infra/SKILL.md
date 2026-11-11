---
name: infra
description: "Define o cambia la infraestructura de un sistema Laravel + Inertia: entorno local, BD, colas, caché, archivos, correo, scheduler, CI, despliegue, observabilidad y configuración de producción. Úsala al iniciar un sistema nuevo o al tocar infraestructura. Deja docs/system/infra.md."
argument-hint: "[nuevo | cambio: qué se quiere cambiar]"
disable-model-invocation: true
---

# Infraestructura

Los cambios de infra son rutas sensibles: pasan por `/forja:triage` (mínimo L1; L2 si tocan despliegue, BD o secretos).
Los hooks impiden editar `.env`: dile al usuario qué variables poner y en qué archivo; nunca pidas ni escribas valores secretos. Mantén `.env.example` al día.

## Procedimiento
1. Lee `docs/system/infra.md` si existe. En un cambio, toca solo la sección afectada.
2. Sistema nuevo: haz como máximo 5 preguntas (tráfico esperado, presupuesto, datos sensibles o regulación, quién opera el servidor, tamaño del equipo). Si la respuesta ya está en `brainstorm.md` o `spec.md`, no repitas.
3. Abre [areas.md](areas.md): trae las decisiones por defecto, alternativas y la checklist por área. Decide solo las áreas que aplican. Una decisión = elección + una línea de porqué + qué la haría cambiar.
4. Implementa lo versionable (workflow de CI, config, Dockerfile, `.env.example`, health check) con TDD donde haya lógica; el resto es instrucción al usuario.
5. Verifica con evidencia: cada casilla de la checklist se marca con el comando o archivo que la respalda. Sin evidencia, queda como pendiente del usuario.
6. Escribe `docs/system/infra.md` con la plantilla del final de [areas.md](areas.md).

## Reglas de decisión
- Lo más simple que cumpla: plataforma gestionada o una VPS antes que Kubernetes; SQLite solo en local o apps de un solo servidor con poca escritura concurrente.
- Una pieza nueva (Redis, Horizon, Octane, SSR, Reverb) se añade solo con un síntoma o requisito concreto, no "por si acaso".
- Anota en `infra.md` todo lo que difiere entre local y producción (colas, caché, sesión, disco, correo).
- Despliegue: define el rollback antes de desplegar. Las migraciones destructivas no se revierten: van en dos pasos (expandir, luego contraer).
- Telescope solo en local o staging; Pulse en producción si hay margen de BD o Redis y acceso restringido por Gate.

## Hecho cuando
`infra.md` está escrito, el CI pasa en una rama real, el health check responde y el usuario recibió la lista corta de variables y secretos por configurar.
