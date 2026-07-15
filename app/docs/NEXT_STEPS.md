# NEXT STEPS

## ULTIMO SPRINT EJECUTADO - D1 Dashboard Operativo

**Fecha:** 2026-07-14  
**Rama:** `feat/dashboard-operational-redesign` (sin commit)

**Objetivo del sprint:** convertir el Dashboard en un cockpit operativo real usando datos existentes del frontend/backend actual, sin inventar metricas ni tocar backend.

**Que se hizo:**
- `DashboardHome` se reorganizo como cockpit operativo con:
  - header con torneo activo, estado, motor, selector y backend online/offline;
  - card dominante de `Next Action`;
  - cards de estado del torneo;
  - accesos rapidos a Operator, Standings, Stream y Torneos;
  - resumen competitivo con top 3 o lectura honesta de bracket;
  - roadmap pequeno y no protagonista.
- La logica del `Next Action` ahora responde a estado real:
  - backend offline;
  - sin torneo activo;
  - falta de participantes o equipos;
  - respin abierto;
  - bracket pendiente;
  - reportes pendientes;
  - Match Point activo;
  - torneo completado.
- El dashboard usa datos ya expuestos por `useWorldSeriesPractice`:
  - `backendOnline`
  - `tournaments`
  - `selectedTournament`
  - `selectedEngine`
  - `teams`, `players`, `matches`
  - `activeMatch`, `activeMatchResults`, `pendingTeams`
  - `sortedStandings`
  - `reportsLoaded`, `latestReportedRound`, `currentGameNumber`
  - `matchPointStatus`
- Se corrigio copy visible con mojibake en el dashboard y en el fallback de carga.

**Que NO se hizo:**
- No se toco backend, scoring, APIs, Operator, BracketView, Stream ni Home.
- No se inventaron metricas avanzadas ni actividad falsa.
- No se agregaron librerias ni se tocaron `package.json` / `package-lock.json`.
- No hubo commit ni push.

**Pendiente real:**
- QA visual manual de Nelson en `1920x1080`, `1366x768`, `1024px` y `390x844`.
- Push Mode, OCR y Caster Suite siguen como roadmap y no deben venderse como feature terminada.

## BASE RECIENTE DEL REPO

### A1 Repo CI / CLI / PR / QA Agent

- Existe `scripts/qa.ps1` como baseline local del repo.
- Existe `.github/workflows/ci.yml` para lint/build frontend y pytest backend.
- Existe `.github/pull_request_template.md`.
- Existe `app/docs/agents/ci-pr-qa-agent.md`.

### H2 Home Product Story

- El Home ya tiene `bf-home-story` debajo de las cards.
- `Saber Mas` apunta a una seccion real del producto.
- Hero y canvas quedaron intactos.

### H1 Home Gedeon Arena hardening

- El Home usa assets livianos para hero desktop/mobile.
- El canvas pausa fuera de viewport y con pestana oculta.
- `public/` ya no carga mockups/documentacion fuera de uso.

## SIGUIENTE ORDEN RECOMENDADO

1. QA visual de Nelson sobre Dashboard D1 antes de commit.
2. Si aparecen roces visuales reales, hacer un pulido D1.1 sin tocar backend.
3. Reci despues abrir sprint separado para Push Mode, OCR o Caster Suite.
