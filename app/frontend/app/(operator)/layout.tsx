import { ReactNode } from "react";

import OperatorSidebar from "../components/OperatorSidebar";
import { IconBell } from "../components/icons";

/**
 * Shell del MUNDO OPERADOR (route group `(operator)`).
 *
 * Envuelve sólo a las rutas dentro de este grupo (dashboard, torneos,
 * equipos, ajustes). Los paréntesis del grupo NO afectan las URLs:
 * `app/(operator)/dashboard` sigue resolviendo a `/dashboard`.
 *
 * Regla de los dos mundos: `/stream` (broadcast / OBS) vive FUERA de
 * este grupo (`app/stream`), así que este sidebar+topbar nunca lo
 * envuelve y sigue renderizando a pantalla completa sin chrome.
 *
 * Standings y Operator todavía NO se migran al shell (fase siguiente):
 * por ahora siguen en `app/standings` y `app/operator`, fuera del grupo.
 */
export default function OperatorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bf-op-shell">
      <OperatorSidebar />

      <div className="bf-op-main">
        <header className="bf-op-topbar">
          <div className="bf-op-greeting">
            <h1>Bienvenido de vuelta, Operator 👋</h1>
            <p>Tu centro de control para torneos World Series Practice.</p>
          </div>

          <div className="bf-op-topbar-side">
            <span className="bf-op-livebadge">
              <i className="bf-op-dot" />
              En vivo
            </span>
            {/* Notificaciones: decorativo por ahora. */}
            <button
              type="button"
              className="bf-op-iconbtn"
              aria-label="Notificaciones"
            >
              <IconBell size={18} />
            </button>
          </div>
        </header>

        <div className="bf-op-content">{children}</div>
      </div>
    </div>
  );
}
