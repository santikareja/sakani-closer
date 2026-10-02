import { BooksIcon } from "@phosphor-icons/react/dist/ssr/Books";
import { CloudArrowUpIcon } from "@phosphor-icons/react/dist/ssr/CloudArrowUp";
import { DatabaseIcon } from "@phosphor-icons/react/dist/ssr/Database";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";

import { EmptyState } from "../../../components/ui/states";
import { PageHeader } from "../../../components/ui/page-header";
import { StatusBadge } from "../../../components/ui/status-badge";
import { requireSession } from "../../../lib/auth/dal";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  await requireSession("/dashboard/knowledge");
  return (
    <div className="page-stack">
      <PageHeader
        title="Knowledge"
        description="Kelola sumber, indexing, dan kesiapan retrieval tanpa mengklaim data yang belum diproses."
        meta={<StatusBadge tone="neutral">Belum tersedia</StatusBadge>}
        actions={
          <button className="button button-primary" type="button" disabled>
            <CloudArrowUpIcon size={18} aria-hidden="true" />
            Tambah sumber
          </button>
        }
      />

      <section className="knowledge-status-grid" aria-label="Status knowledge">
        <article>
          <BooksIcon size={21} aria-hidden="true" />
          <span>Sumber</span>
          <strong>-</strong>
          <small>Belum tersedia</small>
        </article>
        <article>
          <DatabaseIcon size={21} aria-hidden="true" />
          <span>Potongan</span>
          <strong>-</strong>
          <small>Belum tersedia</small>
        </article>
        <article>
          <MagnifyingGlassIcon size={21} aria-hidden="true" />
          <span>Retrieval</span>
          <strong>-</strong>
          <small>Belum tersedia</small>
        </article>
      </section>

      <section className="content-surface knowledge-sources">
        <div className="section-heading-row">
          <div>
            <h2>Sumber knowledge</h2>
            <p>Status indexing hanya akan muncul dari event backend real.</p>
          </div>
          <button className="button button-secondary" type="button" disabled>
            Impor URL
          </button>
        </div>
        <EmptyState
          title="Belum ada sumber"
          description="Upload dan import dinonaktifkan sampai storage, sanitasi, indexing, dan approval tersedia."
        />
      </section>
    </div>
  );
}
