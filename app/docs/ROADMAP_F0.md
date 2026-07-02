# ROADMAP — Refactor UI/UX BracketFlow

**Fecha:** 2026-07-01
**Origen:** Auditoría de Vito post-prueba de los 4 motores (wsow_br, rebirth_ws, roulette_ws, kill_race_bracket)
**Diagnóstico central:** El sistema funciona a nivel de motor, pero la experiencia de torneo se pierde por (a) flujos rotos que bloquean al operador, (b) datos que no se persisten o no se muestran, y (c) UI sin sistema de diseño. **No es un problema de "hacerlo bonito": es estabilizar → datos → diseño, en ese orden.**

---

## Regla de oro del roadmap

> **No se rediseña ninguna superficie mientras tenga un flujo roto o un dato faltante debajo.**
> Rediseñar sobre backend roto = pintar una máquina descompuesta. Cada fase tiene gate de salida; no se pasa a la siguiente sin cumplirlo.

Disciplina transversal (ya congelada): un dominio por commit · `npm run build` limpio · anti-humo (F5 survival + SELECT real) · NO comitear sin validación visual de Vito.

---

## FASE 0 — Estabilización de flujos (bloqueadores del operador)

*Objetivo: que ningún botón mienta y que ningún flujo deje al operador estancado. Sin esto no hay demo posible.*

Mapeo directo desde la auditoría:

| # | Falla reportada | Dominio | Tipo |
|---|---|---|---|
| 0.1 | "Cerrar respin" no funciona | setup/respin | Bug funcional |
| 0.2 | Botón "Volver atrás" desapareció en Operator para formato BR | operator/nav | Regresión |
| 0.3 | Kill Race: ruleta arma equipos pero no deja continuar | kill_race flujo | Bloqueador |
| 0.4 | WSOW BR y Rebirth: no se puede editar ni eliminar equipos | teams CRUD | Feature faltante crítica |
| 0.5 | Ruleta Gedeón: sin camino a Standings ni atrás | roulette/nav | Nav rota |
| 0.6 | Parser concatena jugadores (nombres con comas internas) | import/parser | Bug de saneamiento |

**Sprints propuestos (uno por dominio):**
- **Sprint E1 — Navegación:** 0.2 + 0.5. Definir el modelo de navegación por motor (de qué vista se puede ir a cuál) ANTES de reponer botones. Entregable: mapa de navegación de 1 página + botones repuestos.
- **Sprint E2 — Respin & Kill Race:** 0.1 + 0.3. Son el mismo síntoma (transición de estado que no dispara). Auditar la máquina de estados del torneo en backend: probablemente el endpoint existe pero el front no lo llama, o el estado no persiste.
- **Sprint E3 — CRUD de equipos:** 0.4. Editar nombre / reemplazar jugador / eliminar equipo en wsow_br y rebirth_ws, con guard: no editable si el torneo ya está `locked`/en juego (regla a confirmar con Vito).
- **Sprint E4 — Parser:** 0.6. Validación estricta de entrada: rechazar o sanear comas internas, caracteres inválidos, duplicados case-insensitive. Test unitario con los casos reales que fallaron.

**Gate de salida Fase 0:** Vito recorre los 4 motores de inicio a fin sin quedar atascado en ningún punto. Cada botón visible hace lo que dice o no existe.

---

## FASE 1 — Integridad de datos (lo que el torneo debe saber de sí mismo)

*Objetivo: que el sistema registre y exponga la verdad del torneo. Esto ya estaba parcialmente diagnosticado en la auditoría del repo.*

| # | Falla reportada | Causa raíz conocida |
|---|---|---|
| 1.1 | Bracket no muestra campeón / BR y Rebirth no muestran ganador | `winner_id` nunca se escribe (gap confirmado en repo) |
| 1.2 | Seed del bracket desordenado | `generate_bracket` solo crea round 1; sin propagación ordenada |
| 1.3 | Match Point a veces no funciona | Revisar contra TOURNAMENT_RULES.md (configurable por torneo, no hardcodeado) |
| 1.4 | Solo se guarda kills total → imposible saber MVP | **Cambio de esquema:** falta tabla de stats por jugador por partida |

**Sprints propuestos:**
- **Sprint D1 — winner_id + campeón:** escribir `winner_id` al cerrar match, propagar al bracket, estado visual "Campeón"/"Avanza"/"Eliminado". (= Sprint A ya scopeado, se ejecuta aquí.)
- **Sprint D2 — generate_bracket completo:** generar todas las rondas con seeds ordenados y avance correcto. Resolver de paso la contradicción de `team_size` en crud.py.
- **Sprint D3 — Esquema de stats por jugador:** nueva tabla `player_match_stats(player_id, match_id, kills, placement, ...)`. Migración + escritura en el flujo de carga de resultados. Define MVP = agregación, no dato manual.
- **Sprint D4 — Match Point:** reproducir el fallo intermitente, test contra las reglas congeladas.

