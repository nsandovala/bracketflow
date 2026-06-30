# BracketFlow — Contexto de QA y Recomendaciones

> Documento de continuidad para sesiones futuras.
> Fecha: 2026-06-30 (actualizado)
> Estado: MVP validado, bugs críticos de ruleta corregidos, optimizaciones pendientes documentadas.

---

## 1. Resumen del QA realizado

### Sprint P0.1 — Ruleta Real + Kill Race Seed (2026-06-30)

#### Validaciones técnicas
| Check | Comando | Resultado |
|-------|---------|-----------|
| Backend syntax | `cd backend && python -m compileall app` | Sin errores |
| Frontend lint | `cd frontend && npm run lint` | 0 errores, 9 warnings preexistentes |
| Frontend build | `cd frontend && npm run build` | Build exitoso (Next.js 16.2.7) |
| Backend QA script | `python qa_killrace.py` | PASO |

#### Bugs corregidos en P0.1
1. **Nickname con comas internas aceptado** → Ahora frontend y backend rechazan nicknames con `, ; \t` internos (422). Evita equipos como `fede / manteca, demain, carlos, lalo, clara`.
2. **Duplicidad de textos UI** → Aplicada regla anti-duplicidad en RouletteArena, BracketView, Standings, Operator.
3. **Mensajes de "siguiente sprint"** → Quitados de BracketView y Operator Kill Race.
4. **Parser debil** → Ahora soporta separadores: newline, coma, punto y coma, tab, multiples espacios.

#### Flujo funcional validado (script `qa_killrace.py`)
1. ✅ Crear torneo Kill Race 2v2.
2. ✅ Intentar importar nickname con comas → rechazado 422.
3. ✅ Importar 4 jugadores validos → 201.
4. ✅ Generar ruleta → 2 equipos de 2 jugadores exactos, 0 banca.
5. ✅ Agregar 1 jugador extra, regenerar → 2 equipos, 1 banca.
6. ✅ Bracket visual muestra nombres reales y BYE.
7. ✅ Stream bifurca: Kill Race → bracket, WSOW → standings.

### Sprint anterior (2026-06-02)

#### Validaciones técnicas
| Check | Comando | Resultado |
|-------|---------|-----------|
| Backend syntax | `cd backend && python -m compileall app` | Sin errores |
| Frontend lint | `cd frontend && npm run lint` | Sin errores |
| Frontend build | `cd frontend && npm run build` | Build exitoso (Next.js 16.2.7) |

#### Flujo funcional validado (vía API REST, script `qa_flow.py`)
1. ✅ Crear torneo formato `roulette_2v2`.
2. ✅ Agregar 4 jugadores manualmente.
3. ✅ Generar ruleta 2v2 (2 equipos creados, 0 en bench).
4. ✅ Confirmar que equipos devuelven `members` con `player.nickname` (no solo IDs).
5. ✅ Crear ronda 1.
6. ✅ Registrar resultados:
   - Equipo 1: 8 kills, placement 2 → 20 pts.
   - Equipo 2: 5 kills, placement 1 → 20 pts.
7. ✅ Leaderboard:
   - Ambos con 20 puntos.
   - Desempate por kills: equipo con 8 kills arriba, 5 kills abajo.
8. ✅ Actualizar resultado existente (8 → 9 kills) sin duplicar registros.
9. ✅ Persistencia confirmada en `backend/bracketflow.db` tras detener el backend.

### Bugs encontrados (historico)
**Ninguno crítico.** El flujo happy path del MVP se comporta según especificación.

### Archivos modificados durante el QA
**Ninguno.** Solo se usó un script temporal externo (`qa_flow.py` en temp) que no quedó en el repo.

> ⚠️ Nota: el script de QA eliminó temporalmente `backend/bracketflow.db` para garantizar un flujo limpio. Si se tenían datos locales previos, deben regenerarse por el flujo normal.

---

## 2. Recomendaciones de optimización pendientes

### 2.1 Constraint única en `TeamResult`
Agregar `UniqueConstraint("match_id", "team_id")` en el modelo SQLAlchemy para evitar duplicados a nivel de base de datos, incluso ante concurrencia o inserts manuales.

**Archivo:** `backend/app/models.py`  
**Prioridad:** Media-Alta.

### 2.2 Índice compuesto en `team_results`
Agregar un índice sobre `(tournament_id, team_id)` para acelerar el cálculo del leaderboard a medida que crece el historial de rondas.

**Archivo:** `backend/app/models.py`  
**Prioridad:** Media.

### 2.3 Manejo defensivo de transacciones
Algunas funciones en `backend/app/crud.py` usan `db.flush()` seguido de consultas y luego `db.commit()`. Si ocurre un error entre `flush` y `commit`, la sesión queda en estado intermedio. Agregar `try/except` con `db.rollback()` protege contra propagación de datos sucios.

**Archivo:** `backend/app/crud.py`  
**Prioridad:** Media.

### 2.4 `.gitignore` en la raíz del repo
Actualmente existen archivos sin trackear un nivel arriba de `app/`:
- `../.venv/`
- `../requirements.txt`

Agregar un `.gitignore` en la raíz (`bracketflow/.gitignore`) con:
```
.venv/
requirements.txt
```

**Prioridad:** Baja.

### 2.5 Validación temprana de coherencia de schema
En `backend/app/schemas.py`, `TournamentCreate` no valida que `team_size` sea coherente con `format`. Aunque `crud.normalize_team_size()` lo corrige, un `model_validator` en Pydantic haría el error visible antes de llegar a CRUD.

**Archivo:** `backend/app/schemas.py`  
**Prioridad:** Baja.

### 2.6 Mejora de mensajes de error de red en frontend
`frontend/lib/api.ts` lanza `throw new Error("Request failed")` genérico cuando el backend no responde. Agregar logging en consola o un mensaje más descriptivo facilita el debugging futuro.

**Archivo:** `frontend/lib/api.ts`  
**Prioridad:** Baja.

---

## 3. Reglas operativas vigentes (no negociables)

- **NO** agregar demo data, seeders, mocks persistentes ni botones de demo.
- **NO** rediseñar UI sin necesidad funcional.
- **NO** cambiar stack (FastAPI + SQLite + SQLAlchemy / Next.js + TypeScript).
- **NO** agregar Docker, autenticación, pagos ni IA salvo pedido explícito.
- **NO** ejecutar `npm audit fix --force`.
- Trabajar siempre con datos reales ingresados manualmente o por el flujo normal.
- Si cambia el schema en desarrollo local, avisar explícitamente que puede ser necesario borrar `backend/bracketflow.db` y regenerar.

---

## 4. Stack actual

- **Backend:** Python, FastAPI, SQLite, SQLAlchemy, Pydantic.
- **Frontend:** Next.js 16.2.7, TypeScript, App Router.
- **Base de datos local:** `backend/bracketflow.db` (sin migraciones formales aún).

---

## 5. Estado de Git (al momento de este documento)

- Rama: `master`, up to date con `origin/master`.
- Sin archivos modificados sin stagear.
- Sin archivos en staging area.
- Único cambio a subir: este documento (`docs/QA_CONTEXT.md`).
