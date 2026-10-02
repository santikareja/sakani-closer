"use client";

import { ArrowClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowClockwise";

export default function DashboardError({ reset }: { reset(): void }) {
  return (
    <section className="state-panel state-panel-error page-error" role="alert">
      <h1>Halaman belum dapat dimuat</h1>
      <p>Terjadi kesalahan sementara. Data sensitif tidak ditampilkan dalam pesan ini.</p>
      <button className="button button-secondary" type="button" onClick={reset}>
        <ArrowClockwiseIcon size={18} aria-hidden="true" />
        Coba lagi
      </button>
    </section>
  );
}