**Decisión requerida de Vito antes de D3:** ¿qué stats por jugador se capturan en la carga de resultados? (mínimo viable: kills por jugador; opcional: damage, revives). Esto define el formulario del Operator y el TXT import.

**Gate de salida Fase 1:** SELECT sobre la DB real muestra: campeón del torneo, bracket completo con winners, y kills por jugador de al menos un torneo de prueba completo.

---

## FASE 2 — Sistema de diseño (una sola vez, para todas las superficies)

*Objetivo: dejar de decidir colores/espaciados/componentes en cada sprint. Se define una vez y las fases siguientes solo lo consumen.*

Entregables:
1. **Tokens** (archivo único): paleta ya validada — fondo `#0A0C11`, paneles `#111620`, edges `#222836`, verde marca `#00E676` solo acentos UI, dorado `#E8B54D` para arena/momentos premium, azul marino mate `#111B30`. Tipografía system stack. Escala de espaciado y radios.
2. **Componentes base:** Botón (4 variantes ya definidas), Panel/Card, Chip, Timer, EmptyState, **Skeleton/Loading** (clave: la lentitud del bracket se percibe el doble sin skeleton).
3. **Modelo de navegación global:** header consistente por motor con breadcrumb (Torneo → Superficie), botón atrás SIEMPRE presente, acceso a Standings desde cualquier superficie del torneo activo. Esto institucionaliza el fix de E1 para que no vuelva a regresionar.
4. **Patrón de carga:** toda vista que consulte backend muestra skeleton < 100ms; si la carga real del bracket supera ~1s, se ataca en Fase 4 con la medición en mano (primero medir, después optimizar).

**Gate de salida Fase 2:** Storybook o página `/design` interna con todos los componentes renderizados. Kimi/Codex solo pueden usar componentes de ahí en adelante.

---

## FASE 3 — Rediseño por superficie (en orden de impacto en stream)

*Una superficie por sprint, consumiendo el sistema de Fase 2. Orden pensado para que lo primero que mejore sea lo que se ve en vivo.*

- **Sprint S1 — Setup:** ya diseñado y validado (ruleta arcade, negro/marino/dorado, efecto Strange, timer manual). = PROMPT_ruleta_setup.md, se ejecuta aquí con el sistema de diseño detrás.
- **Sprint S2 — Bracket:** la superficie más criticada. Campeón visible (dato ya existe por D1), estados Avanza/Eliminado, react-brackets (= Sprint BRACKET-UI ya scopeado), skeleton de carga, orden visual de seeds.
- **Sprint S3 — Operator:** navegación reparada (E1) + jerarquía visual: qué match está activo, qué falta, CTA principal único por estado del torneo. Formulario de resultados adaptado al esquema de stats por jugador (D3).
- **Sprint S4 — Standings/Stream:** Standings con MVP y stats por jugador. Stream: eliminar espacio vacío, bifurcación de layout por motor (BR ≠ bracket ≠ kill race), mantener lo que Winghaven validó de los overlays F1.

**Gate de salida por sprint:** demo grabable de la superficie completa, responsive verificado en 1280/900/390.

---

## FASE 4 — Rendimiento y pulido demo-ready

- Medir carga del bracket (Network + profiler) → optimizar la causa real (query N+1, payload gordo, o render), no adivinar.
- Animaciones de transición entre superficies (sutiles, `prefers-reduced-motion`).
- Pasada final responsive + QA cruzada con Kimi.
- **Criterio de cierre del roadmap:** Vito puede correr un torneo demo completo de cualquier motor, en stream, sin tocar la consola ni pedir disculpas por la UI.

---

## Secuencia y estimación gruesa

```
FASE 0  E1 → E2 → E3 → E4      (4 sprints cortos, bugs acotados)
FASE 1  D1 → D2 → D3 → D4      (4 sprints, D3 requiere decisión de esquema)
FASE 2  1 sprint de sistema de diseño
FASE 3  S1 → S2 → S3 → S4      (4 sprints, S1 ya está listo para ejecutar)
FASE 4  1-2 sprints de medición y pulido
```

Paralelización posible: Fase 2 (diseño) puede correr en paralelo con Fase 1 (datos) porque no se pisan — una es front puro, la otra backend puro. Fase 0 va primera sí o sí.

## Qué NO entra en este roadmap (para proteger el scope)

- Hub visual "Arena OS" (halos, partículas) — sigue deprioritizado hasta que esto cierre.
- Features nuevas de motores (nuevos formatos, nuevas reglas).
- Cambios a TOURNAMENT_RULES.md — está congelado.