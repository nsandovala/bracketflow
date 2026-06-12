import { ReactNode } from "react";

type GlassPanelProps = {
  children: ReactNode;
  className?: string;
  as?: "section" | "article" | "aside" | "div";
};

export default function GlassPanel({
  children,
  className,
  as: Component = "section",
}: GlassPanelProps) {
  return <Component className={`bf-glass-panel ${className ?? ""}`.trim()}>{children}</Component>;
}
