"use client";

import { useMemo, useState } from "react";

import type {
  LeaderboardEntry,
  Match,
  MatchCompletionPolicy,
  Team,
  TeamResultDetail,
  Tournament,
} from "../../lib/api";
import {
  getMvpPlayerRanking,
  getMvpState,
  type MvpState,
} from "../../lib/mvp";
import type { MatchPointStatus } from "../../lib/tournamentStatus";
import { getTeamDisplayName, getTeamRosterText } from "../../lib/tournamentStatus";
import type { IdentityCatalog } from "../../lib/identityResolver";
import {
  getResolvedTeamProfile,
  matchPlayerProfile,
  normalizeIdentityName,
} from "../../lib/identityResolver";
import {
  createPlayerBroadcastProfileView,
  getStableMvpRanks,
} from "../../lib/playerBroadcastProfile.mjs";
import {
  createCasterInspectorSelection,
  getMatchPointDefinitionSummary,
  reconcileCasterInspectorSelection,
  toggleCasterInspectorContext,
} from "../../lib/casterInspectorState.mjs";

type ContextKey = "leader" | "kills" | "mvp" | "definition" | "matches";

type Props = {
  tournament: Tournament;
  teams: Team[];
  rawTeams: Team[];
  standings: LeaderboardEntry[];
  matches: Match[];
  results: TeamResultDetail[];
  identityCatalog: IdentityCatalog;
  matchPointStatus: MatchPointStatus;
  matchCompletionPolicy: MatchCompletionPolicy | null;
  isBracket: boolean;
  bracketCompleted: boolean;
  bracketChampionLabel: string | null;
  activeMatch: Match | null;
  loading: boolean;
  backendOnline: boolean;
};

