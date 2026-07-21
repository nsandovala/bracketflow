import { Suspense } from "react";

import CasterHub from "../../components/CasterHub";

export default function CasterPage() {
  return (
    <Suspense fallback={<div className="bf-dash-empty">Cargando Caster Hub...</div>}>
      <CasterHub />
    </Suspense>
  );
}