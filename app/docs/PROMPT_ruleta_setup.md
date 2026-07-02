# PROMPT — Sprint RULETA-SETUP (motor roulette_ws)

**Proyecto:** BracketFlow · Superficie: Setup (`/equipos`)
**Fecha contrato:** 2026-07-01
**Rol:** Ejecutas EXACTAMENTE lo especificado. Nada fuera de scope. NO COMITEAR sin validación visual del operador (Vito). Dejas los cambios staged o en branch, avisas, y esperas OK.

---

## Contrato congelado (NO renegociar en el sprint)

1. **Equipos → seed.** El giro de la ruleta baraja el pool (Fisher-Yates, NUNCA `sort(() => Math.random()-0.5)`), arma equipos de `team_size`, y de esos equipos se derivan los emparejamientos M1..Mn del seed. La ruleta NO elige jugadores individuales.
2. **Timer de respin MANUAL.** El operador lo inicia con un botón ("Iniciar respin", default 180s, máx configurable 240s) y puede cerrarlo antes con "Cerrar respin ahora". Al llegar a 0 o al cerrar manual → estado `closed`: girar deshabilitado, se habilita "Bloquear y preparar bracket".
3. **El pool debe calzar.** Si `players.length % team_size !== 0` o `players.length < team_size * 2`, el botón de girar queda deshabilitado y se muestra mensaje con cuántos sobran/faltan. **Sin BYE automático en la ruleta** (el BYE existe solo en el seed cuando hay número impar de EQUIPOS, no de jugadores).

## Layout (mantener lo que ya funciona)

```
[HEADER: estado del respin + timer + controles Iniciar/Cerrar/Reiniciar]
[Participantes 3/12] [Ruleta 5/12] [Seed del Bracket 4/12]
```

- **Izquierda — Participantes.** El drag&drop TXT/CSV existente NO SE TOCA (funciona). Se AGREGA un textarea para pegar nombres (split por salto de línea, coma o punto y coma; trim; dedup case-insensitive). Chips ordenados alfabéticamente, con × para quitar, contador visible. Scroll interno max-h ~260px.
- **Centro — Ruleta.** 16 gajos decorativos SIN nombres, alternando negro mate `#0B0E14` y azul marino mate `#111B30`, todos los bordes y líneas dorado `#E8B54D`, aro exterior dorado con glow sutil. **PROHIBIDO el verde dentro de la rueda** — el verde de marca queda solo para acentos de UI fuera de ella (timer, contadores, botón Agregar). **El hub central ES el botón de girar** (botón arcade): círculo dorado, muestra el número de participantes grande + label "GIRAR". Sin botón GIRAR externo. Cuando está habilitado, respira con glow (animación 2.4s); deshabilitado = gris, cursor not-allowed.
- **Derecha — Seed.** El formato actual de cards M1..Mn se mantiene (funciona). Lo único nuevo: al terminar el giro, las cards entran con animación escalonada (~60ms stagger, translateY + fade). Botones "Ver bracket" / "Preparar bracket" habilitados solo tras bloquear.

## Comportamiento

Máquina de estados de la ruleta: `idle → spinning (4s ease-out, cubic-bezier(0.15,0.85,0.2,1)) → revealing (efecto anillos dorados girando en sentidos opuestos, ~1.3s, se auto-desmonta) → idle`.
Estados del timer independientes: `idle → running → closed`. `locked` es flag aparte.

- Girar permitido solo si: pool válido ∧ fase `idle` ∧ no `locked` ∧ timer no `closed`.
- Cada giro RE-ARMA todos los equipos (respin completo) e incrementa contador `respins` visible.
- Al cerrar el timer (manual o por 0): beep corto (Web Audio, envuelto en try/catch), girar bloqueado.
- Respetar `prefers-reduced-motion`: giro 320ms, efecto reveal 400ms, sin breathe.

## Estética (premium sobrio)

- Tipografía: system stack (`-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif`). Nada de fuentes nuevas.
- Dorado SOLO como acento (botón central, bordes, timer, labels M#). Fondo `#0A0C11`, paneles `#111620`, edges `#222836`. Dentro de la rueda: solo negro mate + azul marino mate + dorado.
- Cero gradientes toscos, cero sombras duras. Animaciones cortas con ease suave.
- Responsive: 3 columnas → 2 (ruleta arriba full-width) en <980px → 1 columna en <640px.

## Referencia de implementación

Componente de referencia funcional: `SetupRuleta.jsx` (adjunto). Portarlo a TSX del proyecto, extraer tokens al sistema de diseño existente, y conectar:
- `onTeamsFormed(teams: string[][])` → persistir en backend.
- El drag&drop real reemplaza el placeholder.
- El seed real reemplaza la lista demo.

## Persistencia (anti-humo)

El resultado del giro NO puede vivir solo en estado de React:
- Al formar equipos: POST al backend con `teams` + `respin_count` + timestamp.
- Al bloquear: flag `locked_at` en el torneo.

## Criterios de aceptación (anti-humo)

1. **F5 survival:** girar, formar equipos, recargar la página → los equipos y el contador de respins siguen ahí (leídos desde el backend, no de localStorage).
2. **SQL real:** mostrar la fila de la tabla correspondiente (`SELECT` sobre la DB real) con los equipos del último giro y `locked_at` tras bloquear.
3. Pool inválido (ej: 13 jugadores en 2v2) → botón central deshabilitado + mensaje "Sobran 1".
4. "Cerrar respin ahora" a mitad del timer → girar queda bloqueado inmediatamente, botón "Bloquear y preparar bracket" habilitado.
5. Doble click rápido al botón central NO dispara dos giros (guard por fase).
6. Responsive verificado en 1280px, 900px y 390px (screenshot de cada uno).

## Disciplina de commit

- UN dominio por commit. Este sprint = dominio "ruleta-setup". No tocar operator, standings, stream ni engines.
- `npm run build` limpio antes de marcar listo.
- **NO COMITEAR.** Staged + aviso + espera de validación visual. Sin excepciones.