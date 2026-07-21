import BroadcastSetup from "../../components/BroadcastSetup";

// Ajustes del operador. Por ahora aloja Broadcast Setup (configuracion de
// presentacion de stream/caster). El resto de preferencias (tema claro, etc.)
// llegan en fases futuras dentro de esta misma superficie.
export default function AjustesPage() {
  return (
    <div className="bf-ajustes">
      <BroadcastSetup />
      <p className="bf-ajustes-note">
        Preferencias adicionales del operador y el tema claro llegan en una próxima fase. Por ahora
        la app es dark-only.
      </p>
    </div>
  );
}
