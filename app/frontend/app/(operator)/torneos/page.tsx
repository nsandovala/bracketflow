import ComingSoon from "../../components/ComingSoon";
import { IconTrophy } from "../../components/icons";

export default function TorneosPage() {
  return (
    <ComingSoon
      title="Torneos"
      description="La gestión completa de torneos (crear, editar, archivar) llega en una próxima fase. Por ahora puedes crear prácticas desde el hub."
      icon={<IconTrophy size={28} />}
    />
  );
}
