---
name: brainstorm
description: "Idea difusa: aclararla conversando (propósito, usuarios, enfoques, alcance) antes del triage. Úsala cuando el usuario no tiene la idea clara o pide pensarlo juntos; si ya está clara, ve directo a triage."
argument-hint: "<idea difusa en texto libre>"
---

# Brainstorm — de idea difusa a intención clara

Hilo principal (habla con el usuario). No toca código: `docs/` no está protegido. Salida: `docs/specs/<slug>/brainstorm.md`, que `triage` e `idea` reutilizan sin repetir preguntas.

## Pasos
1. Elige un `<slug>` corto con guiones (la carpeta `docs/specs/<slug>/` la crea el fixer al escribir).
2. Reformula la idea en 2 frases y pide confirmación.
3. Pregunta **una cosa por vez** con AskUserQuestion (opciones concretas, una recomendada; máx. 6): propósito → usuarios → qué existe ya → restricciones → cómo se medirá el éxito. No preguntes lo deducible del repo; si hace falta mirarlo, usa `graphify-out/` o el agente `explorer`.
4. Propón 2–3 enfoques con ventajas y costos, y recomienda uno. Deja que el usuario corrija cada sección.
5. Dicta a **forja:fixer** el contenido de `brainstorm.md` para que lo escriba (prosa clara, ≤1 página): intención (2 frases), usuarios, enfoque elegido y descartados (1 línea cada uno), alcance y fuera de alcance, criterios de éxito, preguntas abiertas, nivel sugerido con motivo.
6. Cierra en 3 líneas con el siguiente paso literal: "Corre `/forja:triage <slug>` y seguimos."

## Reglas
- Sin stack, librerías ni arquitectura: eso es `/forja:design`.
- Un brainstorm no es una aprobación; los gates siguen igual.
- Si cambia de idea, reescribe el archivo; no acumules versiones.
- Opcional: si el usuario prefiere `superpowers:brainstorming`, déjalo, pero con salida en `docs/specs/<slug>/brainstorm.md` y sin pasar a planes ni implementación.
