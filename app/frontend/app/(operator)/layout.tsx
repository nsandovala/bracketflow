import { ReactNode, Suspense } from "react";

import DashboardParticles from "../components/DashboardParticles";
import OperatorTopbar from "../components/OperatorTopbar";
import OperatorSidebar from "../components/OperatorSidebar";

/**
 * Shell del MUNDO OPERADOR (route group `(operator)`).
 *
 * Envuelve a todas las rutas operativas: dashboard, torneos, operator,
 * standings, equipos y ajustes. Los paréntesis del grupo NO afectan las URLs:
 * `app/(operator)/dashboard` sigue resolviendo a `/dashboard`.
 *
 * Regla de los dos mundos: `/stream` (broadcast / OBS) vive FUERA de
 * este grupo (`app/stream`), así que este sidebar+topbar nunca lo
 * envuelve y sigue renderizando a pantalla completa sin chrome.
 */
export default function OperatorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bf-op-shell">
      <div className="bf-op-particles" aria-hidden="true">
        <DashboardParticles />
      </div>

      <OperatorSidebar />

      <div className="bf-op-main">
        <Suspense fallback={<div className="bf-op-topbar" aria-hidden="true" />}>
          <OperatorTopbar />
        </Suspense>

        <div className="bf-op-content">{children}</div>
      </div>
    </div>
  );
}
