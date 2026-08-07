export function parseManualKills(value) {
  if (value === "") return { ok: false, error: "Ingresa las kills." };
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return { ok: false, error: "Las kills deben ser un entero mayor o igual a cero." };
  }
  return { ok: true, value: parsed };
}

export function buildManualKillRacePreview({ match, leftTeam, rightTeam, values, mapNumber }) {
  const errors = [];
  const allMembers = [...leftTeam.members, ...rightTeam.members];
  if (leftTeam.members.length !== 2) errors.push("LEFT debe tener exactamente dos jugadores.");
  if (rightTeam.members.length !== 2) errors.push("RIGHT debe tener exactamente dos jugadores.");
  const ids = allMembers.map((member) => member.player.id);
  if (new Set(ids).size !== ids.length) errors.push("El roster contiene jugadores duplicados.");

  const buildSide = (side, team) => {
    if (team.members.length !== 2) return null;
    const players = team.members.map((member) => {
      const parsed = parseManualKills(values[member.player.id] ?? "");
      if (!parsed.ok) errors.push(`${member.player.nickname}: ${parsed.error}`);
      return {
        player_id: member.player.id,
        player_name: member.player.nickname,
        kills: parsed.ok ? parsed.value : 0,
      };
    });
    return {
      side,
      team_id: team.id,
      team_name: team.name,
      players,
      total_kills: players.reduce((total, player) => total + player.kills, 0),
    };
  };

  const left = buildSide("left", leftTeam);
  const right = buildSide("right", rightTeam);
  const valid = errors.length === 0 && left !== null && right !== null;
  return {
    valid,
    match_id: match.id,
    map_number: mapNumber,
    left: valid ? left : null,
    right: valid ? right : null,
    errors: errors.map((message) => ({ code: "manual_invalid", message, row: null })),
    conflicts: [],
  };
}

export function getProjectedSeriesScore(match, preview) {
  if (!preview?.valid || !preview.left || !preview.right) {
    return { left: match.maps_won_a, right: match.maps_won_b, leader: null };
  }
  const leftKills = preview.left.total_kills;
  const rightKills = preview.right.total_kills;
  if (leftKills === rightKills) {
    return { left: match.maps_won_a, right: match.maps_won_b, leader: null };
  }
  return {
    left: match.maps_won_a + (leftKills > rightKills ? 1 : 0),
    right: match.maps_won_b + (rightKills > leftKills ? 1 : 0),
    leader: leftKills > rightKills ? "left" : "right",
  };
}
