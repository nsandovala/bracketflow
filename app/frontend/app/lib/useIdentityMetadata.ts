"use client";

import { useEffect, useState } from "react";

import {
  getIdentityPlayers,
  getIdentityTeams,
  getPlayerGameIdentities,
} from "../../lib/api";
import {
  EMPTY_IDENTITY_CATALOG,
  type IdentityCatalog,
} from "../../lib/identityResolver";

export function useIdentityMetadata() {
  const [catalog, setCatalog] = useState<IdentityCatalog>(EMPTY_IDENTITY_CATALOG);

  useEffect(() => {
    let active = true;
    Promise.all([getIdentityTeams(), getIdentityPlayers(), getPlayerGameIdentities()])
      .then(([teams, players, gameIdentities]) => {
        if (active) setCatalog({ teams, players, gameIdentities });
      })
      .catch(() => {
        // Identity is optional: every consumer keeps its tournament-local fallback.
      });
    return () => {
      active = false;
    };
  }, []);

  return catalog;
}
