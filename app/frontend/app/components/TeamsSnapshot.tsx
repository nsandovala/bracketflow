import { Player, Team } from "../../lib/api";

type TeamsSnapshotProps = {
  teams: Team[];
  rouletteBench: Player[];
  animated?: boolean;
};

export default function TeamsSnapshot({
  teams,
  rouletteBench,
  animated = false,
}: TeamsSnapshotProps) {
  if (teams.length === 0) {
    return <p className="bf-empty">Todavia no hay equipos.</p>;
  }

  return (
    <div className={`bf-stack ${animated ? "bf-roulette-teams" : ""}`}>
      {teams.map((team, index) => (
        <div
          key={team.id}
          className={`bf-team-card ${animated ? "bf-roulette-team" : ""}`}
          style={animated ? { animationDelay: `${index * 80}ms` } : undefined}
        >
          <div className="bf-row">
            <strong>{team.name}</strong>
            <span>{team.source}</span>
          </div>
          {team.members.length > 0 ? (
            <div className="bf-chip-list">
              {team.members.map((member) => (
                <span key={member.id} className="bf-chip">
                  {member.player.nickname}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ))}
      {rouletteBench.length > 0 ? (
        <div className="bf-team-card">
          <div className="bf-row">
            <strong>En espera</strong>
            <span>{rouletteBench.length}</span>
          </div>
          <div className="bf-chip-list">
            {rouletteBench.map((player) => (
              <span key={player.id} className="bf-chip bf-chip-alert">
                {player.nickname}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
