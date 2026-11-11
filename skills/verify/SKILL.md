---
name: verify
description: "Verificación independiente (L1 y L2): validator contra la spec, qa para el flujo en navegador y security en L2 o si toca auth, pagos o permisos. Exige evidencia ejecutable."
argument-hint: "<slug de la feature, opcional>"
allowed-tools: Bash(node *forja.mjs* status --line) PowerShell(node *forja.mjs* status --line)
---

# Verificación independiente

Estado: !`node "${CLAUDE_PLUGIN_ROOT}/scripts/forja.mjs" status --line`

Quien escribió el código no lo valida. El hook Stop ya pasó pint, tsc y tests: no los repitas; aquí se comprueba que **cumple la spec**.

1. **forja:validator** (solo lectura): pásale las rutas de la spec (o `plan.md` en L1) y la rama, no el diff. Criterio por criterio con evidencia (comando + salida filtrada), solo gaps de corrección, sin estilo. Informe `docs/specs/<slug>/reviews/validator.md`; respuesta ≤10 líneas.
2. **forja:qa** si la feature tiene UI: un flujo feliz y uno de error, consola, red y los estados de UI de la spec; accesibilidad y responsive si la spec los pide. Informe `reviews/qa.md`. Los snapshots de navegador solo viven en ese subagente.
3. **forja:security** en L2 o si toca auth, pagos, permisos, archivos o SQL crudo: informe `reviews/security.md`. Para auditar toda la app sugiere al usuario `/forja:security-audit`.
4. Hallazgos abiertos: vuelve a `/forja:build` solo con esas correcciones. Máximo 2 rondas; si persisten, consulta al usuario.
5. Sin hallazgos: 3 líneas (criterios con evidencia, riesgos residuales) y sugiere `/forja:ship`.

Cada afirmación lleva el comando que la respalda. Sin sobreingeniería ni nitpicks.
