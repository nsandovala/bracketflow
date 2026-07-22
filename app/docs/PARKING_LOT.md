# BracketFlow - Parking Lot

> Capturado el 2026-07-14.  
> Este documento preserva backlog y temas diferidos.  
> No define el foco del sprint actual.

## Dashboard operativo - siguiente capa futura

- Expandir `Next Action` cuando existan mas estados backend reales.
- Agregar metricas avanzadas solo si el backend las expone de forma confiable.
- Mostrar pending reports globales solo cuando exista fuente real y no inferida.
- Evaluar Caster Suite como panel separado, no como ruido dentro del dashboard base.
- Evaluar Push Mode y OCR solo despues de congelar el flujo manual.

## Home Gedeon Arena

- Mantener el hero aprobado sin reabrir redisenio.
- `bf-home-story` puede crecer como superficie editorial sin tocar canvas.
- OGL/WebGL sigue como evolucion futura del FX, no como deuda de este sprint.

## QA / CI del repo

- Si el repo suma tests frontend reales, integrarlos a `scripts/qa.ps1` y a CI.
- No crear jobs placeholder que fallen por diseno.
- Mantener la regla de un dominio por commit tambien en ramas de QA/CI.

## Producto / roadmap

- Push Mode
- OCR MVP
- Caster Suite
- Discord bot
- agentes/copilot

## Report Intake - diferido (2026-07-18)

- Flujo de reemplazo/edicion de reporte oficial por partida/equipo
  ("Editar/reemplazar reporte"). Hoy un conflicto CSV vs reporte oficial se
  marca "Conflicto / revisar" y el reporte oficial existente queda como fuente
  de verdad; no hay sobreescritura desde import. Desde el hardening P1
  (2026-07-18) el backend es create-only: POST /matches/{id}/results devuelve
  409 si ya existe resultado para ese match/equipo. Corregir un reporte
  requerira un "explicit correction flow" con decision de producto y auditoria.

## Reglas de backlog

- No mezclar estas piezas con fixes chicos de UI.
- No vender una idea de parking lot como feature ya terminada.
- No tocar backend para adelantar dashboard visual si el contrato de datos aun no existe.

## Parking Lot — OCR / Stats Automation

### P0 actual
BracketFlow no dependerá de APIs externas para operar torneos. El core será:
Manual / CSV-TXT / OCR / Discord / Copilot → Draft revisable → Reporte oficial confirmado por humano.

### OCR estructurado futuro
- Subida de screenshot.
- Preprocesado de imagen.
- Detección de tabla/scoreboard.
- Extracción de equipo, jugadores, kills, placement, damage.
- Confianza por campo.
- Corrección manual.
- Nunca escribir resultados oficiales sin confirmación.

### Stream/OBS Intelligence futuro
- Un solo link OBS por torneo.
- El caster no cambia URL.
- El operador cambia estado/datos.
- El stream se actualiza solo.
- Overlays por URL estable:
  - standings
  - top fraggers
  - match status
  - champion
  - caster panel

### Activision/API externa
- Solo research/opt-in.
- No core MVP.
- No promesa comercial.
- Riesgo por dependencia externa, autenticación, perfiles privados, cambios de endpoint y bloqueo.

## Player Identity / Player Profiles / Historical Stats

### Product thesis

BracketFlow should not depend on external game APIs for competitive history.

Every official tournament report submitted in BracketFlow becomes a source of truth for:

- team standings
- player history
- player stats
- team history
- MVP calculations
- caster overlays
- public player profiles
- global/ranked leaderboards

### Core concept

Each player gets a BracketFlow identity.

A player may have multiple game identifiers:

- Warzone / Activision ID
- Battle.net ID
- PSN ID
- Xbox ID
- Steam ID
- Riot ID for Valorant
- Epic ID for Fortnite
- custom aliases

These external IDs are metadata only. They do not need to be verified by external APIs in MVP.

### Suggested model

```txt
Player
- id
- displayName
- country
- avatarUrl
- aliases[]
- gameIds[]
- socials[]
- createdAt
- updatedAt
GameIdentity
- id
- playerId
- game
- platform
- externalHandle
- externalTag
- verifiedStatus: unverified | claimed | verified
PlayerTournamentStat
- id
- playerId
- tournamentId
- teamId
- matchesPlayed
- kills
- damage
- bestPlacement
- averagePlacement
- points
- mvpScore
PlayerMatchStat
- id
- playerId
- tournamentId
- matchId
- teamId
- kills
- damage
- placement
- source: manual | csv | ocr | api_future
- confirmedByOperator
```

