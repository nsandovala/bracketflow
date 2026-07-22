import Link from "next/link";

// Ajustes conserva solo preferencias globales. La configuracion operativa de
// transmision vive en Caster Hub.
export default function AjustesPage() {
  return (
    <div className="bf-ajustes">
      <section className="bf-ajustes-card">
        <span className="bf-bset-eyebrow">Ajustes globales</span>
        <h1>Preferencias de la aplicación</h1>
        <p>
          Broadcast/OBS se configura desde Caster Hub, junto al launcher de overlays y las notas
          de narración.
        </p>
        <Link href="/caster" className="bf-ajustes-caster-link">
          Abrir Caster Hub
        </Link>
      </section>
      <p className="bf-ajustes-note">
        Preferencias adicionales del operador y el tema claro llegan en una próxima fase. Por ahora
        la app es dark-only.
      </p>
    </div>
  );
}