function formatPoints(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function rankWithTies<T>(rows: T[], value: (row: T) => number) {
  return rows.map((row, index) => ({
    row,
    rank: index > 0 && value(rows[index - 1]) === value(row)
      ? null
      : index + 1,
  }));
}

export default function CasterContextInspector({
  tournament,
  teams,
  rawTeams,
  standings,
  matches,
  results,
  identityCatalog,
  matchPointStatus,
  matchCompletionPolicy,
  isBracket,
  bracketCompleted,
  bracketChampionLabel,
  activeMatch,
  loading,
  backendOnline,
}: Props) {
  const matchPointThreshold =
    matchCompletionPolicy?.matchPointThreshold ?? undefined;
  const [selection, setSelection] = useState<{
    tournamentId: number;
    selected: ContextKey | null;
  }>(
    () =>
      createCasterInspectorSelection(
        tournament.id,
        standings.length,
        results.length
      ) as { tournamentId: number; selected: ContextKey | null }
  );
  const reconciledSelection = reconcileCasterInspectorSelection(
    selection,
    tournament.id,
    standings.length,
    results.length
  ) as { tournamentId: number; selected: ContextKey | null };
  if (reconciledSelection !== selection) {
    setSelection(reconciledSelection);
  }
  const selected = reconciledSelection.selected;

  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const rawTeamById = useMemo(
    () => new Map(rawTeams.map((team) => [team.id, team])),
    [rawTeams]
  );
  const leader = standings[0] ?? null;
  const mvp = getMvpState(results, standings);
  const players = getMvpPlayerRanking(results);
  const resultsWithPlayerStats = results.filter((result) => (result.player_stats?.length ?? 0) > 0);
  const teamsWithPlayerStats = new Set(resultsWithPlayerStats.map((result) => result.team_id));
  const standingsByKills = [...standings].sort(
    (left, right) =>
      right.kills - left.kills ||
      right.total_points - left.total_points ||
      left.team_name.localeCompare(right.team_name)
  );
  const killLeaderValue = standingsByKills[0]?.kills ?? 0;
  const officialMatches = matches
    .filter((match) => isBracket || (match.team_a_id === null && match.team_b_id === null))
    .sort((left, right) => left.round - right.round || left.id - right.id);
  const reportsByMatch = new Map<number, TeamResultDetail[]>();
  for (const result of results) {
    const current = reportsByMatch.get(result.match_id) ?? [];
    current.push(result);
    reportsByMatch.set(result.match_id, current);
  }
  const latestReportedMatch = officialMatches
    .filter((match) =>
      isBracket
        ? match.status === "completed" || match.winner_id !== null || match.maps.length > 0
        : (reportsByMatch.get(match.id)?.length ?? 0) > 0
    )
    .at(-1) ?? null;
  const activeReports = activeMatch
    ? isBracket
      ? Number(activeMatch.status === "completed" || activeMatch.winner_id !== null)
      : reportsByMatch.get(activeMatch.id)?.length ?? 0
    : 0;
  const expectedActiveReports = isBracket
    ? activeMatch ? 1 : 0
    : teams.length;
  const pendingActiveReports =
    !isBracket && activeMatch?.status === "completed"
      ? 0
      : Math.max(expectedActiveReports - activeReports, 0);
  const completedOfficialMatches = officialMatches.filter((match) => match.status === "completed").length;
  const definitionSummary = getMatchPointDefinitionSummary({
    policy: matchCompletionPolicy,
    status: matchPointStatus,
    isBracket,
    bracketChampionLabel,
    tournamentCompleted: tournament.status === "completed",
  });

  const cards: Array<{ key: ContextKey; label: string; value: string; detail: string; gold?: boolean }> = [
    {
      key: "leader",
      label: "Líder actual",
      value: bracketChampionLabel ?? (leader ? leader.team_name : "Sin líder"),
      detail: leader ? `${formatPoints(leader.total_points)} pts · ${leader.kills} K` : "Leaderboard pendiente",
    },
    {
      key: "kills",
      label: "Top kills / equipo",
      value: standingsByKills[0]
        ? `${standingsByKills[0].team_name} · ${standingsByKills[0].kills} K`
        : "Datos pendientes",
      detail: standingsByKills[1]?.kills === killLeaderValue ? "Liderato empatado" : "Ranking por kills reportadas",
    },
    {
      key: "mvp",
      label: "MVP / jugadores",
      value: getMvpLabel(mvp),
      detail: players.length > 0 ? `${players.length} jugadores con stats` : "Player stats pendientes",
    },
    {
      key: "definition",
      label: "Definición / Match Point",
      value: definitionSummary.label,
      detail: definitionSummary.detail,
      gold: true,
    },
    {
      key: "matches",
      label: "Partidas / serie",
      value: activeMatch ? `Partida ${activeMatch.round}` : "Sin partida activa",
      detail: latestReportedMatch ? `Último reporte: Partida ${latestReportedMatch.round}` : "Sin reportes oficiales",
    },
  ];

  return (
    <>
      <section className="bf-caster-snapshot" aria-label="Contextos del torneo">
        {cards.map((card) => {
          const active = selected === card.key;
          return (
            <button
              key={card.key}
              type="button"
              className={`bf-caster-stat${card.gold ? " is-gold" : ""}${active ? " is-active" : ""}`}
              aria-expanded={active}
              aria-controls="caster-context-inspector"
              onClick={() =>
                setSelection(
                  (current) =>
                    toggleCasterInspectorContext(current, card.key) as {
                      tournamentId: number;
                      selected: ContextKey | null;
                    }
                )
              }
            >
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.detail}</small>
            </button>
          );
        })}
      </section>

      <section
        id="caster-context-inspector"
        className="bf-caster-inspector"
        aria-live="polite"
        hidden={selected === null}
      >
        {loading ? (
          <p className="bf-caster-inspector-empty">Cargando contexto oficial…</p>
        ) : !backendOnline ? (
          <p className="bf-caster-inspector-empty">Backend offline. No se puede actualizar este contexto.</p>
        ) : selected === "leader" ? (
          <LeaderDetail
            leader={leader}
            second={standings[1] ?? null}
            team={leader ? teamById.get(leader.team_id) ?? null : null}
            rawTeam={leader ? rawTeamById.get(leader.team_id) ?? null : null}
            results={leader ? results.filter((result) => result.team_id === leader.team_id) : []}
            identityCatalog={identityCatalog}
          />
        ) : selected === "kills" ? (
          <KillsDetail rows={standingsByKills} />
        ) : selected === "mvp" ? (
          <MvpDetail
            key={`mvp-${tournament.id}`}
            mvp={mvp}
            players={players}
            teams={teams}
            results={results}
            identityCatalog={identityCatalog}
            reportCount={resultsWithPlayerStats.length}
            coveredTeams={teamsWithPlayerStats.size}
            totalTeams={teams.length}
          />
        ) : selected === "definition" ? (
          <DefinitionDetail
            tournament={tournament}
            status={matchPointStatus}
            policy={matchCompletionPolicy}
            threshold={matchPointThreshold}
            standings={standings}
            activeMatch={activeMatch}
            isBracket={isBracket}
            bracketCompleted={bracketCompleted}
            bracketChampionLabel={bracketChampionLabel}
          />
        ) : selected === "matches" ? (
          <MatchesDetail
            activeMatch={activeMatch}
            latestReportedMatch={latestReportedMatch}
            activeReports={activeReports}
            pendingActiveReports={pendingActiveReports}
            completedOfficialMatches={completedOfficialMatches}
            officialMatches={officialMatches}
            reportsByMatch={reportsByMatch}
            teamCount={teams.length}
            isBracket={isBracket}
          />
        ) : null}
      </section>
    </>
  );
}

