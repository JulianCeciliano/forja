---
name: frontend
description: "Crea o modifica interfaces React + Inertia + Tailwind + shadcn/ui que se vean profesionales y no genéricas: tokens y dirección visual primero, todos los estados, responsive, modo oscuro, accesibilidad y verificación visual en el navegador. Cárgala al construir o cambiar pantallas y componentes."
argument-hint: "[pantalla o componente]"
---

# Frontend

Boost ya enseña la API de Inertia, Tailwind y Wayfinder (skills `inertia-react-development`, `tailwindcss-development`, `wayfinder-development`): úsalas y la herramienta Search Docs para la sintaxis. Esta skill decide el aspecto y cuándo algo está terminado. Si el plugin `frontend-design` de Anthropic está instalado, úsalo como complemento para la dirección estética.

## Procedimiento
1. **Dirección visual y tokens** (una vez por proyecto). Si no existe `docs/design/system.md`, créalo (≤40 líneas): personalidad en 3 adjetivos, color (neutros + 1 acento + semánticos), tipografía (familia y escala), espaciado, radios, sombras, motion. Si el usuario dio referencias, pídele que corra `/forja:visual-ref` (tú no puedes invocarla) para traducirlas a esto. Sin referencias, propón 2 o 3 direcciones y deja elegir. Vuelca los tokens en el tema de Tailwind (`@theme`/variables CSS de shadcn), modo claro y oscuro, y úsalos siempre; sin valores sueltos.
2. **Componer, no inventar**: shadcn/ui del proyecto (`npx shadcn@latest add <componente>`) y los primitivos existentes en `resources/js/components`. Reutiliza antes de crear; un componente nuevo solo si se usa 2+ veces o tiene estado propio.
3. **Construir la pantalla con todos sus estados**: vacío, cargando (skeleton con la forma del contenido), error (con salida accionable), éxito, deshabilitado/sin permiso. Datos reales o factories, no lorem ipsum.
4. **Formularios con Inertia** (`useForm` o `<Form>`): errores bajo cada campo, `processing` deshabilitando el envío, foco al primer error, valores conservados tras el fallo. Validación de verdad en servidor.
5. **Rendimiento percibido**: skeletons y `<Deferred>` para lo lento, actualizaciones optimistas en acciones frecuentes, `prefetch` en enlaces de navegación probable, imágenes con tamaño y `loading="lazy"`.
6. **Verificación visual obligatoria** (ver abajo) y iterar hasta que se vea bien.

## Verificación visual
Código correcto no es interfaz terminada. Mira la pantalla:
- Delega en el agente `qa` (contexto aislado, evidencia en archivos; ver skill `qa`) con la URL, el flujo y el criterio de [criterios.md](criterios.md). O captura tú a 375, 768 y 1280 px, claro y oscuro, y revisa las imágenes.
- Corrige lo que falle en la lista de [criterios.md](criterios.md) (ábrelo al evaluar: lista de qué hace profesional una UI y de vicios de UI generada por IA) y repite. Máximo 3 rondas; si persiste, resume el problema al usuario.
- Cierra con comandos: `npx tsc --noEmit`, lint y `npm run build` limpios, y sin errores en la consola del navegador (herramienta de logs de Boost o `qa`).

## Hecho cuando
Todos los estados existen y se vieron en el navegador, sin desbordes a 375 px, contraste y foco correctos, claro y oscuro coherentes con `docs/design/system.md`, tipos y build limpios, y ningún vicio de la lista de [criterios.md](criterios.md).
