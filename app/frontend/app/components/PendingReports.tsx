import Link from "next/link";

import { Team } from "../../lib/api";

import GlassPanel from "./GlassPanel";
import SectionHeader from "./SectionHeader";
import StatusBadge from "./StatusBadge";

type PendingReportsProps = {
  currentGameNumber: number;
  reportsLoaded: number;
  totalTeams: number;
  pendingTeams: Team[];
  canCreateNextGame: boolean;
  nextGameNumber: number;
  submitting: boolean;
  tournamentQuery: string;
  onCreateNextGame: () => void;
};

export default function PendingReports({
  currentGameNumber,
  reportsLoaded,
  totalTeams,
  pendingTeams,
  canCreateNextGame,
  nextGameNumber,
  submitting,
  tournamentQuery,
  onCreateNextGame,
}: PendingReportsProps) {
  return (
    <GlassPanel as="aside" className="bf-control-rail">
      <SectionHeader
        eyebrow="Control"
        title={currentGameNumber > 0 ? `Game ${currentGameNumber}` : "Game pendiente"}
        subtitle="Pendientes, avance y siguiente accion."
      />

      <div className="bf-stat-stack">
        <div className="bf-stat-card">
          <span>Reportes cargados</span>
          <strong>
            {reportsLoaded}/{totalTeams}
          </strong>
        </div>
        <div className="bf-stat-card">
          <span>Pendientes</span>
          <strong>{pendingTeams.length}</strong>
        </div>
      </div>

      <div className="bf-chip-cloud">
        {pendingTeams.length > 0 ? (
          pendingTeams.map((team) => (
            <StatusBadge key={team.id} tone="pending" label={team.name} />
          ))
        ) : (
          <StatusBadge tone="success" label="Todos reportaron" />
        )}
      </div>

      <button
        type="button"
        className="bf-button bf-button-primary"
        onClick={onCreateNextGame}
        disabled={!canCreateNextGame || submitting}
      >
        {currentGameNumber === 0 ? "Crear Game 1" : `Crear Game ${nextGameNumber}`}
      </button>

      {!canCreateNextGame && totalTeams > 0 ? (
        <p className="bf-inline-note">
          Completa los reportes pendientes antes de abrir el siguiente game.
        </p>
      ) : null}

      <div className="bf-rail-links">
        <Link href="/" className="bf-button bf-button-ghost">
          Volver al hub
        </Link>
        <Link href={`/standings${tournamentQuery}`} className="bf-button bf-button-ghost">
          Ver standings
        </Link>
      </div>
    </GlassPanel>
  );
}