function getMvpLabel(mvp: MvpState) {
  if (mvp.kind !== "player") return "Player stats pendientes";
  return mvp.tiedWith.length > 0 ? `MVP empatado · ${mvp.kills} K` : `MVP actual · ${mvp.kills} K`;
}

function getDefinitionLabel(
  status: MatchPointStatus,
  tournament: Tournament,
  isBracket: boolean,
  bracketChampionLabel: string | null
) {
  if (status.state === "champion") return `Campeón: ${status.championLabel}`;
  if (bracketChampionLabel) return `Campeón: ${bracketChampionLabel}`;
  if (tournament.status === "completed") return "Finalizado";
  if (status.state === "threshold_reached") {
    return status.reason === "tie" ? "Empate sin resolver" : "Umbral alcanzado";
  }
  if (status.state === "not_configured") return "Match Point no configurado";
  if (status.state === "disabled") return "Match Point desactivado";
  if (status.state === "unsupported") return "Motor sin Match Point";
  return isBracket ? "Serie abierta" : "Competencia abierta";
}

function LeaderDetail({
  leader,
  second,
  team,
  rawTeam,
  results,
  identityCatalog,
}: {
  leader: LeaderboardEntry | null;
  second: LeaderboardEntry | null;
  team: Team | null;
  rawTeam: Team | null;
  results: TeamResultDetail[];
  identityCatalog: IdentityCatalog;
}) {
  if (!leader) return <p className="bf-caster-inspector-empty">Aún no hay standings oficiales.</p>;
  const identity = rawTeam ? getResolvedTeamProfile(rawTeam, identityCatalog) : null;
  const name = team ? getTeamDisplayName(team) : leader.team_name;
  const roster = team ? getTeamRosterText(team) : "";
  const sortedResults = [...results].sort((left, right) => left.round - right.round);
  return (
    <>
      <header className="bf-caster-inspector-head">
        <div>
          <span>Líder actual</span>
          <h2>{name}{identity?.short_name ? <small>{identity.short_name}</small> : null}</h2>
          <p>{roster || "Roster pendiente"}</p>
        </div>
        <div className="bf-caster-inspector-metrics">
          <span><b>{formatPoints(leader.total_points)}</b> puntos</span>
          <span><b>{leader.kills}</b> kills</span>
          <span><b>{leader.best_placement ?? "—"}</b> mejor puesto</span>
          <span><b>{leader.matches_played}</b> partidas</span>
          {second ? <span><b>{formatPoints(leader.total_points - second.total_points)}</b> ventaja</span> : null}
        </div>
      </header>
      <CompactRows
        labels={["Partida", "Kills", "Puesto", "Puntos"]}
        rows={sortedResults.map((result) => [
          String(result.round),
          String(result.kills),
          String(result.placement),
          formatPoints(result.total_points),
        ])}
        empty="Sin reportes por partida para el líder."
      />
    </>
  );
}

