# PROMPT — FASE 0: Estabilización de flujos (E1–E4)

**Proyecto:** BracketFlow · **Fecha:** 2026-07-01 · **Roadmap:** docs/ROADMAP_F0.md
**Ejecutores:** Qwen3.6 + Codex · **Validador:** Claude (arquitectura) · **Aprobación final:** Vito (visual, en vivo)

## Rol y reglas del ejecutor

Ejecutas EXACTAMENTE lo especificado. Cero features nuevas, cero rediseño visual (eso es Fase 2-3), cero refactors oportunistas "ya que estoy aquí".

1. **NO COMITEAR.** Cambios staged o en branch `fix/f0-<sprint>`. Avisas y esperas validación visual de Vito. Sin excepciones.
2. **Un dominio por commit** (cuando Vito apruebe). Un sprint = un dominio = un commit.
3. **Diagnóstico antes de código.** Cada sprint parte con un reporte corto: causa raíz encontrada, archivos involucrados, plan de fix. Se aprueba el diagnóstico → recién ahí se escribe código. Prohibido "arreglar" a ciegas.
4. `npm run build` limpio en front y arranque sin errores del backend antes de marcar listo.
5. Si encuentras un bug fuera del scope del sprint: se anota en `docs/HALLAZGOS_F0.md` con `[PENDIENTE VERIFICAR]`. NO se arregla en este sprint.
6. Todo hallazgo no verificado con el repo real se marca `[PENDIENTE VERIFICAR]`. Prohibido afirmar comportamiento sin haberlo reproducido.

---

## SPRINT E1 — Navegación (dominio: nav)

**Bugs congelados:**
- E1.a: Botón "Volver atrás" desapareció en Operator para formato BR (regresión — buscar en el historial de git cuándo se perdió: `git log -p -- <archivo del header del operator>`).
- E1.b: En Ruleta Gedeón (roulette_ws) no hay camino a Standings ni botón atrás.

**Entregable 1 (antes de código): mapa de navegación.** Documento de 1 página en `docs/NAV_MAP.md`: por cada motor, qué vistas existen y desde cuál se llega a cuál. Vito lo aprueba antes del fix — así los botones repuestos responden a un modelo, no a parches.

**Entregable 2: fix.** Botón atrás presente en TODAS las superficies de torneo, en la misma posición, para los 4 motores. Acceso a Standings desde cualquier superficie del torneo activo.

**Anti-humo E1:**
1. Video o GIF recorriendo los 4 motores: entrar → operator → standings → volver, sin usar el back del navegador.
2. El mapa de navegación coincide con lo implementado (revisión de Claude).

---

## SPRINT E2 — Respin y Kill Race (dominio: tournament-state)

**Bugs congelados (mismo síntoma probable: transición de estado que no dispara o no persiste):**
- E2.a: Botón "Cerrar respin" no funciona.
- E2.b: Kill Race: la ruleta arma los equipos pero el flujo no deja continuar — el operador queda estancado.

**Diagnóstico obligatorio primero.** Responder con evidencia (network tab + logs del backend):
- ¿El click dispara request? ¿El endpoint existe? ¿Responde 2xx? ¿El estado se escribe en DB? ¿El front relee el estado?
- Identificar en qué eslabón exacto se corta la cadena para cada bug. Adjuntar el trace.

**Fix:** el que indique el diagnóstico. Si la máquina de estados del torneo no tiene un lugar único de verdad (backend), proponerlo en el diagnóstico ANTES de implementar — decisión de arquitectura, la valida Claude.

**Anti-humo E2:**
1. F5 survival: cerrar respin → recargar → sigue cerrado (SELECT mostrando el campo de estado en la fila real del torneo).
2. Kill Race end-to-end: ruleta → equipos → continuar → bracket visible. Video.
3. Doble click a "Cerrar respin" no genera doble transición ni error 500.

---

## SPRINT E3 — CRUD de equipos (dominio: teams-crud)

**Bug congelado:** wsow_br y rebirth_ws no permiten editar ni eliminar equipos. Bloquea la corrección de errores de inscripción.

**Scope exacto:**
- Editar nombre de equipo.
- Reemplazar un jugador del equipo (desde el pool de inscritos no asignados).
- Eliminar equipo (con confirmación; si el equipo ya tiene resultados cargados, se bloquea con mensaje claro — NO cascada silenciosa).
- **Guard:** nada de esto disponible si el torneo está `locked` o en juego. Regla exacta del estado límite: confirmar con Vito en el diagnóstico.

**Backend primero:** endpoints PATCH/DELETE con validaciones. Front después, consumiéndolos. Ojo con la contradicción conocida de `team_size` en crud.py — si el fix la toca, documentar en el diagnóstico; si no la toca, anotarla en HALLAZGOS y no meterse.

**Anti-humo E3:**
1. Editar equipo → F5 → cambio persiste (SELECT de la fila).
2. Intentar eliminar equipo con resultados → bloqueado con mensaje, la data queda intacta (SELECT antes/después idéntico).
3. Torneo locked → controles de edición no visibles o deshabilitados.

---

## SPRINT E4 — Parser de participantes (dominio: import-parser)

**Bug congelado:** nombres con comas internas o caracteres inválidos producen equipos concatenados (jugadores fusionados).

**Scope exacto:**
- Saneamiento estricto: trim, colapso de espacios, dedup case-insensitive.
- Formato retrocompatible (contrato de SPEC_ingesta_stats.md §3):
  ```
  manteca                      # válido: solo display name
  demian,Demian#7734512        # válido: display name + Activision ID (opcional)
  ```
  La coma SOLO es separador válido en ese formato de 2 campos. Cualquier otra coma → fila rechazada con mensaje que indica línea y motivo. Nunca fusionar silenciosamente.
- Preview de importación: qué entra, qué se rechazó y por qué, ANTES de confirmar.
- **Tests unitarios obligatorios** con los casos reales que fallaron + estos mínimos: coma interna, línea vacía, duplicado con distinto case, espacios múltiples, Activision ID malformado (sin `#`, tag no numérico).

**Anti-humo E4:**
1. Suite de tests del parser en verde (salida de pytest/vitest pegada).
2. TXT real de una scrim Gedeón importado: conteo de jugadores correcto, cero fusiones (SELECT con COUNT).
3. TXT con una fila corrupta: importa las válidas, rechaza la corrupta con mensaje visible de línea y motivo.

---

## Orden y paralelización

```
E1 (Qwen3.6)  ─┐
               ├─ en paralelo, dominios no se pisan
E4 (Codex)   ─┘
luego:
E2 (Codex — requiere diagnóstico backend fino)
E3 (Qwen3.6 — backend endpoints por Codex si se reparte)
```

E2 va después de E1 porque el fix de navegación puede tocar el layout del Operator y no queremos merges cruzados en los mismos archivos.

## Gate de salida de FASE 0

Vito recorre los 4 motores de inicio a fin, en vivo, sin quedar atascado en ningún punto. Cada botón visible hace lo que dice o no existe. Recién entonces se abre Fase 1 (Datos: winner_id, generate_bracket, stats por jugador, Match Point).