### Relacion con el repo actual (2026-07-18)

- Hoy `players` es un registro por torneo (nickname + tournament_id), no una
  identidad global. La capa Player Identity mapearia esos registros a un ID
  interno de BracketFlow.
- Desde P3, `team_result_player_stats` guarda kills por player como texto libre
  (`player_name`) dentro del reporte oficial. `PlayerMatchStat` seria la version
  identificada de ese dato: mismo origen (reporte oficial), pero ligado a un
  `playerId` interno.
- El score de equipo seguira saliendo de kills/placement del equipo; las stats
  por player son historial/detalle, nunca motor de scoring.

### MVP: registro gestionado por el operador

- El operador crea/edita players y les asocia game IDs como metadata.
- Sin login, sin cuentas, sin auth, sin verificacion externa.
- Sin scraping ni dependencia de APIs externas: los reportes oficiales de
  BracketFlow son la fuente de verdad del historial.
- `verifiedStatus` empieza siempre en `unverified`; `claimed`/`verified` son
  estados futuros que requieren un flujo de producto propio.

### Capas futuras (en orden tentativo)

1. Perfil publico de player: pagina read-only con historial de torneos,
   stats acumuladas y equipos; solo datos derivados de reportes oficiales.
2. Iconos de equipo/player: assets subidos por el operador; sin icon packs
   externos todavia (hoy explicitamente fuera de scope).
3. Overlays OBS por player: top fraggers, MVP de la partida, player cards;
   sobre las URLs estables de Stream/OBS Intelligence (ver seccion arriba).
4. Discord/Copilot: superficies de entrada/salida que crean drafts revisables
   o publican resultados ya confirmados. Nunca escriben resultados oficiales
   sin confirmacion humana (mismo contrato que OCR).

### Guardas

- NO implementar aun: esta seccion es contrato de producto, no sprint.
- No auth, no scraping, no dependencias nuevas.
- Cualquier implementacion parcial debe ser aditiva (tablas nuevas, campos
  opcionales) para no romper DBs ni reportes existentes.

### Player Identity v0 - iniciado (2026-07-21)

Estado: **v0 metadata-only** iniciado en `feat/team-player-identity-metadata-v0`.
Esto es un catalogo estable y opcional, **no** login/accounts/perfiles publicos.

Alcance v0:

- Tablas nuevas aditivas: `player_profiles`, `team_profiles`,
  `player_game_identities`. Sin FK desde `players`/`teams` de torneo hacia
  estos perfiles: el link se hara en una v1 posterior sin migracion
  destructiva.
- Endpoints solo lectura/creacion:
  - `GET /identity/players`, `POST /identity/players`
  - `GET /identity/teams`, `POST /identity/teams`
  - `GET /identity/game-identities?player_profile_id=`,
    `POST /identity/game-identities`
- Los reportes oficiales siguen siendo la fuente de verdad del scoring; esta
  capa no altera calculos ni el shape del leaderboard.
- `verified_status` empieza en `unverified` y sigue siendo estado futuro
  (ver Capas futuras arriba).
- Sin UI operator por ahora: si aparece, va detras de `/setup` o `/ajustes`
  como "Identidad / proximamente".

Fuera de v0 (siguen en backlog):

- Update/delete de perfiles.
- Edicion de display name y del resto de metadata desde UI (el contrato HTTP
  actual solo permite listar/crear).
- Link `Player.tournament -> PlayerProfile` y `Team -> TeamProfile`.
- `PlayerTournamentStat` / `PlayerMatchStat` derivadas de reportes.
- Perfiles publicos, iconos, overlays por player, Discord/Copilot.

### Identity matching en Caster/Stream v0 (2026-07-22)

- El matching actual es heuristico y solo frontend: compara nombres
  normalizados de forma exacta contra `display_name`, `short_name` y
  `game_handle`. Si hay mas de un candidato, conserva el nombre local.
- No existe merge/deduplicacion automatica ni se modifica data del torneo.
- Siguen pendientes update/delete de perfiles y auth/aislamiento por
  tenant/workspace.
- Futuro: links explicitos `TeamProfile <-> Team` y
  `PlayerProfile <-> Player` para reemplazar el matching heuristico.
