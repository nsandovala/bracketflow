// Motor de resolucion de equipo compartido entre CSV/TXT (statsDraftImport)
// y OCR imagen (ocrImageDraftReview). Matching exacto (nombre, roster
// completo, o un solo player/captain) — SIN fuzzy matching: cualquier
// ambiguedad (2+ candidatos) nunca se resuelve sola.
// Modulo plano (.mjs) a proposito: se ejecuta directo con `node --test`, sin
// paso de build. Ver lib/playerBroadcastProfile.mjs para el mismo patron.

export function normalizeTeamName(value) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("es").replace(/\s+/g, " ");
}

const ROSTER_SEPARATOR = /[/,;]/;

function buildRosterKey(names) {
  const normalized = names.map(normalizeTeamName).filter((name) => name.length > 0);
  if (normalized.length === 0) {
    return null;
  }
  return normalized.sort().join("|");
}

export function buildTeamResolutionIndex(teams) {
  const byName = new Map();
  const byRoster = new Map();
  const byPlayer = new Map();

  for (const team of teams) {
    const normalizedName = normalizeTeamName(team.name);
    const nameMatches = byName.get(normalizedName) ?? [];
    nameMatches.push(team);
    byName.set(normalizedName, nameMatches);

    const memberNames = (team.members ?? []).map((member) => member.player.nickname);
    const rosterKey = buildRosterKey(memberNames);
    if (rosterKey) {
      const rosterMatches = byRoster.get(rosterKey) ?? [];
      rosterMatches.push(team);
      byRoster.set(rosterKey, rosterMatches);
    }
    for (const memberName of memberNames) {
      const normalizedMember = normalizeTeamName(memberName);
      if (normalizedMember.length === 0) {
        continue;
      }
      const playerMatches = byPlayer.get(normalizedMember) ?? [];
      if (!playerMatches.includes(team)) {
        playerMatches.push(team);
      }
      byPlayer.set(normalizedMember, playerMatches);
    }
  }

  return { byName, byRoster, byPlayer };
}

// Retorna { kind: "empty" | "found" | "not_found" | "ambiguous", team?, candidates? }
export function resolveTeamCandidate(teamInput, index) {
  const trimmed = teamInput.trim();
  if (!trimmed) {
    return { kind: "empty" };
  }

  const nameMatches = index.byName.get(normalizeTeamName(trimmed));
  if (nameMatches) {
    return nameMatches.length === 1
      ? { kind: "found", team: nameMatches[0] }
      : { kind: "ambiguous", candidates: nameMatches };
  }

  if (ROSTER_SEPARATOR.test(trimmed)) {
    const rosterKey = buildRosterKey(trimmed.split(ROSTER_SEPARATOR));
    const rosterMatches = rosterKey ? index.byRoster.get(rosterKey) : undefined;
    if (rosterMatches) {
      return rosterMatches.length === 1
        ? { kind: "found", team: rosterMatches[0] }
        : { kind: "ambiguous", candidates: rosterMatches };
    }
    return { kind: "not_found" };
  }

  const playerMatches = index.byPlayer.get(normalizeTeamName(trimmed));
  if (playerMatches) {
    return playerMatches.length === 1
      ? { kind: "found", team: playerMatches[0] }
      : { kind: "ambiguous", candidates: playerMatches };
  }
  return { kind: "not_found" };
}
