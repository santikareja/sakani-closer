import { ChartLineIcon } from "@phosphor-icons/react/dist/ssr/ChartLine";

export function ChartPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <article className="chart-placeholder" aria-label={`${title}, belum tersedia`}>
      <div className="chart-placeholder-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="availability-label">Belum tersedia</span>
      </div>
      <div className="chart-empty-visual" aria-hidden="true">
        <ChartLineIcon size={28} />
        <span />
        <span />
        <span />
      </div>
    </article>
  );
}
