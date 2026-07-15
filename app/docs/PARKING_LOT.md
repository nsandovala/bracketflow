# BracketFlow - Parking Lot

> Capturado el 2026-06-23.
> Este documento preserva ideas de producto, monetizacion y automatizacion.
> No define el foco del sprint actual.

## H2 Home Product Story

- `feat/home-product-story` agrega `bf-home-story` como bloque editorial de producto debajo de las cards del Home aprobado.
- El hero Gedeon Arena y su canvas no se tocan en esta fase.
- Lo que sigue fuera de este sprint se mantiene igual: Dashboard operativo premium, Push Mode, OGL/WebGL, OCR y agentes/copilot.

## Home Gedeon Arena - siguiente capa futura

- El Home ya quedó implementado y endurecido en `feat/ui-home-gedeon-arena` con canvas custom sin librerías, circuitos saliendo desde el contorno exterior del casco y brasas en hero/cards.
- La prioridad vigente se mantiene: desktop/laptop primero, tablet segundo, mobile safe sin mandar sobre desktop.
- El siguiente salto visual futuro, si se aprueba, es migrar el FX a OGL/WebGL para ganar profundidad manteniendo control de performance.
- `Saber Más` puede crecer como superficie editorial/explicativa sin tocar el hero aprobado.
- `Push Mode` sigue como backlog de producto y no debe mezclarse con este hardening.
- OCR sigue diferido para flujos operativos/resultados.
- agentes/copilot siguen diferidos hasta que la base manual esté más consolidada.
- Dashboard operativo premium sigue siendo la siguiente superficie importante después del Home.

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

Switcharo Team Builder

Contrato futuro:

Switcharo no cambia el bracket ni el scoring.
Solo cambia la política de armado de equipos:
1 jugador de pool KD bajo/medio + 1 jugador de pool KD medio/alto.
Luego el torneo sigue como Kill Race BO3 normal.

Eso después puede ser roster_policy: "switcharo" dentro del mismo motor Kill Race. No inventes otro motor todavía.

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

## Kill Race — futuras mejoras

- Mostrar en campeón: total de kills del torneo / serie final.
- Switcharo/KD: ruleta por buckets KD bajo-medio y KD medio-alto para formar equipos balanceados.
- OCR/prints para carga asistida de resultados.
- Agentes/copilot solo como propuesta pendiente; el core debe funcionar manual-first.

## UI/UX — Arena dorada Gedeon

Feature visual futura para rediseño de Gedeon Roulette y momentos de torneo.

Objetivo:
Convertir la experiencia de ruleta/bracket/campeón en una arena digital premium.

Aplicaciones:
- partículas doradas tipo arena en ruleta;
- glow dorado al generar equipos;
- efecto de campeón con borde/trofeo/casco;
- líneas doradas sutiles en bracket ganador;
- variantes de partículas por estado: operativo, arena, campeón.

Reglas:
- no usar efectos que tapen datos;
- no romper performance;
- no parecer casino;
- animaciones cortas y con propósito;
- accesible/reducible con prefers-reduced-motion.

Prioridad:
Después de cerrar F0 y durante `feat/ui-ux-operator-bracket-polish`.
