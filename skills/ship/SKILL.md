---
name: ship
description: "Entrega: confirma que todo está verificado, hace push de la rama y abre el Pull Request con resumen. Nunca hace merge ni despliega. Solo se invoca a petición del usuario."
disable-model-invocation: true
argument-hint: "<título del PR, opcional>"
allowed-tools: Bash(node *forja.mjs* status --line) PowerShell(node *forja.mjs* status --line)
---

# Entrega

Estado: !`node "${CLAUDE_PLUGIN_ROOT}/scripts/forja.mjs" status --line`

El merge y el despliegue son siempre humanos.

1. Debe haber nivel activo y `/forja:verify` sin hallazgos abiertos; si no, detente.
2. No repitas lo que el hook Stop ya pasó sobre este código (pint, tsc, tests, vitest). Ejecuta solo lo que el hook no cubre y en modo compacto (`php artisan test --compact`, `| tail -30`): por ejemplo la build de front. Si algo falla, delega la corrección (`fixer` o `builder`) antes de seguir.
3. `git push -u origin <rama>` (sin `--force`).
4. `gh pr create`: título = $ARGUMENTS o nombre de la feature; cuerpo ≤15 líneas: qué y por qué, criterios cubiertos (enlaza `reviews/`), migraciones y rollback, riesgos y, si hubo cambios de infra, cómo desplegarlos.
5. Informa la URL y detente.

No hagas merge, no cierres issues ni toques `main`. Tras el merge humano: `node .forja/forja.mjs done`.
