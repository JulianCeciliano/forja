# Criterios de UI profesional

## Qué la hace parecer profesional
- **Jerarquía clara**: un elemento principal por vista; tamaño, peso y color guían el orden de lectura. El botón primario es único por región.
- **Escala consistente**: tipografía en una escala (p. ej. 12/14/16/20/24/32), espaciado en múltiplos de 4 u 8, 2 pesos de fuente por familia. Interlineado 1.4-1.6 en texto, 1.1-1.3 en títulos. Línea de lectura de 60-75 caracteres.
- **Color con disciplina**: neutros con un leve tinte de la marca, un acento, semánticos (éxito, aviso, error, info). El acento ocupa poca superficie. Fondos y bordes de baja saturación; sombras suaves y de pocas capas.
- **Alineación y ritmo**: bordes alineados a una rejilla; mismo espaciado entre elementos del mismo nivel; más aire entre grupos que dentro de ellos. Padding interior uniforme en tarjetas.
- **Densidad adecuada**: tablas y paneles de trabajo compactos, páginas de marketing y onboarding con más aire. Alturas de control uniformes (32/36/40 px).
- **Detalle**: radios coherentes (el interior = exterior menos el padding), iconos de un solo set y tamaño, estados hover/focus/active/disabled visibles, transiciones de 120-200 ms con easing suave, `prefers-reduced-motion` respetado.
- **Texto con voz**: etiquetas concretas ("Guardar cambios", no "Enviar"), vacíos que explican qué hacer, errores que dicen cómo arreglarlo, números formateados (moneda, fechas, plurales) con `Intl`.
- **Datos reales**: nombres largos, cero elementos, mil elementos, textos en otro idioma: la UI aguanta (truncado con título, paginación, wrap).

## Vicios típicos de UI generada por IA (evítalos)
- Degradados púrpura-azul, fondos con blobs o "glassmorphism" sin razón; sombras grandes en todo.
- Todo en tarjetas con borde, sombra y radios grandes, anidadas; rejilla de 3 tarjetas con icono + título + frase como solución universal.
- Iconos en círculo de color encima de cada título; emojis como iconos; Lucide en tamaños mezclados.
- Texto centrado en bloques largos; títulos con degradado; mayúsculas con tracking en todo.
- Cada elemento con acento de color distinto; paleta por defecto de Tailwind sin tokens propios; gris puro sobre blanco puro.
- Lorem ipsum, "Acme", "John Doe", métricas redondas inventadas, estados vacíos que no existen.
- Botones de ancho completo por defecto, dos primarios juntos, "Cancelar" con el mismo peso que "Guardar".
- Animaciones de entrada en todo, rebotes, parpadeos; spinners donde cabe un skeleton.
- Desbordes a 375 px, tablas que rompen la página en vez de desplazarse en su contenedor, alturas fijas que cortan texto.
- Modo oscuro por inversión (negro puro, bordes invisibles, imágenes sin ajustar) en vez de tokens propios.
- Componentes shadcn sin personalizar: si se ve como la demo, falta identidad (radio, color de acento, tipografía, densidad).

## Accesibilidad (mínimos verificables)
- Contraste 4.5:1 en texto normal, 3:1 en texto grande y bordes de controles; no solo color para comunicar estado.
- Todo operable con teclado; foco visible y ordenado; sin trampas; `Esc` cierra diálogos y devuelve el foco (Radix/shadcn ya lo hace: no lo rompas).
- HTML semántico primero (`button`, `a`, `label`, `nav`, `main`, encabezados en orden); ARIA solo cuando no hay elemento nativo.
- Cada control con nombre accesible; imágenes con `alt` (vacío si decorativas); errores de formulario asociados (`aria-describedby`) y anunciados.
- Áreas táctiles de al menos 44x44 px; zoom al 200 % sin pérdida; `lang` correcto.

## Responsive
- Mobile first; puntos de quiebre del proyecto. Revisa 375, 768 y 1280 px. Navegación que colapsa, tablas con desplazamiento propio o vista en tarjetas, objetivos táctiles amplios, sin hover como única vía.

## Checklist de revisión visual (usa con el agente qa)
- [ ] 375/768/1280 px, claro y oscuro, sin desbordes ni solapes
- [ ] Estados: vacío, carga, error, éxito, deshabilitado vistos de verdad
- [ ] Jerarquía legible en 3 segundos: ¿qué es lo principal?
- [ ] Foco visible al tabular; formulario completable solo con teclado
- [ ] Consola sin errores ni advertencias; sin peticiones fallidas
- [ ] Coherente con `docs/design/system.md` (sin valores sueltos)
