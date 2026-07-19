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
