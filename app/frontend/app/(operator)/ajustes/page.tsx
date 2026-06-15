import ComingSoon from "../../components/ComingSoon";
import { IconSettings } from "../../components/icons";

export default function AjustesPage() {
  return (
    <ComingSoon
      title="Ajustes"
      description="Preferencias del operador, branding y el tema claro llegan en una próxima fase. Por ahora la app es dark-only."
      icon={<IconSettings size={28} />}
    />
  );
}
