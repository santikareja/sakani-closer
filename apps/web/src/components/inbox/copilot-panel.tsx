import { LockKeyIcon } from "@phosphor-icons/react/dist/ssr/LockKey";
import { SparkleIcon } from "@phosphor-icons/react/dist/ssr/Sparkle";

export function CopilotPanel() {
  return (
    <section className="copilot-panel" aria-labelledby="copilot-title">
      <div className="details-section-heading">
        <span className="surface-icon" aria-hidden="true">
          <SparkleIcon size={20} />
        </span>
        <div>
          <h3 id="copilot-title">AI Copilot</h3>
          <p>Belum tersedia</p>
        </div>
      </div>
      <dl className="copilot-fields">
        <div>
          <dt>Ringkasan</dt>
          <dd>Menunggu kontrak AI dan dasar pengetahuan.</dd>
        </div>
        <div>
          <dt>Intent</dt>
          <dd>Belum tersedia</dd>
        </div>
        <div>
          <dt>Kualifikasi lead</dt>
          <dd>Belum tersedia</dd>
        </div>
        <div>
          <dt>Saran balasan</dt>
          <dd>Tidak ada saran yang disimulasikan.</dd>
        </div>
      </dl>
      <button className="button button-secondary button-full" type="button" disabled>
        <LockKeyIcon size={17} aria-hidden="true" />
        Buat saran
      </button>
      <p className="copilot-safety">Saran tidak akan pernah dikirim otomatis.</p>
    </section>
  );
}
