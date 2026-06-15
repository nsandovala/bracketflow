import { ReactNode } from "react";

type ComingSoonProps = {
  title: string;
  description: string;
  icon: ReactNode;
};

/**
 * Placeholder elegante "Próximamente" para los items del sidebar que
 * todavía no tienen vista propia (Torneos, Equipos, Ajustes). Vive
 * dentro del shell del operador, NO es un 404.
 */
export default function ComingSoon({ title, description, icon }: ComingSoonProps) {
  return (
    <div className="bf-op-soon">
      <span className="bf-op-soon-icon">{icon}</span>
      <h2>{title}</h2>
      <p>{description}</p>
      <span className="bf-dash-badge">Próximamente</span>
    </div>
  );
}
