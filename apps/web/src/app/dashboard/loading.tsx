import { LoadingSkeleton } from "../../components/ui/states";

export default function DashboardLoading() {
  return (
    <div className="page-stack" aria-busy="true" aria-label="Memuat halaman">
      <div className="page-header page-header-loading">
        <div className="page-header-copy">
          <LoadingSkeleton className="skeleton-title" />
          <LoadingSkeleton className="skeleton-copy" />
        </div>
      </div>
      <div className="metric-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="metric-card" key={index}>
            <LoadingSkeleton className="skeleton-label" />
            <LoadingSkeleton className="skeleton-metric" />
            <LoadingSkeleton className="skeleton-copy" />
          </div>
        ))}
      </div>
      <LoadingSkeleton className="skeleton-panel" />
    </div>
  );
}
