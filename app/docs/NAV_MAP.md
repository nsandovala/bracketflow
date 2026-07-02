# NAV_MAP — Mapa de Navegación BracketFlow F0

> Versión: 1.0 · Fecha: 2026-07-01 · Sprint E1
> Basado en rutas verificadas del router (App Router, route group `(operator)`).

---

## 1. Superficies y alcance

| Ruta | Archivo | Contexto torneo | Tipo |
|---|---|---|---|
| `/` | `app/page.tsx` | No (selector) | Global |
| `/dashboard` | `app/(operator)/dashboard/page.tsx` | Query `?tournamentId` | Por-torneo |
| `/torneos` | `app/(operator)/torneos/page.tsx` | No (lista todos) | Global |
| `/operator` | `app/(operator)/operator/page.tsx` | Query `?tournamentId` | Por-torneo |
| `/standings` | `app/(operator)/standings/page.tsx` | Query `?tournamentId` | Por-torneo |
| `/equipos` | `app/(operator)/equipos/page.tsx` | Query `?tournamentId` | Por-torneo |
| `/ajustes` | `app/(operator)/ajustes/page.tsx` | No | Global |
| `/stream` | `app/stream/page.tsx` | Query `?tournamentId` | Broadcast (fuera del shell) |

**Shell operator:** Todas las rutas dentro de `(operator)` comparten `OperatorLayout` → `OperatorSidebar` + `OperatorTopbar`. `/stream` vive fuera del shell.

---

## 2. Motores y vista principal (TOURNAMENT_RULES.md)

| Motor | engine_key | Vista principal | Vista secundaria |
|---|---|---|---|
| World Series BR | `wsow_br` | Standings | Operator |
| Resurgence / Rebirth WS | `rebirth_ws` | Standings | Operator |
| Gedeon Roulette WS | `roulette_ws` | Standings | Operator |
| Kill Race Bracket | `kill_race_bracket` | Bracket (Standings) | Operator |

---

## 3. Flujo de navegación por motor

### 3.1 `wsow_br`, `rebirth_ws`, `roulette_ws` (comparten modelo)

```
/torneos → crear/seleccionar torneo
    ↓
/dashboard?tournamentId=N  (resumen activo)
    ↓
/operator?tournamentId=N   (cargar resultados)
    ↓
/standings?tournamentId=N  (clasificación general) ← VISTA PRINCIPAL
    ↓
/stream?tournamentId=N     (broadcast)
```

**Links existentes verificados:**
- `/torneos` → tarjetas con links a `/operator`, `/standings`, `/dashboard`, `/stream` ✅
- `/dashboard` → CTA a `/operator` o `/standings` ✅
- `/operator` → ❌ **SIN botón a Standings ni "volver atrás"** (BUG E1.a/E1.b)
- `/standings` → ❌ **SIN botón de regreso a Operator** (contribuye a E1.b)
- `/equipos` → ❌ **SIN botón de regreso** (solo muestra ruleta o mensaje)

### 3.2 `kill_race_bracket`

```
/torneos → crear/seleccionar torneo
    ↓
/dashboard?tournamentId=N  (resumen activo)
    ↓
/operator?tournamentId=N   (bracket + operar BO3) ← VISTA PRINCIPAL
    ↓
/standings?tournamentId=N  (bracket visual)
    ↓
/stream?tournamentId=N     (broadcast)
```

**Links existentes verificados:**
- `/torneos` → tarjetas con links a `/standings` (bracket), `/dashboard`, `/stream` ✅
- `/dashboard` → CTA a `/operator?tab=bracket` ✅
- `/operator` → ✅ **TIENE context bar** con `← Volver al bracket` → `/standings` (commit f2bfe61)
- `/standings` → ❌ **SIN botón de regreso a Operator**

---

## 4. Caminos rotos ⚠️

| # | Camino roto | Motor(es) | Causa |
|---|---|---|---|
| ⚠️ 1 | `/operator` → Standings | `wsow_br`, `rebirth_ws`, `roulette_ws` | Context bar solo existe para Kill Race |
| ⚠️ 2 | `/operator` → "volver atrás" | `wsow_br`, `rebirth_ws`, `roulette_ws` | Mismo bug — no hay context bar |
| ⚠️ 3 | `/standings` → Operator | **Todos** | Ningún engine tiene botón de regreso |
| ⚠️ 4 | `/equipos` → Operator | **Todos** | Página sin navegación contextual |

---

## 5. Decisión de implementación

### 5.1 Componente `ContextBar` compartido

**Prohibido** duplicar el bloque `<div className="opr-context-bar">` en cada rama del condicional de `WorldSeriesOperator.tsx`.

Se crea un componente parametrizado:

```tsx
<ContextBar
  engineKey={selectedEngine?.engineKey}
  tournamentName={selectedTournament?.name}
  tournamentId={selectedTournament?.id}
  matches={matches}
  teams={teams}
  onBack={handleBack}
/>
```

### 5.2 Comportamiento por engine

| engine_key | Label del botón "←" | Destino del back |
|---|---|---|
| `kill_race_bracket` | `← Volver al bracket` | `/standings?tournamentId=N` |
| `wsow_br` | `← Volver` | `/torneos` |
| `rebirth_ws` | `← Volver` | `/torneos` |
| `roulette_ws` | `← Volver` | `/torneos` |

**Racional:** Kill Race tiene bracket como vista principal → el "volver" lleva a standings (donde se ve el bracket). Los otros 3 motores tienen standings como vista principal → el "volver" lleva a torneos (punto de entrada).

### 5.3 Acceso directo a Standings desde Operator

Para **todos** los motores, el context bar incluye un link `Standings →` que navega a `/standings?tournamentId=N`. En Kill Race, este link es redundante con el back pero se mantiene por consistencia visual.

### 5.4 Botón de regreso en Standings

`WorldSeriesStandings.tsx` recibe un botón `← Volver a Operator` → `/operator?tournamentId=N`.

### 5.5 UI_COPY_RULES compliance

- El context bar **NO** repite el H1 de la página. Solo muestra: botón back + nombre del torneo + fase/estado.
- El H1 de Operator sigue en `OperatorTopbar.tsx` ("Operator" / "Standings" / etc.).
- El subtitle del topbar aporta contexto, no duplica navegación (regla 4 de UI_COPY_RULES).

---

## 6. Archivos a tocar (solo navegación/layout)

| Archivo | Cambio |
|---|---|
| `frontend/app/components/ContextBar.tsx` | **Nuevo** — componente compartido |
| `frontend/app/components/WorldSeriesOperator.tsx` | Reemplazar context bar inline por `<ContextBar>`, extender a no-KillRace |
| `frontend/app/components/WorldSeriesStandings.tsx` | Agregar botón `← Volver a Operator` |
| `frontend/app/globals.css` | Estilos existentes de `.opr-context-bar` (sin cambios si reutiliza clases) |

---

## 7. Modelo de navegación resultante

```
/torneos (global)
    │
    ├──→ /dashboard?tournamentId=N
    │         ├──→ /operator?tournamentId=N  ←[ContextBar: ← Volver / Standings→]
    │         │         └──→ /standings?tournamentId=N  ←[← Volver a Operator]
    │         │                   └──→ /stream?tournamentId=N
    │         │
    │         └──→ /equipos?tournamentId=N  ←[sin cambios en este sprint]
    │
    └──→ /ajustes  (global, sin contexto torneo)
```
