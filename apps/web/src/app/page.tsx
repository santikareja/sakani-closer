import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">Fondasi internal · Phase 0</p>
        <h1 id="page-title">Sakani Closer</h1>
        <p className="lead">
          Fondasi layanan untuk agen pemasaran properti berbasis WhatsApp. Koneksi WhatsApp dan AI
          belum diaktifkan pada tahap ini.
        </p>
        <div className="actions">
          <Link className="primary-action" href="/health">
            Lihat status layanan
          </Link>
          <a className="secondary-action" href="/api/health">
            Buka API health
          </a>
        </div>
      </section>
      <section className="boundary" aria-labelledby="scope-title">
        <h2 id="scope-title">Batas tahap saat ini</h2>
        <p>
          Repository, database dasar, cache, health check, dan jalur deployment awal sudah
          disiapkan. Belum ada pesan otomatis, koneksi provider AI, ataupun data lead.
        </p>
      </section>
    </main>
  );
}
