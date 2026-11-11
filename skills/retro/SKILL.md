---
name: retro
description: "Cierre de una feature: mide el consumo real de tokens, fusiona la spec en docs/system y propone como máximo 3 mejoras al flujo. Solo se invoca a petición del usuario."
disable-model-invocation: true
argument-hint: "<slug de la feature, opcional>"
---

# Retro

Objetivo: que el siguiente ciclo sea más barato y mejor, sin sobreingeniería.

1. Consumo: `node .forja/forja.mjs metrics`. Resume en 3 líneas qué fase o agente gastó más y si valió la pena (¿el validator encontró algo real? ¿algún builder repitió trabajo?). `/usage` complementa con skills y MCP.
2. Spec viva: fusiona el resultado final de `docs/specs/<slug>/` en `docs/system/<slug>.md` (≤1 página: qué hace el sistema hoy, decisiones, rutas y datos) y marca la feature como hecha en `docs/system/backlog.md` si existe. No copies lo que ya está en el código.
3. Mejoras: **máximo 3** cambios concretos al flujo, cada uno con evidencia (corrección repetida por el usuario, paso que no aportó, skill que no se activó): una línea para CLAUDE.md, un ajuste en `.forja/config.json`, una skill o hook.
4. No apliques cambios al framework: propónlos y espera la decisión.
5. Si el usuario confirma que la feature terminó: `node .forja/forja.mjs done`.

Sin métricas todavía, no inventes cifras: dilo. Cada línea nueva de CLAUDE.md debe ganar su lugar (archivo bajo 60 líneas).
