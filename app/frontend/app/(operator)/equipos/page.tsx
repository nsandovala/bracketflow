import ComingSoon from "../../components/ComingSoon";
import { IconTeams } from "../../components/icons";

export default function EquiposPage() {
  return (
    <ComingSoon
      title="Equipos"
      description="La administración de equipos y rosters dentro del shell llega en una próxima fase. Por ahora se gestionan desde Operator."
      icon={<IconTeams size={28} />}
    />
  );
}
