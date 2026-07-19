"use client";

import { Fragment, useState } from "react";

import { TeamResultDetail } from "../../lib/api";
import { WorldSeriesStanding } from "../lib/useWorldSeriesPractice";

type StandingsTableProps = {
  entries: WorldSeriesStanding[];
  scoringProfile: "wsow_like" | "kill_race";
  results?: TeamResultDetail[];
};

export default function StandingsTable({
  entries,
  scoringProfile,
  results,
}: StandingsTableProps) {
  // Detalle por partida: una fila expandida a la vez, click en la fila alterna.
  const [expandedTeamId, setExpandedTeamId] = useState<number | null>(null);

  if (entries.length === 0) {
    return (
      <p className="bf-empty">
        {scoringProfile === "kill_race"
          ? "Vista bracket pendiente. Los resultados aparecerán cuando se implemente la llave de eliminación."
          : "Todavia no hay standings."}
      </p>
    );
  }

  if (scoringProfile === "kill_race") {
    return (
      <div className="bf-standings-shell is-kill-race">
        <div className="bf-standings-head">
          <span>#</span>
          <span>Equipo</span>
          <span>Roster</span>
          <span>Kills</span>
          <span>Partidas</span>
        </div>

        {entries.map((entry, index) => (
          <article
            key={entry.team_id}
            className="bf-standings-row"
            data-rank={index + 1}
          >
            <span className="bf-standings-rank">#{index + 1}</span>
            <strong className="bf-standings-name">{entry.team_name}</strong>
            <span className="bf-standings-roster">
              {entry.players.length > 0 ? entry.players.join(" / ") : "Roster pendiente"}
            </span>
            <strong className="bf-standings-points">{entry.kills}</strong>
            <span>{entry.matches_played}</span>
          </article>
        ))}
      </div>
    );
  }

  const hasDetails = Boolean(results && results.length > 0);

  return (
    <div className="bf-standings-shell">
      <div className="bf-standings-head">
        <span>#</span>
        <span>Equipo</span>
        <span>Roster</span>
        <span>Puntos</span>
        <span>Kills</span>
        <span>Best Place</span>
        <span>Partidas</span>
      </div>

      {entries.map((entry, index) => {
        const teamResults = hasDetails
          ? (results ?? [])
              .filter((result) => result.team_id === entry.team_id)
              .sort((left, right) => left.round - right.round)
          : [];
        const expandable = teamResults.length > 0;
        const isExpanded = expandable && expandedTeamId === entry.team_id;

        return (
          <Fragment key={entry.team_id}>
            <article
              className={`bf-standings-row${expandable ? " is-expandable" : ""}${isExpanded ? " is-expanded" : ""}`}
              data-rank={index + 1}
              role={expandable ? "button" : undefined}
              tabIndex={expandable ? 0 : undefined}
              aria-expanded={expandable ? isExpanded : undefined}
              title={expandable ? "Ver detalle por partida" : undefined}
              onClick={
                expandable
                  ? () =>
                      setExpandedTeamId((current) =>
                        current === entry.team_id ? null : entry.team_id
                      )
                  : undefined
              }
              onKeyDown={
                expandable
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setExpandedTeamId((current) =>
                          current === entry.team_id ? null : entry.team_id
                        );
                      }
                    }
                  : undefined
              }
            >
              <span className="bf-standings-rank">#{index + 1}</span>
              <strong className="bf-standings-name">{entry.team_name}</strong>
              <span className="bf-standings-roster">
                {entry.players.length > 0 ? entry.players.join(" / ") : "Roster pendiente"}
              </span>
              <strong className="bf-standings-points">{entry.total_points.toFixed(1)}</strong>
              <span>{entry.kills}</span>
              <span>{entry.best_placement ?? "-"}</span>
              <span>{entry.matches_played}</span>
            </article>

            {isExpanded ? (
              <div className="bf-standings-detail">
                {teamResults.map((result) => (
                  <div key={result.id} className="bf-standings-detail-row">
                    <span className="bf-standings-detail-match">
                      Partida {result.round}
                    </span>
                    <span>{result.kills} kills</span>
                    <span>#{result.placement}</span>
                    <span>{result.total_points.toFixed(1)} pts</span>
                    {result.player_stats && result.player_stats.length > 0 ? (
                      <span className="bf-standings-detail-players">
                        {result.player_stats
                          .map((stat) => `${stat.player_name} ${stat.kills}`)
                          .join(" · ")}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}
