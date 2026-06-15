"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  IconDashboard,
  IconMoon,
  IconSettings,
  IconStandings,
  IconStream,
  IconSun,
  IconTeams,
  IconTrophy,
  type IconProps,
} from "./icons";

type NavItem = {
  href: string;
  label: string;
  Icon: (props: IconProps) => React.JSX.Element;
};

// Dashboard, Torneos y Equipos/Ajustes viven dentro del shell (route
// group). Standings y Stream apuntan a las vistas existentes; Stream
// vive fuera del shell (mundo broadcast) y se abre normal.
const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", Icon: IconDashboard },
  { href: "/torneos", label: "Torneos", Icon: IconTrophy },
  { href: "/standings", label: "Standings", Icon: IconStandings },
  { href: "/stream", label: "Stream", Icon: IconStream },
  { href: "/equipos", label: "Equipos", Icon: IconTeams },
  { href: "/ajustes", label: "Ajustes", Icon: IconSettings },
];

export default function OperatorSidebar() {
  const pathname = usePathname();

  return (
    <aside className="bf-op-sidebar">
      <div className="bf-op-brand">
        <span className="bf-op-brand-mark">BF</span>
        <span className="bf-op-brand-copy">
          <span className="bf-op-brand-name">BracketFlow</span>
          <span className="bf-op-brand-tag">Operator Suite</span>
        </span>
      </div>

      <nav className="bf-op-nav" aria-label="Navegación principal">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`bf-op-nav-link ${isActive ? "is-active" : ""}`.trim()}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="bf-op-nav-icon">
                <Icon size={18} />
              </span>
              <span className="bf-op-nav-label">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="bf-op-foot">
        {/*
          Toggle día/noche: visible pero DARK-ONLY por ahora. El tema
          claro llega en una fase futura aparte; el botón "Día" queda
          deshabilitado y sólo deja constancia de la intención de diseño.
        */}
        <div className="bf-op-theme" role="group" aria-label="Tema (dark-only por ahora)">
          <button type="button" className="bf-op-theme-opt is-on" aria-pressed="true">
            <IconMoon size={15} />
            Noche
          </button>
          <button
            type="button"
            className="bf-op-theme-opt"
            disabled
            aria-pressed="false"
            title="Tema claro: próximamente"
          >
            <IconSun size={15} />
            Día
          </button>
        </div>

        <div className="bf-op-profile">
          <span className="bf-op-avatar">OP</span>
          <span className="bf-op-profile-copy">
            <span className="bf-op-profile-name">Operator</span>
            <span className="bf-op-profile-state">
              <i className="bf-op-dot" />
              online
            </span>
          </span>
        </div>
      </div>
    </aside>
  );
}
