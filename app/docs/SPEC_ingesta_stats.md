# SPEC — Ingesta de stats por screenshot (Sprint D3 extendido)

**Fecha:** 2026-07-01 · **Fase:** 1 (Datos) · **Repo:** docs/SPEC_ingesta_stats.md
**Decisión congelada:** se capturan **kills + daño por jugador por partida**. MVP kills, MVP daño y equipo ganador son **derivados por query, nunca almacenados**.

---

## 1. Esquema (fundamento de todo)

```sql
-- Identidad de jugador (Activision ID OPCIONAL en marcha blanca;
-- requerido solo al confirmar roster en torneos con OCR activado)
ALTER TABLE players ADD COLUMN activision_id TEXT;   -- "Manteca#1234567" (completo, con tag)
ALTER TABLE players ADD COLUMN display_name TEXT;    -- "Manteca" (derivado: parte antes del #)

-- Unicidad POR TORNEO, no global (dos torneos distintos pueden repetir)
CREATE UNIQUE INDEX idx_activision_per_tournament
  ON tournament_players(tournament_id, activision_id)
  WHERE activision_id IS NOT NULL;

CREATE TABLE player_match_stats (
    id INTEGER PRIMARY KEY,
    match_id INTEGER NOT NULL REFERENCES matches(id),
    player_id INTEGER NOT NULL REFERENCES players(id),
    kills INTEGER NOT NULL DEFAULT 0,
    damage INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'manual',   -- 'manual' | 'ocr'
    created_at TEXT NOT NULL,
    UNIQUE(match_id, player_id)
);

-- Tabla de alias: resuelve gamertag del print -> jugador registrado
CREATE TABLE player_aliases (
    id INTEGER PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES players(id),
    alias TEXT NOT NULL,            -- normalizado (lower, sin decoraciones)
    UNIQUE(alias)
);
```

Derivados (queries, no columnas):
- **Top fragger del torneo:** `SUM(kills) GROUP BY player_id ORDER BY 1 DESC LIMIT 1`
- **Top daño:** ídem con `damage`.
- **Equipo ganador:** según reglas del motor (TOURNAMENT_RULES.md), calculado desde matches/standings.
- El MVP puede ser de un equipo que NO ganó — correcto por diseño, son verdades independientes.

## 2. Pipeline de ingesta

```
[print .png/.jpg] → [Visión-LLM parsea a JSON] → [Matching de nombres]
      → [TABLA DE PREVIEW EDITABLE] → operador corrige/confirma → [POST → DB]
```

**Regla inviolable: el OCR nunca escribe directo a la DB.** Siempre pasa por la tabla de preview donde el operador confirma. El OCR asiste; el operador decide.

### 2.1 Parseo (visión)
- Motor: modelo de visión con salida estructurada (Qwen-VL vía OpenRouter, o Claude API como fallback — misma interfaz).
- Prompt exige JSON estricto y nada más:
```json
[{"gamertag": "xX_Manteca_Xx", "kills": 17, "damage": 4582}]
```
- Validaciones post-parseo (rechazan la fila, no el batch): kills 0–60, damage 0–30000, gamertag no vacío. Fuera de rango → fila marcada "revisar" en el preview.
- Timeout 20s; si el modelo falla, el operador carga manual en la misma tabla (el flujo no se bloquea nunca).

### 2.2 Matching de nombres (la parte difícil)

**Nota clave:** el scoreboard NO muestra el tag numérico — solo el display name. El Activision ID completo da unicidad en el registro; el matching corre contra `display_name`. Los jugadores pueden renombrarse y el OCR confunde caracteres (`l`/`I`, `O`/`0`), así que la tabla de alias sigue siendo necesaria como red de seguridad.

Orden de resolución por cada gamertag parseado:
1. **Exacto** contra `players.display_name` (case-insensitive, trim); fallback a `players.name` para jugadores sin Activision ID.
2. **Alias** contra `player_aliases`.
3. **Normalizado:** quitar decoraciones (`xX`, `_`, `.`, dígitos finales, clan tags entre corchetes) y reintentar 1 y 2.
4. **Fuzzy:** distancia Levenshtein ≤ 2 sobre el normalizado → se propone con badge "¿es este?" en el preview.
5. **Sin match:** fila queda en amarillo, el operador asigna desde un dropdown del roster. Al confirmar, se guarda como alias nuevo → **la segunda vez ya matchea solo**. El sistema aprende por torneo.

### 2.3 UX del preview (Operator)
- Dropzone de imagen en la vista de carga de resultados del match.
- Tabla editable: jugador (resuelto o dropdown), kills, damage. Filas con problema en amarillo.
- Botón único "Confirmar y guardar" → POST transaccional (todo o nada por match).
- `source='ocr'` queda registrado para trazabilidad.

## 3. Scope de marcha blanca (acotado a propósito)

**TXT de inscripción retrocompatible** (parser de Sprint E4 acepta ambas formas):
```
manteca                        <- sigue válido (solo display name)
demian,Demian#7734512          <- nuevo formato con Activision ID
```
Regla: si el torneo tiene OCR activado, el sistema exige Activision ID al **confirmar roster** (no al inscribir). Sin OCR, todo sigue como hoy.

- ✅ OCR asiste con los prints que el operador suba (1..n imágenes por match).
- ✅ Carga manual siempre disponible en la misma tabla (fallback total).
- ❌ Full-lobby automático en BR de 50 squads (scoreboard paginado, varias capturas) — fase posterior, cuando el pipeline esté probado con lobbies chicos.
- ❌ Stats adicionales (revives, headshots) — el esquema lo permite a futuro, no se capturan ahora.

## 4. Anti-humo

1. **F5 survival:** subir print, confirmar, recargar → stats persisten (SELECT sobre `player_match_stats` mostrando las filas con `source='ocr'`).
2. Print real de una scrim de Gedeón parseado end-to-end, con al menos un nombre resuelto por alias/fuzzy y uno asignado a mano que quede aprendido.
3. Standings muestra Top Fragger y Top Daño calculados por query, y coinciden con la suma manual de los prints.
4. Simular fallo del modelo de visión (apagar red/API key mala) → el flujo manual sigue operativo sin error visible feo.
5. Inscripción mixta: TXT con jugadores con y sin Activision ID importa sin error; torneo con OCR activado bloquea confirmación de roster si falta algún ID (mensaje claro de quiénes faltan).

## 5. División de trabajo sugerida (council)

- **Codex:** esquema + migración + endpoints (POST stats transaccional, GET derivados) + matching (funciones puras, testeables sin UI).
- **Qwen3.6:** integración del modelo de visión + prompt de parseo + validaciones de rango.
- **Kimi (o Codex):** tabla de preview en Operator, consumiendo el sistema de diseño (Fase 2).
- **Claude (validación):** revisar el prompt de visión, los casos de fuzzy matching, y la transaccionalidad del POST antes del OK.