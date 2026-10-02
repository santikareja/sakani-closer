import type { DashboardMetric } from "../../types/dashboard";
import { StatusBadge } from "./status-badge";

export function MetricCard({ metric }: { metric: DashboardMetric }) {
  return (
    <article className="metric-card">
      <div className="metric-card-heading">
        <p>{metric.label}</p>
        <StatusBadge tone={metric.capability === "live" ? "success" : "neutral"}>
          {metric.capability === "live" ? "Data real" : "Belum tersedia"}
        </StatusBadge>
      </div>
      <strong className={metric.value ? "metric-value" : "metric-value metric-value-muted"}>
        {metric.value ?? "-"}
      </strong>
      <p className="metric-description">{metric.description}</p>
    </article>
  );
}
