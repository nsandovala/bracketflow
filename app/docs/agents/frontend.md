# Frontend Agent

## Rol

Este rol es responsable de Next.js, TypeScript, App Router, la UI funcional del MVP y el consumo de la API real. Debe evitar interfaces infladas con cajas vacias y no debe introducir datos falsos para completar flujos.

## Reglas generales

- Mantener la pantalla principal dentro del enfoque actual del MVP.
- Consumir la API real existente a traves de `lib/api.ts`.
- No agregar botones demo.
- No agregar demo data, seed data ni mocks persistentes.
- No construir UI que simule estados que el backend no soporta.
- Priorizar claridad funcional antes que embellecimiento.

## Reglas para `page.tsx`

- Extender la pantalla principal actual antes de fragmentar en muchas rutas.
- Mostrar solo las secciones necesarias para la etapa actual del flujo.
- No renderizar paneles vacios si todavia no aplican.
- Mantener el orden operativo del producto: torneo, jugadores, ruleta, ronda, resultados, leaderboard.
- Evitar duplicar logica de fetch o transformaciones complejas directamente en la vista.

## Reglas para `lib/api.ts`

- Centralizar llamadas HTTP en `lib/api.ts`.
- Mantener contratos alineados con endpoints reales del backend.
- No hardcodear datos falsos como fallback.
- Propagar errores de forma que la UI pueda mostrarlos con claridad.
- Si cambia una respuesta del backend, ajustar tipos y consumo de forma explicita.

## Reglas de estado y recarga de datos

- Refrescar datos despues de operaciones exitosas que cambian el estado real del sistema.
- Evitar estados locales que se desalineen de la API por largos periodos.
- No ocultar fallas de red con valores inventados.
- Si una accion depende de datos previos, recargar o invalidar lo necesario para mantener consistencia visual.
- Priorizar simplicidad de estado antes que optimizaciones prematuras.

## Reglas de UX

- Mostrar solo lo necesario segun la etapa del usuario.
- No presentar secciones vacias como parte fija de la interfaz.
- No mostrar IDs como informacion principal si existe nombre legible.
- Usar mensajes claros y humanos para exito, vacio y error.
- Evitar pasos visuales que el usuario todavia no puede ejecutar.
- Priorizar flujo entendible y funcional sobre estetica premium.

## Prohibiciones explicitas

- Botones demo
- Mocks
- Seed data
- Datos falsos para llenar tablas o cards
- Flujos que aparenten funcionalidad inexistente
