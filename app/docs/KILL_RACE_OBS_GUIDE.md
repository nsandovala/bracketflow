# Kill Race · guía rápida OBS

## Fuentes LIVE

Configura cada Browser Source una sola vez. Resolución recomendada: **1920×1080**; validación secundaria: **1366×768**; **30 FPS**. Mantén el CSS/fondo de OBS transparente.

| Escena | URL estable |
|---|---|
| Scorebug sobre gameplay | `/stream?channel=main&layout=scorebug&obs=1&bg=transparent` |
| Intermission a pantalla completa | `/stream?channel=main&layout=intermission&obs=1` |
| Bracket Broadcast | `/stream?channel=main&layout=bracket&obs=1&bg=transparent` |
| MVP | `/stream?channel=main&layout=mvp&obs=1&bg=transparent` |
| Champion | `/stream?channel=main&layout=champion&obs=1&bg=transparent` |

Orden de capas sugerido, de abajo hacia arriba:

1. gameplay o multiview;
2. scorebug;
3. logos, marcos u otros recursos visuales.

Bracketflow **no captura ni compone gameplays**. El 2×2 se arma en OBS o mediante una herramienta externa de multiview.

## LIVE, preview y match fijo

- `channel=main`: fuente LIVE estable; sigue exclusivamente lo enviado por Operator y cambia sin editar la URL.
- `tournamentId=ID`: preview/histórico fijo; no sigue Operator y no modifica `main`.
- `tournamentId=ID&matchId=MATCH_ID`: match fijo, válido para Scorebug y MVP; nunca mezclarlo con `channel=main`.

En Caster Hub, usa **CANAL MAIN · EN VIVO** para OBS y **PREVIEW · TORNEO SELECCIONADO** para revisión o preparación.

## Operación durante la transmisión

1. En Operator, asigna el torneo y envía una serie a `main`.
2. Abre la fuente LIVE y comprueba torneo, equipos y match.
3. Cambia el match desde Operator sin tocar OBS. La fuente debe actualizarse en aproximadamente 2 segundos, sin F5.
4. Si una Browser Source queda con recursos antiguos: clic derecho en la fuente → **Propiedades** → **Refresh cache of current page / Refrescar caché de la página actual**.
5. Si `main` está vacío, vuelve a Operator, asigna el torneo y envía una serie. No sustituyas la URL LIVE por una preview.

## Estados del scorebug

| Estado | Significado / acción |
|---|---|
| `POR COMENZAR` | Serie lista, sin partida iniciada. |
| `LIVE` | El match tiene evidencia real de estado `in_progress`. |
| `PROVISIONAL` | Hay un mapa en revisión; no altera el score oficial. |
| `FINAL` | El resultado mostrado está confirmado; el score usa sólo confirmados. |
| `RECONECTANDO` | Backend/red temporalmente inaccesible; se conserva el último snapshot y se reintenta solo. |
| `SIN SERIE AL AIRE` | `main` no tiene contexto LIVE asignado. |
| `NO HAY MATCH AL AIRE` | Hay torneo, pero no una serie válida transmitida. |
| `TORNEO NO DISPONIBLE` | La referencia ya no existe o es inválida; se limpia el snapshot anterior. |

Ante `RECONECTANDO`, espera la recuperación automática antes de refrescar caché. Ante `NO HAY MATCH AL AIRE` o `TORNEO NO DISPONIBLE`, corrige la asignación desde Operator.
