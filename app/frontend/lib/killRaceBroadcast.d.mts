export function calculatePlayerTotal(players?: Array<{ kills: number }>): number;
export function getKillRaceBroadcastStatus(
  resultStatus: string,
  connected?: boolean
): "RECONECTANDO" | "FINAL" | "PROVISIONAL" | "LIVE";
export function selectKillRaceScorebugMatch<T extends {
  winner_id: number | null;
  team_a_id: number | null;
  team_b_id: number | null;
  maps: Array<{ result_status: string }>;
}>(matches: T[]): T | null;
export function resolveKillRaceScorebugMatch<T extends {
  id: number;
  status: string;
  winner_id: number | null;
  team_a_id: number | null;
  team_b_id: number | null;
  maps: Array<{ result_status: string }>;
}>(
  matches: T[],
  explicitMatchId?: number | null,
  broadcastMatchId?: number | null
): T | null;
export function killRaceVisualKey(
  tournamentId: number | null,
  match: {
    id: number;
    maps: Array<{
      map_number: number;
      result_status: string;
      kills_a: number;
      kills_b: number;
    }>;
  } | null
): string;
