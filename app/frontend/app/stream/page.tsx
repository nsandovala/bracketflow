"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import WorldSeriesStreamView from "../components/WorldSeriesStreamView";

function parseTournamentId(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function StreamPageClient() {
  const searchParams = useSearchParams();
  const tournamentId = parseTournamentId(searchParams.get("tournamentId"));
  const obs = searchParams.get("obs") === "1";
  const transparent = searchParams.get("bg") === "transparent";
  const brand = searchParams.get("brand");

  return (
    <WorldSeriesStreamView
      tournamentId={tournamentId}
      obs={obs}
      transparent={transparent}
      brand={brand}
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
