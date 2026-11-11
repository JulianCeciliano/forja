---
name: debug
description: "Bugs, fallos de tests y errores en producción: reproducir con un test que falla, hallar la causa raíz, arreglo mínimo, test verde. Úsala ante cualquier comportamiento incorrecto antes de proponer un arreglo."
argument-hint: "<síntoma, error o ruta del fallo>"
allowed-tools: Bash(node *forja.mjs* status --line) PowerShell(node *forja.mjs* status --line)
---

# Debug — causa raíz antes que parche

Estado: !`node "${CLAUDE_PLUGIN_ROOT}/scripts/forja.mjs" status --line`

1. **Reproduce** con un test que falle por la razón correcta (Pest/Vitest; browser test si es de UI). Sin reproducción no hay arreglo: si no puedes reproducirlo, pide datos al usuario.
2. **Evidencia** antes de teorizar, con lo que exista:
   - Laravel Boost MCP: último error, logs del navegador, esquema de BD (herramientas Last Error, Read Log Entries, Browser Logs y Database Schema).
   - Fallos de front: Chrome DevTools MCP (consola y red), en un subagente `qa` si el snapshot es pesado.
   - Logs filtrados (`| tail -40`), nunca completos.
3. **Hipótesis** una por vez, con la comprobación que la confirma o descarta. Regla de parada: tras 2 hipótesis fallidas, detente, resume lo descartado y pide al usuario contexto o decisión; no sigas adivinando.
4. **Arreglo mínimo** en la causa, no en el síntoma; sin refactors ni mejoras de paso. Si toca más de 3 archivos o datos/auth, `/forja:triage` y sube de nivel.
5. **Test verde** y el resto de la suite relacionada (el hook Stop corre los checks). Si el bug nació de un hueco de tests, el test de reproducción se queda.
6. Responde en ≤5 líneas: causa raíz, arreglo, test que lo protege.

Hotfix en producción: mismo ciclo con el cambio más pequeño posible y PR directo vía `/forja:ship`; el refactor, aparte.
