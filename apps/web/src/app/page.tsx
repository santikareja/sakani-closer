import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">Fondasi internal · Phase 1</p>
        <h1 id="page-title">Sakani Closer</h1>
        <p className="lead">
          Fondasi layanan untuk agen pemasaran properti berbasis WhatsApp. Koneksi WhatsApp dan AI
          belum diaktifkan pada tahap ini.
        </p>
        <div className="actions">
          <Link className="primary-action" href="/login">
            Masuk ke dashboard
          </Link>
          <Link className="secondary-action" href="/health">
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
          Autentikasi owner, sesi aman, dashboard terlindungi, dan isolasi workspace sudah
          disiapkan. Belum ada pesan otomatis, koneksi provider AI, ataupun data lead.
        </p>
      </section>
    </main>
  );
}