function KillsDetail({ rows }: { rows: LeaderboardEntry[] }) {
  const top = rows.slice(0, 5);
  const leaderKills = top[0]?.kills ?? 0;
  const ranked = rankWithTies(top, (row) => row.kills);
  return (
    <>
      <InspectorTitle title="Top kills / equipos" note={top[1]?.kills === leaderKills ? "Liderato empatado" : "Kills oficiales acumuladas"} />
      <CompactRows
        labels={["#", "Equipo", "Kills", "Puntos", "Dif. líder"]}
        rows={ranked.map(({ row, rank }, index) => [
          rank === null ? `=${ranked[index - 1]?.rank ?? 1}` : String(rank),
          row.team_name,
          String(row.kills),
          formatPoints(row.total_points),
          row.kills === leaderKills ? (top.filter((entry) => entry.kills === leaderKills).length > 1 ? "Empate" : "—") : `-${leaderKills - row.kills}`,
        ])}
        empty="Sin standings oficiales."
      />
    </>
  );
}

function MvpDetail({
  mvp,
  players,
  teams,
  results,
  identityCatalog,
  reportCount,
  coveredTeams,
  totalTeams,
}: {
  mvp: MvpState;
  players: ReturnType<typeof getMvpPlayerRanking>;
  teams: Team[];
  results: TeamResultDetail[];
  identityCatalog: IdentityCatalog;
  reportCount: number;
  coveredTeams: number;
  totalTeams: number;
}) {
  const [selectedPlayerKey, setSelectedPlayerKey] = useState<string | null>(null);
  const status = mvp.kind === "player"
    ? mvp.tiedWith.length > 0 ? "MVP empatado" : "MVP actual"
    : "Player stats pendientes";
  const partial = coveredTeams > 0 && coveredTeams < totalTeams;
  const officialRanks = new Map(
    getStableMvpRanks(players.filter((player) => player.kills > 0)).map((player) => [
      `${player.teamId}::${normalizeIdentityName(player.playerName)}`,
      player.rank,
    ])
  );
  const playerRows = new Map(
    players.map((player) => [
      `${player.teamId}::${normalizeIdentityName(player.playerName)}`,
      player,
    ])
  );
  for (const team of teams) {
    for (const member of team.members) {
      const playerName = member.player.nickname;
      const key = `${team.id}::${normalizeIdentityName(playerName)}`;
      if (!playerRows.has(key)) {
        playerRows.set(key, {
          playerName,
          teamId: team.id,
          teamName: team.name,
          kills: 0,
          matches: 0,
        });
      }
    }
  }
  const rows = [...playerRows.entries()].sort(
    ([leftKey, left], [rightKey, right]) =>
      (officialRanks.get(leftKey) ?? Number.MAX_SAFE_INTEGER) -
        (officialRanks.get(rightKey) ?? Number.MAX_SAFE_INTEGER) ||
      right.kills - left.kills ||
      left.teamName.localeCompare(right.teamName) ||
      left.playerName.localeCompare(right.playerName)
  );
  const selectedEntry =
    rows.find(([key]) => key === selectedPlayerKey) ?? null;
  const selectedPlayer = selectedEntry?.[1] ?? null;
  const selectedProfile = selectedPlayer
    ? matchPlayerProfile(
        selectedPlayer.playerName,
        identityCatalog.players,
        identityCatalog.gameIdentities
      )
    : null;
  const selectedView = selectedPlayer
    ? createPlayerBroadcastProfileView({
        playerName: selectedPlayer.playerName,
        teamId: selectedPlayer.teamId,
        teamName: selectedPlayer.teamName,
        profile: selectedProfile,
        gameIdentities: identityCatalog.gameIdentities,
        results,
        mvpRank:
          officialRanks.get(
            `${selectedPlayer.teamId}::${normalizeIdentityName(selectedPlayer.playerName)}`
          ) ?? null,
      })
    : null;

  return (
    <>
      <InspectorTitle
        title={status}
        note={partial ? `Cobertura parcial de player stats · ${reportCount} reportes / ${coveredTeams} de ${totalTeams} equipos` : coveredTeams > 0 ? `${reportCount} reportes · ${coveredTeams} equipos` : "No hay player stats reportadas"}
      />
      {rows.length === 0 ? (
        <p className="bf-caster-inspector-empty">
          No hay jugadores en roster ni player stats oficiales.
        </p>
      ) : (
        <div className="bf-caster-player-table" role="table" aria-label="Jugadores del torneo">
          <div className="bf-caster-player-row is-head" role="row">
            {["#", "Jugador", "Equipo", "Kills", "Reportes", "Promedio"].map(
              (label) => <span role="columnheader" key={label}>{label}</span>
            )}
          </div>
          {rows.map(([key, player]) => {
            const rank = officialRanks.get(key);
            const active = selectedPlayerKey === key;
            return (
              <button
                type="button"
                className={`bf-caster-player-row${active ? " is-active" : ""}`}
                aria-pressed={active}
                onClick={() =>
                  setSelectedPlayerKey((current) => current === key ? null : key)
                }
                key={key}
              >
                <span>{rank ?? "—"}</span>
                <span>{player.playerName}</span>
                <span>{player.teamName}</span>
                <span>{player.matches > 0 ? player.kills : "—"}</span>
                <span>{player.matches || "—"}</span>
                <span>{player.matches > 0 ? (player.kills / player.matches).toFixed(1) : "—"}</span>
              </button>
            );
          })}
        </div>
      )}
      {selectedPlayer && selectedView ? (
        <PlayerBroadcastDetail
          playerName={selectedPlayer.playerName}
          view={selectedView}
        />
      ) : (
        <p className="bf-caster-player-prompt">
          Selecciona un jugador para abrir su perfil de broadcast.
        </p>
      )}
    </>
  );
}

