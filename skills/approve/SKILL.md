---
name: approve
description: Aprobación humana de la spec o del plan (/forja:approve spec | /forja:approve plan). La registra un hook al leer el comando del usuario; el modelo no puede aprobar. Solo se invoca a petición del usuario.
disable-model-invocation: true
argument-hint: "spec | plan"
---

# Aprobar

La aprobación la registra el **hook UserPromptSubmit** al leer lo que escribió el usuario; esta skill solo confirma el resultado.

## Pasos
1. Mira el mensaje `FORJA:` que añadió el hook en este turno:
   - "aprobada" → confirma en **una línea** y propone el siguiente paso (spec → `/forja:design` en L2 o `/forja:build`; plan → `/forja:build` (ejecución)).
   - "NO se registró" → di el motivo tal cual y qué falta.
2. Si no aparece ningún mensaje `FORJA:` (el hook no corrió), pide al usuario que la registre él mismo en el terminal con `! node .forja/forja.mjs approve $ARGUMENTS` y que lo confirme.

## Reglas
- Nunca ejecutes `forja.mjs approve` ni edites `.forja/state.json`: el hook de Bash lo bloquea.
- Si el usuario modifica `spec.md` o `plan.md` después de aprobar, la aprobación se invalida y hay que repetir.
