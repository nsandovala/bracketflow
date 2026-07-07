"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";
import {
  Bracket,
  Seed,
  SeedItem,
  type IRenderSeedProps,
} from "react-brackets";

import type { Match, Team, Tournament } from "../../lib/api";
import type { ResolvedTournamentEngine } from "../../lib/tournamentModel";
import { findChampion, isTournamentCompleted } from "../../lib/tournamentStatus";
import {
  type ReactBracketSeed,
  toBracketRounds,
} from "../../lib/toBracketRounds";

type BracketViewProps = {
  tournament: Tournament | null;
  engine: ResolvedTournamentEngine | null;
  teams: Team[];
  matches: Match[];
  mode: "setup" | "stream" | "operator" | "standings";
};

function SeedContent({ seed }: { seed: ReactBracketSeed }) {
  return (
    <div className={`bf-rb-seed bf-rb-seed--${seed.statusTone}`}>
      <header className="bf-rb-seed-head">
        <div className="bf-rb-seed-copy">
          <span className="bf-rb-seed-match">{seed.matchLabel}</span>
          <strong className="bf-rb-seed-format">BO{seed.bestOf}</strong>
        </div>
        <span className={`bf-rb-status bf-rb-status--${seed.statusTone}`}>
          {seed.statusLabel}
        </span>
      </header>

      <div className="bf-rb-team-list">
        {seed.teams.map((team) => (
          <div
            key={team.id}
            className={[
              "bf-rb-team",
              team.isWinner ? "is-winner" : "",
              team.isLoser ? "is-loser" : "",
              team.isFuture || team.isEmpty || team.isBye ? "is-neutral" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="bf-rb-team-main">
              <div className="bf-rb-team-name-row">
                <span className="bf-rb-team-name">{team.name}</span>
                {team.badge ? <span className="bf-rb-team-badge">{team.badge}</span> : null}
              </div>
              <span className="bf-rb-team-roster">{team.roster}</span>
            </div>

            <div className="bf-rb-team-side">
              {team.score !== null ? <strong className="bf-rb-team-score">{team.score}</strong> : null}
              <span className="bf-rb-team-state">{team.stateLabel}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderSeed(props: IRenderSeedProps) {
  const seed = props.seed as ReactBracketSeed;

  return (
    <Seed
      className="bf-rb-seed-shell"
      mobileBreakpoint={props.breakpoint}
      style={{ padding: "14px 18px" }}
    >
      <SeedItem style={{ background: "transparent", boxShadow: "none" }}>
        <SeedContent seed={seed} />
      </SeedItem>
    </Seed>
  );
}

function renderRoundTitle(title: ReactNode) {
  return <div className="bf-rb-round-title">{title}</div>;
}

function ChampionBlock({
  champion,
  tournament,
  mode,
}: {
  champion: ReturnType<typeof findChampion>;
  tournament: Tournament | null;
  mode: BracketViewProps["mode"];
}) {
  if (!champion) return null;

  return (
    <div className="bf-champion-block">
      <div className="bf-champion-glow" aria-hidden="true" />
      <div className="bf-champion-content">
        <div className="bf-champion-kicker">Campeón coronado</div>
        <h3 className="bf-champion-name">{champion.displayName}</h3>
        <p className="bf-champion-roster">{champion.rosterText}</p>
        <div className="bf-champion-meta">
          <span className="bf-champion-score">Serie final: {champion.finalScore}</span>
          <span className="bf-champion-division">·</span>
          <span className="bf-champion-format">BO3 Single Elim</span>
        </div>
        {mode !== "stream" ? (
          <div className="bf-champion-actions">
            <a
              href={`/standings?tournamentId=${tournament?.id ?? ""}`}
              className="bf-button bf-button-ghost"
            >
              Ver bracket final
            </a>
            <a
              href={`/stream?tournamentId=${tournament?.id ?? ""}&obs=1`}
              className="bf-button bf-button-ghost"
            >
              Ir a Stream
            </a>
            <a href="/torneos" className="bf-button bf-button-ghost">
              Volver a Torneos
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BracketToolbar({
  onFit,
  onReset,
}: {
  onFit: () => void;
  onReset: () => void;
}) {
  return (
    <div className="bf-bracket-toolbar">
      <span className="bf-bracket-toolbar-label">Vista</span>
      <button type="button" className="bf-bracket-toolbar-btn" onClick={onFit} title="Ajustar al ancho">
        Fit
      </button>
      <button type="button" className="bf-bracket-toolbar-btn" onClick={onReset} title="Tamaño original">
        Reset
      </button>
    </div>
  );
}

export default function BracketView({
  tournament,
  engine,
  teams,
  matches,
  mode,
}: BracketViewProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const rounds = toBracketRounds(matches, teams, engine?.teamSize ?? 2);
  const hasTeams = teams.length > 0;
  const hasMatches = matches.length > 0;
  const champion = findChampion(matches, teams);
  const isCompleted = isTournamentCompleted(matches);

  const title = isCompleted ? "Torneo finalizado" : hasMatches ? "Bracket" : "Falta generar bracket";
  const subtitle = isCompleted
    ? `Campeón: ${champion?.displayName ?? "—"} · Serie ${champion?.finalScore ?? "—"}.`
    : hasMatches
      ? `${teams.length} equipos sembrados - ${engine?.tournamentStructure === "double_elim" ? "Double elim" : "Single elim"}.`
      : hasTeams
        ? "Los equipos ya existen. Genera la llave para empezar a operar el BO3."
        : "Carga participantes, gira la ruleta y confirma equipos para ver la llave.";

  function handleFit() {
    const board = boardRef.current;
    if (!board) return;
    const contentWidth = board.scrollWidth;
    const containerWidth = board.clientWidth;
    if (contentWidth > containerWidth) {
      setScale(Math.max(0.55, containerWidth / contentWidth));
    } else {
      setScale(1);
    }
  }

  function handleReset() {
    setScale(1);
  }

  return (
    <section className={`bf-bracket-view is-${mode}`}>
      <div className="bf-bracket-head">
        <div>
          <span className="opr-eyebrow">{tournament?.name ?? "BracketFlow"}</span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <span className="bf-bracket-badge">
          {isCompleted
            ? "Finalizado"
            : engine?.tournamentStructure === "double_elim"
              ? "Double elim"
              : "Single elim"}
        </span>
      </div>

      {champion && isCompleted ? (
        <ChampionBlock champion={champion} tournament={tournament} mode={mode} />
      ) : null}

      {rounds.length === 0 ? (
        <div className="bf-bracket-empty">
          <strong>Seed pendiente</strong>
          <p>
            {hasTeams
              ? "Los equipos estan listos, pero la llave todavia no fue generada."
              : "Carga participantes y confirma equipos para pintar la llave."}
          </p>
        </div>
      ) : (
        <>
          {mode !== "stream" ? <BracketToolbar onFit={handleFit} onReset={handleReset} /> : null}
          <div className="bf-bracket-board" ref={boardRef}>
            <div
              className="bf-bracket-canvas"
              style={{
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            >
              <Bracket
                rounds={rounds}
                mobileBreakpoint={0}
                bracketClassName="bf-rb-root"
                roundClassName="bf-rb-round"
                roundTitleComponent={renderRoundTitle}
                renderSeedComponent={renderSeed}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
