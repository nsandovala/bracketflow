"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import WorldSeriesStreamView, { StreamLayout } from "../components/WorldSeriesStreamView";

function parseTournamentId(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseLayout(value: string | null): StreamLayout {
  if (
    value === "sidebar" ||
    value === "lower" ||
    value === "lower-third" ||
    value === "matchpoint" ||
    value === "mvp" ||
    value === "leaderboard"
  ) {
    return value;
  }
  return "full";
}

function StreamPageClient() {
  const searchParams = useSearchParams();
  const tournamentId = parseTournamentId(searchParams.get("tournamentId"));
  const obs = searchParams.get("obs") === "1";
  const transparent = searchParams.get("bg") === "transparent";
  const brand = searchParams.get("brand");
  const layout = parseLayout(searchParams.get("layout"));

  return (
    <WorldSeriesStreamView
      tournamentId={tournamentId}
      obs={obs}
      transparent={transparent}
      brand={brand}
      layout={layout}
    />
  );
}

export default function StreamPage() {
  return (
    <Suspense
      fallback={
        <main className="bf-stream-page">
          <div className="bf-stream-stage" />
        </main>
      }
    >
      <StreamPageClient />
    </Suspense>
  );
}
