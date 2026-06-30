# tournament-reporter

Agente interno de BracketFlow. Genera el **reporte post-torneo** en JSON a partir
de los datos reales del backend. Read-only: lee, nunca escribe en la app.

> Contrato vinculante: `tournament-reporter.agent.yaml`. Este documento es la
> versión humana; ante cualquier duda, manda el YAML.

## Qué hace

Cuando un torneo termina, el operador lo dispara con el `tournament_id`. El agente:

1. Lee cuatro endpoints GET del backend (torneo, equipos, leaderboard, resultados).
2. Arma un resumen: campeón, podio, MVP de kills, rondas jugadas.
3. Escribe un JSON con el ranking completo, el desglose por ronda y **dos salidas
   de texto**: una casual para redes/stream y una formal.
4. Opcionalmente emite un evento al overlay para mostrar una tarjeta de resultados.

## Qué NO hace (la correa)

- No llama nada que no sea GET. No muta torneos.
- No inventa métricas. Solo usa campos que el backend devuelve de verdad.
- **Prohibido**: "API verified", "print approved", pozos en dinero, bitrate de
  streams, anti-cheat, kills automáticas. Nada de eso existe en el backend; si el
  agente lo produce, está fabricando datos y viola el contrato.
- Si no hay resultados, dice "sin resultados". No rellena para que se vea lindo.
- No toca git ni hace commits.

## Cómo se usa

```
# pseudo-CLI, según se implemente
tournament-reporter --tournament-id 7 --base-url http://127.0.0.1:8000
# -> escribe reports/report-7.json
# -> (opcional) emite evento tournament_report al overlay
```

La implementación (script o módulo) se define en un paso aparte, una vez aprobado
este contrato. No se construye junto con el fix de la Fase 1.

## Forma del JSON de salida

Estructura (los valores entre `<>` son tipos, no datos):

```json
{
  "schema_version": "1.0",
  "generated_at": "<ISO-8601>",
  "tournament": {
    "id": "<int>",
    "name": "<string>",
    "game": "<string>",
    "format": "<roulette_2v2 | roulette_3v3 | battle_royale_points | single_elimination>"
  },
  "summary": {
    "champion":   { "team_name": "<string>", "members": ["<nickname>"], "total_points": "<int>" },
    "podium":     [ { "rank": "<int>", "team_name": "<string>", "total_points": "<int>", "kills": "<int>", "best_placement": "<int|null>" } ],
    "mvp_kills":  { "team_name": "<string>", "kills": "<int>" },
    "rounds_played": "<int>",
    "teams_count": "<int>"
  },
  "leaderboard": [
    {
      "rank": "<int>",
      "team_name": "<string>",
      "members": ["<nickname>"],
      "total_points": "<int>",
      "kills": "<int>",
      "placement_points": "<int>",
      "best_placement": "<int|null>",
      "matches_played": "<int>"
    }
  ],
  "rounds": [
    {
      "round": "<int>",
      "results": [
        { "team_name": "<string>", "kills": "<int>", "placement": "<int>", "total_points": "<int>" }
      ]
    }
  ],
  "outputs": {
    "social": "<string: texto casual en español, listo para copiar a redes/stream>",
    "report": "<string: texto formal en markdown>"
  }
}
```

Cada campo traza a un endpoint real:
- `tournament` ← `GET /tournaments/{id}`
- `leaderboard[].members` ← `GET /tournaments/{id}/teams` (`team.members[].player.nickname`)
- `leaderboard[]` ← `GET /tournaments/{id}/leaderboard` (ya ordenado por el backend)
- `rounds[]` ← `GET /tournaments/{id}/results`
- `summary.champion` ← primer elemento del leaderboard

## Las dos salidas

- **`outputs.social`** — tono casual chileno, corto, para Twitter/Discord o leer al
  aire. Ej. de estilo (no contenido real): "Cerramos el torneo 👑 Campeón: <equipo>
  con <X> pts. MVP de kills: <equipo> (<N> kills). GG a todos."
- **`outputs.report`** — markdown formal: tabla de posiciones, desglose por ronda,
  datos completos. Para guardar o compartir como cierre serio.

Ambas se redactan **solo** con los datos del JSON. Si un número no está en el
leaderboard o en los resultados, no aparece en ningún texto.

## Enchufe con el overlay

El JSON puede emitirse como evento `{ "type": "tournament_report", "data": {...} }`
al feed del overlay (`~/.amon/events.jsonl` / WebSocket), para mostrar una tarjeta
de resultados al cerrar el stream. Es el mismo canal que ya usan el ticker y el
panel "En obra".