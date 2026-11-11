---
name: idea
description: "Feature grande o riesgosa (L2): entrevista al usuario con preguntas de opción múltiple y redacta spec.md corta y verificable, antes de diseñar."
argument-hint: "<idea en texto libre o ruta a documentos>"
allowed-tools: Bash(node *forja.mjs* status --line) PowerShell(node *forja.mjs* status --line)
---

# Descubrimiento — de idea a spec aprobable

Estado: !`node "${CLAUDE_PLUGIN_ROOT}/scripts/forja.mjs" status --line`

Hilo principal (los subagentes no hablan con el usuario). Exige nivel L2; si no, `/forja:triage`.

1. Lee la idea ($ARGUMENTS) y los documentos indicados. Si existe `docs/specs/<slug>/brainstorm.md` o `docs/system/overview.md`, parte de ahí y pregunta solo lo que falte. Si existe `graphify-out/`, consúltalo antes de abrir archivos.
2. Entrevista con AskUserQuestion: máx. 3 rondas de hasta 4 preguntas, con opciones y una recomendada. Orden: usuarios y roles → alcance y fuera de alcance → datos principales → criterios de éxito → restricciones. Si hay UI, pregunta por referencias visuales; si toca infra o seguridad, por esos requisitos.
3. Sin stack ni arquitectura: eso es `/forja:design`.
4. Decide el contenido de la spec (≤2 páginas, prosa clara, cada criterio verificable con un test o un paso de navegador; las secciones opcionales solo si aplican) y díctalo a **forja:fixer** para que rellene `docs/specs/<slug>/spec.md` (plantilla ya creada) sin dejar marcadores. Tú no escribes el archivo.
5. Cierra en 3 líneas (qué cubre, dudas, petición literal): "Revisa `docs/specs/<slug>/spec.md` y escribe `/forja:approve spec` si estás de acuerdo."

Si el usuario edita la spec tras aprobarla, la aprobación se invalida. No edites código.