function PlayerBroadcastDetail({
  playerName,
  view,
}: {
  playerName: string;
  view: ReturnType<typeof createPlayerBroadcastProfileView>;
}) {
  return (
    <section className="bf-player-broadcast-detail" aria-label={`Perfil de ${playerName}`}>
      <header>
        <div>
          <span>Player Broadcast Profile</span>
          <h3>{view.declared.displayName}</h3>
        </div>
        <div className="bf-player-profile-status">
          <span>{view.identityStatus}</span>
          <span>{view.profileStatus}</span>
        </div>
      </header>
      <div className="bf-player-profile-sections">
        <section>
          <div className="bf-player-profile-heading">
            <span>Perfil declarado</span>
            <small>No verificado · no afecta scoring</small>
          </div>
          <dl>
            <div><dt>Game handle</dt><dd>{view.declared.gameHandle}</dd></div>
            <div><dt>Aliases</dt><dd>{view.declared.aliases.join(" · ") || "Sin dato"}</dd></div>
            <div><dt>K/D informado por el jugador</dt><dd>{view.declared.declaredKdLabel}</dd></div>
            <div><dt>Rol</dt><dd>{view.declared.role}</dd></div>
            <div><dt>Plataforma</dt><dd>{view.declared.platform}</dd></div>
            <div><dt>Input</dt><dd>{view.declared.input}</dd></div>
            <div><dt>País</dt><dd>{view.declared.country}</dd></div>
            <div className="is-wide"><dt>Bio corta</dt><dd>{view.declared.shortBio}</dd></div>
            <div className="is-wide"><dt>Nota para caster</dt><dd>{view.declared.casterNote}</dd></div>
            <div><dt>Social</dt><dd>{view.declared.socialHandle}</dd></div>
            <div>
              <dt>Avatar</dt>
              <dd>
                {view.declared.avatarUrl ? (
                  <a href={view.declared.avatarUrl} target="_blank" rel="noreferrer">
                    URL configurada
                  </a>
                ) : "Sin dato"}
              </dd>
            </div>
          </dl>
        </section>
        <section>
          <div className="bf-player-profile-heading">
            <span>Rendimiento oficial del torneo</span>
            <small>{view.official.status}</small>
          </div>
          <dl>
            <div><dt>Equipo</dt><dd>{view.official.team}</dd></div>
            <div><dt>Kills acumuladas</dt><dd>{view.official.reportedMatches > 0 ? view.official.kills : "Sin dato"}</dd></div>
            <div><dt>Partidas con stats</dt><dd>{view.official.reportedMatches}</dd></div>
            <div><dt>Promedio por partida reportada</dt><dd>{view.official.averageKills === null ? "Sin dato" : view.official.averageKills.toFixed(1)}</dd></div>
            <div><dt>Ranking MVP actual</dt><dd>{view.official.mvpRank ? `#${view.official.mvpRank}` : "Sin dato"}</dd></div>
          </dl>
          {view.official.perMatch.length > 0 ? (
            <div className="bf-player-match-stats">
              <span>Player stats por partida</span>
              <div>
                {view.official.perMatch.map((match) => (
                  <p key={match.matchId}>
                    <span>Partida {match.round}</span>
                    <strong>{match.kills} K</strong>
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <p className="bf-player-profile-empty">Sin player stats oficiales.</p>
          )}
        </section>
      </div>
    </section>
  );
}

function DefinitionDetail({
  tournament,
  status,
  policy,
  threshold,
  standings,
  activeMatch,
  isBracket,
  bracketCompleted,
  bracketChampionLabel,
}: {
  tournament: Tournament;
  status: MatchPointStatus;
  policy: MatchCompletionPolicy | null;
  threshold?: number;
  standings: LeaderboardEntry[];
  activeMatch: Match | null;
  isBracket: boolean;
  bracketCompleted: boolean;
  bracketChampionLabel: string | null;
}) {
  const above = threshold ? standings.filter((entry) => entry.total_points >= threshold) : [];
  const activeIncomplete = Boolean(activeMatch && activeMatch.status !== "completed");
  const state = getDefinitionLabel(status, tournament, isBracket, bracketChampionLabel);
  let needed = "La competencia sigue abierta; ningún equipo alcanzó el umbral configurado.";
  if (status.state === "champion" || bracketChampionLabel) needed = "El campeón ya está confirmado por el estado oficial del torneo.";
  else if (tournament.status === "completed" || bracketCompleted) needed = "La competencia figura finalizada.";
  else if (status.state === "threshold_reached" && status.reason === "tie") needed = "Falta resolver el empate en los resultados oficiales.";
  else if (status.state === "threshold_reached" && status.reason === "incomplete_match") needed = "Falta completar la partida activa antes de confirmar la definición.";
  else if (status.state === "threshold_reached") needed = "El umbral fue alcanzado; falta la confirmación del backend.";
  else if (status.state === "not_configured") needed = status.reason;
  else if (status.state === "disabled" || status.state === "unsupported") needed = status.reason;
  else if (!threshold) needed = isBracket ? "La definición depende del cierre de la serie oficial." : (policy?.reason ?? "Política de cierre pendiente.");
  return (
    <>
      <InspectorTitle
        title={state}
        note={
          threshold
            ? `Umbral: ${threshold} puntos`
            : status.state === "not_configured"
              ? "Configuración requerida"
              : policy?.reason ?? "Sin política aplicable"
        }
      />
      <div className="bf-caster-definition">
        <p><span>Partida activa</span><strong>{activeMatch ? `Partida ${activeMatch.round} · ${activeIncomplete ? "incompleta" : "completa"}` : "Sin partida activa"}</strong></p>
        <p><span>Qué falta</span><strong>{needed}</strong></p>
      </div>
      <CompactRows
        labels={["Equipos en/sobre umbral", "Puntos"]}
        rows={above.map((entry) => [entry.team_name, formatPoints(entry.total_points)])}
        empty={threshold ? "Ningún equipo alcanzó el umbral." : "No aplica ranking por umbral."}
      />
    </>
  );
}

function MatchesDetail({
  activeMatch,
  latestReportedMatch,
  activeReports,
  pendingActiveReports,
  completedOfficialMatches,
  officialMatches,
  reportsByMatch,
  teamCount,
  isBracket,
}: {
  activeMatch: Match | null;
  latestReportedMatch: Match | null;
  activeReports: number;
  pendingActiveReports: number;
  completedOfficialMatches: number;
  officialMatches: Match[];
  reportsByMatch: Map<number, TeamResultDetail[]>;
  teamCount: number;
  isBracket: boolean;
}) {
  return (
    <>
      <InspectorTitle title={activeMatch ? `Partida actual: ${activeMatch.round}` : "Sin partida actual"} note={latestReportedMatch ? `Última reportada: Partida ${latestReportedMatch.round}` : "Sin reportes oficiales"} />
      <div className="bf-caster-inspector-metrics is-inline">
        <span><b>{activeReports}</b> reportes actuales</span>
        <span><b>{pendingActiveReports}</b> pendientes</span>
        <span><b>{completedOfficialMatches}</b> partidas completas</span>
      </div>
      <CompactRows
        labels={["Partida", "Reportes", "Pendientes", "Estado"]}
        rows={officialMatches.map((match) => {
          const count = isBracket
            ? Number(match.status === "completed" || match.winner_id !== null)
            : reportsByMatch.get(match.id)?.length ?? 0;
          const expected = isBracket ? 1 : teamCount;
          return [
            String(match.round),
            String(count),
            !isBracket && match.status === "completed"
              ? "—"
              : String(Math.max(expected - count, 0)),
            match.status === "completed" ? "Completa" : "Abierta",
          ];
        })}
        empty="El torneo aún no tiene partidas oficiales."
      />
    </>
  );
}

function InspectorTitle({ title, note }: { title: string; note: string }) {
  return <header className="bf-caster-inspector-title"><h2>{title}</h2><span>{note}</span></header>;
}

function CompactRows({
  labels,
  rows,
  empty,
}: {
  labels: string[];
  rows: string[][];
  empty: string;
}) {
  if (rows.length === 0) return <p className="bf-caster-inspector-empty">{empty}</p>;
  return (
    <div className="bf-caster-compact-table" role="table">
      <div
        className="bf-caster-compact-row is-head"
        role="row"
        style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(80px, 1fr))` }}
      >
        {labels.map((label) => <span role="columnheader" key={label}>{label}</span>)}
      </div>
      {rows.map((row, rowIndex) => (
        <div
          className="bf-caster-compact-row"
          role="row"
          key={`${row[0]}-${rowIndex}`}
          style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(80px, 1fr))` }}
        >
          {row.map((value, index) => <span role="cell" key={`${index}-${value}`}>{value}</span>)}
        </div>
      ))}
    </div>
  );
}
