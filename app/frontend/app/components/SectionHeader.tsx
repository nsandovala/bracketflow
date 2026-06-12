import { ReactNode } from "react";

type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export default function SectionHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: SectionHeaderProps) {
  return (
    <div className="bf-section-header">
      <div className="bf-section-copy">
        <p className="bf-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {subtitle ? <p className="bf-section-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="bf-section-actions">{actions}</div> : null}
    </div>
  );
}
