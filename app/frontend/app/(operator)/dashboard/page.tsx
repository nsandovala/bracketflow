import { Suspense } from "react";

import DashboardHome from "../../components/DashboardHome";

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="bf-dash-empty">Cargando dashboard...</div>}>
      <DashboardHome />
    </Suspense>
  );
}
