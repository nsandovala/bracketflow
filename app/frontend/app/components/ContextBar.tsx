"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Match, Team } from "../../lib/api";
import { getTournamentPhase, isTournamentCompleted, findChampion } from "../../lib/tournamentStatus";

type ContextBarProps = {
  engineKey: string | undefined;
  tournamentName: string | undefined;
  tournamentId: number | undefined;
  matches?: Match[];
  teams?: Team[];
  tournamentStatus?: string;
};

const BACK_CONFIG: Record<string, { label: string; hrefFn: (id: number) => string }> = {
  kill_race_bracket: {
    label: "← Volver al bracket",
    hrefFn: (id) => `/standings?tournamentId=${id}`,
  },
  wsow_br: {
    label: "← Volver",
    hrefFn: (id) => `/torneos?tournamentId=${id}`,
  },
  rebirth_ws: {
    label: "← Volver",
    hrefFn: (id) => `/torneos?tournamentId=${id}`,
  },
  roulette_ws: {
    label: "← Volver",
    hrefFn: (id) => `/torneos?tournamentId=${id}`,
  },
};

const DEFAULT_BACK = {
  label: "← Volver",
  hrefFn: (id: number) => `/torneos?tournamentId=${id}`,
};

export default function ContextBar({
  engineKey,
  tournamentName,
  tournamentId,
  matches = [],
  teams = [],
  tournamentStatus,
}: ContextBarProps) {
  const router = useRouter();
  const back = (engineKey ? BACK_CONFIG[engineKey] : null) ?? DEFAULT_BACK;

  if (!tournamentId) return null;

  return (
    <div className="opr-context-bar">
      <div className="opr-context-main">
        <button
          type="button"
          className="opr-context-back"
          onClick={() => router.push(back.hrefFn(tournamentId))}
        >
          {back.label}
        </button>
        <div className="opr-context-info">
          <strong>{tournamentName ?? "Torneo"}</strong>
          <span className="opr-context-sep">·</span>
          <span className="opr-context-phase">
            {getTournamentPhase(matches, tournamentStatus)}
          </span>
          {isTournamentCompleted(matches) ? (
            <>
              <span className="opr-context-sep">·</span>
              <span className="opr-context-champion">
                Campeón: {findChampion(matches, teams)?.team.name ?? "—"}
              </span>
            </>
          ) : null}
        </div>
      </div>

      <Link
        href={`/standings?tournamentId=${tournamentId}`}
        className="opr-context-standings"
      >
        Standings →
      </Link>
    </div>
  );
}
