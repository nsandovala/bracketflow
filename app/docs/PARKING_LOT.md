# BracketFlow - Parking Lot

> Capturado el 2026-06-23.
> Este documento preserva ideas de producto, monetizacion y automatizacion.
> No define el foco del sprint actual.

## Norte MVP vigente

- WS Practice fluido y unificado dentro del shell de operator.
- WS en dos formatos de producto: Battle Royale y Rebirth ranked.
- Calidad visual consistente entre dashboard, operator y standings.

## Roulette team-builder

- BracketFlow ya tiene una base backend para ruleta en `crud.generate_roulette_teams`.
- Los formatos `roulette_2v2` y `roulette_3v3` ya existen.
- Lo pendiente no es el motor principal sino la UI de rueda y el flujo de RESPIN.
- Esta linea aplica especialmente al modo Rebirth estilo ranked.

## RESPIN y creditos

- Si un jugador o equipo no quiere el resultado de la ruleta, puede consumir un credito y regenerar equipos.
- La implementacion propuesta es con creditos in-app, no con cobro directo por accion.
- Cada RESPIN deberia gatillar una nueva ejecucion de `generate_roulette_teams` con otro seed.

## Clerk y anti abuso

- `Clerk` queda documentado como backlog inmediato, no como trabajo del sprint actual.
- El objetivo es identidad verificada, ownership de torneos y control de quotas.
- Email o telefono verificado deberian pesar mas que el simple conteo de cuentas.
- Device fingerprint puede existir como capa adicional, no como unica defensa.

## Modelo de planes

- Free como muestra, con limite bajo de torneos.
- Pro mensual con limite alto o torneos ilimitados.
- La definicion exacta de tiers queda para un sprint de producto o monetizacion.

## Discord bot

- Posibles tareas: publicar standings, anunciar apertura de game, compartir links de operator o stream.
- Queda abierta la decision entre bot cerrado para una comunidad puntual o instalable por terceros.
- Si se retoma, debe apoyarse en contratos claros de API y eventos.

## Rebirth

- La hipotesis actual es que Rebirth usa el mismo scoring multiplicativo ya cubierto por `WSOW_PLACEMENT_BANDS`.
- En el producto, BR vs Rebirth deberia resolverse como modo o metadata si el calculo no cambia.
- Antes de cerrar esta parte, hay que verificar si existe alguna variante real por tamano de lobby.

## Match Point

- Aplica a torneos competitivos de BR y Rebirth.
- Requiere configuracion por torneo, por ejemplo `matchpoint_threshold`.
- Un equipo en match point gana el torneo al alcanzar el umbral y luego ganar una partida.
- Esto impacta backend, estado de torneo, standings y stream.
- Queda como siguiente bloque relevante despues de unificar operator.

## Bracket BO3 completo

- Single elim BO3 ya quedo persistente en backend y operator.
- Sigue pendiente para Sprint B:
  - double elimination real
  - flujo UI de desempate manual cuando un mapa termina empatado en kills
  - cualquier RESPIN / locks de bracket
  - pulidos visuales menores de bracket/operator si aparecen roces
- No reabrir cambios de scoring WSOW ni placement al trabajar estas piezas.

## Sprint B cerrado, pendientes visuales y de UX

- El flujo de respin/lock ya vive en DB, pero la UX de countdown todavia necesita una pasada visual fina en operator y stream.
- Validar en navegador real si algun layout de `/stream?obs=1` genera overflow horizontal o vertical en 1920x1080.
- Revisar copy de botones `Locked roster ahora` / `Locked bracket ahora`; funcionalmente estan bien, pero puede mejorarse el texto final.
- Si aparecen problemas visuales en la ruleta al alternar preview/import/bracket, documentarlos aqui y no redisenar en caliente.

## Agentes de automatizacion

- No se deben crear todavia.
- Antes hay que fijar eventos, contratos de datos, formatos de salida y puntos de integracion.
- Cuando la base del producto este estable, se puede abrir un sprint especifico para stats prints, overlays u outputs automaticos.
- Contrato futuro posible:

```ts
type ReportEvidence = {
  type: "manual" | "screenshot" | "agent";
  status: "none" | "pending" | "verified" | "rejected";
  file_url?: string;
  extracted_kills?: number;
  extracted_placement?: number;
};
```

- No implementar upload, OCR ni agentes hasta abrir un sprint especifico.

## Juegos futuros

- FIFA:
  - scoring_profile probable: `head_to_head`.
  - game_mode: `head_to_head`.
  - estructuras posibles: single elim, double elim, ligas o grupos.
  - No implementar ahora.
- Valorant / CS:GO:
  - scoring_profile probable: `rounds`.
  - game_mode: `round_based`.
  - metricas: rondas ganadas, mapas, BO1/BO3/BO5.
  - No implementar ahora.
- Fortnite:
  - scoring_profile posible: `placement_points` o `custom`.
  - No implementar ahora.

## Riesgos o temas diferidos

- Cobrar porcentaje sobre apuestas con dinero real queda fuera del alcance actual.
- Ese tema requiere validacion legal antes de cualquier implementacion.
- No debe mezclarse con el SaaS base hasta tener claridad regulatoria.
