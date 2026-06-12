import AppTopbar from "./AppTopbar";
import GlassPanel from "./GlassPanel";
import SectionHeader from "./SectionHeader";
import StandingsTable from "./StandingsTable";

import { Tournament } from "../../lib/api";
import { WorldSeriesStanding } from "../lib/useWorldSeriesPractice";

type WorldSeriesStandingsProps = {
  tournaments: Tournament[];
  selectedTournamentId: number | null;
  selectedTournament: Tournament | null;
  standings: WorldSeriesStanding[];
  afterGameNumber: number;
  onSelectTournament: (tournamentId: number) => void;
};

export default function WorldSeriesStandings({
  tournaments,
  selectedTournamentId,
  selectedTournament,
  standings,
  afterGameNumber,
  onSelectTournament,
}: WorldSeriesStandingsProps) {
  const tournamentQuery = selectedTournamentId ? `?tournamentId=${selectedTournamentId}` : "";

  return (
    <main className="bf-page">
      <AppTopbar
        title="STANDINGS"
        subtitle={
          selectedTournament
            ? `${selectedTournament.name} / After Game ${afterGameNumber}`
            : "Selecciona un torneo activo."
        }
        navLinks={[
          { href: "/", label: "Hub" },
          { href: `/operator${tournamentQuery}`, label: "Operator" },
          { href: "/standings", label: "Standings" },
          { href: `/stream${tournamentQuery}`, label: "Stream" },
        ]}
        backHref={selectedTournamentId ? `/operator${tournamentQuery}` : "/"}
        tournamentSelector={{
          tournaments,
          selectedTournamentId,
          onSelectTournament,
        }}
      />

      <GlassPanel className="bf-main-panel">
        <SectionHeader
          eyebrow="Standings View"
          title="STANDINGS"
          subtitle={
            selectedTournament
              ? `${selectedTournament.name} / After Game ${afterGameNumber}`
              : "Sin torneo activo"
          }
        />

        <StandingsTable entries={standings} />
      </GlassPanel>
    </main>
  );
}
