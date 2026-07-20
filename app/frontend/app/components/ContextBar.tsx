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
  currentView?: "operator" | "standings";
};

const OPERATOR_BACK_CONFIG: Record<string, { label: string; hrefFn: (id: number) => string }> = {
  kill_race_bracket: {
    label: "← Volver al bracket",
    hrefFn: (id) => `/operator?tournamentId=${id}&tab=bracket`,
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

const STANDINGS_BACK_CONFIG: Record<string, { label: string; hrefFn: (id: number) => string }> = {
  kill_race_bracket: {
    label: "← Volver al bracket",
    hrefFn: (id) => `/operator?tournamentId=${id}&tab=bracket`,
  },
  wsow_br: {
    label: "← Volver al operator",
    hrefFn: (id) => `/operator?tournamentId=${id}`,
  },
  rebirth_ws: {
    label: "← Volver al operator",
    hrefFn: (id) => `/operator?tournamentId=${id}`,
  },
  roulette_ws: {
    label: "← Volver al operator",
    hrefFn: (id) => `/operator?tournamentId=${id}`,
  },
};

const DEFAULT_STANDINGS_BACK = {
  label: "← Volver al operator",
  hrefFn: (id: number) => `/operator?tournamentId=${id}`,
};

export default function ContextBar({
  engineKey,
  tournamentName,
  tournamentId,
  matches = [],
  teams = [],
  tournamentStatus,
  currentView = "operator",
}: ContextBarProps) {
  const router = useRouter();
  const back =
    currentView === "standings"
      ? (engineKey ? STANDINGS_BACK_CONFIG[engineKey] : null) ?? DEFAULT_STANDINGS_BACK
      : (engineKey ? OPERATOR_BACK_CONFIG[engineKey] : null) ?? DEFAULT_BACK;

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
                Campeón: {findChampion(matches, teams)?.displayName ?? "—"}
              </span>
            </>
          ) : null}
        </div>
      </div>

      <div className="opr-context-actions">
        {currentView !== "operator" ? (
          <Link
            href={
              engineKey === "kill_race_bracket"
                ? `/operator?tournamentId=${tournamentId}&tab=bracket`
                : `/operator?tournamentId=${tournamentId}`
            }
            className="opr-context-standings"
          >
            Operator →
          </Link>
        ) : null}
        {currentView !== "standings" ? (
          <Link
            href={`/standings?tournamentId=${tournamentId}`}
            className="opr-context-standings"
          >
            Standings →
          </Link>
        ) : null}
        <Link
          href={`/stream?tournamentId=${tournamentId}${engineKey === "kill_race_bracket" ? "&obs=1" : ""}`}
          className="opr-context-standings"
        >
          Stream →
        </Link>
        {currentView !== "operator" ? (
          <Link
            href="/dashboard"
            className="opr-context-standings"
          >
            Dashboard →
          </Link>
        ) : null}
        <Link href="/torneos" className="opr-context-standings">
          Torneos →
        </Link>
      </div>
    </div>
  );
}
