# Next Steps

## HECHO

- Fase 1 IA presentacional: `/` ahora es HOME de marca/venta y no muestra formulario de creación.
- `/torneos` ahora es hub operativo: lista torneos desde `useWorldSeriesPractice`, selecciona hacia `/dashboard` y muestra `+ Nuevo torneo` con progressive disclosure.
- `/dashboard` quedó de-duplicado: una sola CTA a Operator, podio full-width y motores informativos intactos.
- Sidebar: el lockup BF/BRACKETFLOW enlaza a `/`.
- Topbar: mapa ruta→título ajustado para `/` y `/torneos`.
- Decisión de lenguaje fijada: BracketFlow usa "Partida" en UI visible, no "Game". Variables, campos y endpoints se mantienen en inglés.

## ESTADO

- Fase actual limitada a presentación, routing y copy visible.
- No se tocaron scoring, backend, auth, schemas, migraciones ni lógica de motores.
- Los motores siguen siendo cards visuales.
- `/stream` sigue fuera del shell operator; overlays OBS se mantienen como mundo broadcast independiente.
- `app/docs/NEXT_STEPS.md` es la ruta documental existente en este repo.

## SIGUIENTE

- Fase de motores: model lock → Rebirth → Roulette+pozo → Challonge.

## BLOQUEOS

- Modelo definitivo de motores y contratos de scoring pendiente de cierre.
- Roulette prize pool/respin queda fuera hasta la fase de motor correspondiente.
- Auth/login al crear torneo queda para sprint aparte.

## VERIFICAR

- `npm run lint`
- `npm run build`
- Rutas 200: `/`, `/torneos`, `/dashboard`, `/operator`, `/standings`, `/equipos`, `/ajustes`.
- Overlays intactos: `/stream?obs=1&bg=transparent&layout=sidebar` y `/stream?obs=1&bg=transparent&layout=lower` transparentes y sin shell.
- Dashboard: una sola CTA "Ir a Operator · cargar Partida {n}", sin tiles de Standings/Stream ni "Gestionar torneos".
- HOME: sin form de creación a la vista.
- Torneos: lista vía reads existentes; "Nuevo torneo" abre el form existente.
- UI visible: "Partida" aplicado de cara al usuario; nombres de código como `game_number`, `currentGameNumber` y `tournament.game` se mantienen.
