"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

import { Tournament } from "../../lib/api";

import StatusBadge from "./StatusBadge";

type NavLink = {
  href: string;
  label: string;
};

type AppTopbarProps = {
  title: string;
  subtitle: string;
  navLinks?: NavLink[];
  backHref?: string;
  showBackendStatus?: boolean;
  backendOnline?: boolean;
  tournamentSelector?: {
    tournaments: Tournament[];
    selectedTournamentId: number | null;
    onSelectTournament: (tournamentId: number) => void;
  };
  actions?: ReactNode;
};

export default function AppTopbar({
  title,
  subtitle,
  navLinks = [],
  backHref,
  showBackendStatus = false,
  backendOnline = false,
  tournamentSelector,
  actions,
}: AppTopbarProps) {
  const pathname = usePathname();

  return (
    <header className="bf-app-topbar">
      <div className="bf-app-topbar-main">
        <div className="bf-brand-lockup">
          <span className="bf-brand-mark">BF</span>
          <div className="bf-brand-copy">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
        </div>

        {(navLinks.length > 0 || backHref) ? (
          <nav className="bf-nav" aria-label="Primary">
            {navLinks.map((link) => {
              const targetPath = link.href.split("?")[0];
              return (
              <Link
                key={link.href}
                href={link.href}
                className={`bf-nav-link ${pathname === targetPath ? "is-active" : ""}`}
              >
                {link.label}
              </Link>
              );
            })}
            {backHref ? (
              <Link href={backHref} className="bf-nav-link">
                Volver
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>

      <div className="bf-app-topbar-side">
        {tournamentSelector ? (
          <label className="bf-field bf-field-compact">
            <span>Torneo</span>
            <select
              value={tournamentSelector.selectedTournamentId ?? ""}
              onChange={(event) => tournamentSelector.onSelectTournament(Number(event.target.value))}
              disabled={tournamentSelector.tournaments.length === 0}
            >
              {tournamentSelector.tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {actions}

        {showBackendStatus ? (
          <StatusBadge
            tone={backendOnline ? "success" : "pending"}
            label={backendOnline ? "Backend online" : "Backend offline"}
          />
        ) : null}
      </div>
    </header>
  );
}
