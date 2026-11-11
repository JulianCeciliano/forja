---
name: visual-ref
description: Toma referencias visuales de otros sitios web (paleta, tipografía, espaciado, layout, componentes, microinteracciones) con el navegador y las traduce a tokens propios. Úsala cuando el usuario cite un sitio de referencia o pida inspiración de diseño. Deja docs/design/references/.
argument-hint: "[URL(s) o descripción del estilo buscado]"
disable-model-invocation: true
---

# Referencias visuales

Límite: se toma inspiración de **patrones y sistema visual** (proporciones, jerarquía, escala, ritmo, estructura de layout, comportamiento). No se copian logos, marca, textos, imágenes, iconografía propietaria ni el diseño píxel a píxel. El resultado final debe ser reconociblemente de este proyecto.

## Sin referencias del usuario
Propón 2 o 3 direcciones (una línea cada una: personalidad, color dominante, tipografía, densidad, ejemplo de producto del mismo tipo que sirva de referencia) y deja elegir. Si el usuario elige, sigue con las URL; si no quiere ver sitios, pasa directo a `docs/design/system.md` (skill `frontend`).

## Procedimiento (en subagente)
Delega en el agente `qa` o en un subagente aparte: las capturas y los snapshots llenan el contexto. Pásale la URL, el nombre corto y qué interesa (landing, dashboard, formularios...). Debe responder en ≤10 líneas.
1. Abre la URL con el navegador (Playwright CLI/MCP o Chrome DevTools MCP; ver skill `qa` para elegir). Si hay banner de cookies o login, ciérralo o pide al usuario capturas.
2. Capturas a 375, 768 y 1280 px (y modo oscuro si existe) a `docs/design/references/<nombre>/` (`mobile.png`, `tablet.png`, `desktop.png`). Una página por vista relevante, no el sitio entero.
3. Extrae, con una evaluación de script puntual y acotada (estilos computados de títulos, párrafo, botón, tarjeta, fondo): paleta (hex, roles), familias y tamaños tipográficos con interlineado, escala de espaciado, radios, sombras, anchos máximos y rejilla, densidad.
4. Anota patrones: estructura de layout, navegación, componentes distintivos, microinteracciones (hover, transiciones, scroll, estados) y qué los hace funcionar.
5. Escribe `docs/design/references/<nombre>.md` (≤60 líneas) con: URL y fecha, qué se observó, qué se adopta como principio y qué no se adopta. Formato de tabla para paleta y escala.

## Traducción a tokens propios
Con la elegida (o la mezcla de 2), actualiza `docs/design/system.md`: valores **propios** derivados (otro matiz o tinte, otra familia tipográfica de proporciones similares, misma lógica de escala), no los copiados. Anota de cada token de dónde viene el principio. El usuario aprueba antes de pasar a `frontend`.

## Hecho cuando
Existe `references/<nombre>.md` con capturas en archivo, `system.md` propone tokens propios y el usuario eligió la dirección. Verifica que no queda ningún activo ajeno (logo, imagen, texto) en el repositorio.
