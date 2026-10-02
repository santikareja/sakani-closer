import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { TagIcon } from "@phosphor-icons/react/dist/ssr/Tag";
import { UserCircleIcon } from "@phosphor-icons/react/dist/ssr/UserCircle";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";
import Link from "next/link";
import { z } from "zod";

import { DataList } from "../../../components/ui/data-list";
import { EmptyState, ErrorState } from "../../../components/ui/states";
import { FilterBar } from "../../../components/ui/filter-bar";
import { PageHeader } from "../../../components/ui/page-header";
import { SearchInput } from "../../../components/ui/search-input";
import { StatusBadge } from "../../../components/ui/status-badge";
import { requireSession } from "../../../lib/auth/dal";
import { createConversationView, filterConversationViews } from "../../../lib/inbox/adapter";
import { DrizzleInboxRepository } from "../../../lib/inbox/repository";

export const dynamic = "force-dynamic";

const searchSchema = z.object({
  q: z.string().trim().max(120).default(""),
  contact: z.string().uuid().optional(),
});

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession("/dashboard/contacts");
  const raw = await searchParams;
  const parsed = searchSchema.safeParse({
    q: typeof raw.q === "string" ? raw.q : "",
    contact: typeof raw.contact === "string" ? raw.contact : undefined,
  });
  const query = parsed.success ? parsed.data : searchSchema.parse({});
  const repository = new DrizzleInboxRepository();

  try {
    const list = await repository.listConversations(
      { workspaceId: session.workspaceId },
      { limit: 50 },
    );
    const views = list.conversations.map((conversation) => createConversationView(conversation));
    const contacts = filterConversationViews(views, query.q, "all");
    const selected = views.find((contact) => contact.id === query.contact) ?? null;

    return (
      <div className="page-stack">
        <PageHeader
          title="Contacts"
          description="Kontak yang berasal dari percakapan WhatsApp real di workspace ini."
          meta={<StatusBadge tone="info">Data inbox</StatusBadge>}
        />

        <section className="content-surface contacts-surface">
          <form className="contacts-toolbar" action="/dashboard/contacts" method="get">
            <SearchInput
              defaultValue={query.q}
              label="Cari kontak"
              placeholder="Cari nama atau nomor tersamarkan"
            />
            <FilterBar>
              <span className="filter-tab filter-tab-active">Semua</span>
              <button type="button" disabled title="Tags belum tersedia">
                Dengan tags
              </button>
            </FilterBar>
            <button className="button button-secondary" type="submit">
              Terapkan
            </button>
          </form>

          {contacts.length === 0 ? (
            <EmptyState
              title={query.q ? "Kontak tidak ditemukan" : "Belum ada kontak"}
              description={
                query.q
                  ? "Coba kata pencarian lain pada kontak yang sudah dimuat."
                  : "Kontak akan muncul setelah percakapan WhatsApp pertama diterima."
              }
            />
          ) : (
            <DataList
              caption="Daftar kontak WhatsApp"
              columns={[
                { key: "contact", label: "Kontak" },
                { key: "identifier", label: "Identifier" },
                { key: "conversations", label: "Percakapan" },
                { key: "activity", label: "Aktivitas terakhir" },
                { key: "tags", label: "Tags" },
                { key: "action", label: "" },
              ]}
              rows={contacts.map((contact) => ({
                key: contact.id,
                cells: {
                  contact: (
                    <span className="table-contact">
                      <span className="contact-avatar" aria-hidden="true">
                        {contact.contactName.slice(0, 1).toUpperCase()}
                      </span>
                      <strong>{contact.contactName}</strong>
                    </span>
                  ),
                  identifier: contact.identifierMasked ?? "Disamarkan",
                  conversations: "Belum tersedia",
                  activity: contact.lastMessageRelative,
                  tags: <span className="muted-cell">Belum tersedia</span>,
                  action: (
                    <Link
                      className="icon-button"
                      href={`/dashboard/contacts?contact=${contact.id}${query.q ? `&q=${encodeURIComponent(query.q)}` : ""}`}
                      aria-label={`Lihat detail ${contact.contactName}`}
                    >
                      <ArrowRightIcon size={18} aria-hidden="true" />
                    </Link>
                  ),
                },
              }))}
            />
          )}
        </section>

        {selected ? (
          <aside className="contact-drawer" aria-label={`Detail kontak ${selected.contactName}`}>
            <div className="contact-drawer-header">
              <div>
                <p>Detail kontak</p>
                <h2>{selected.contactName}</h2>
              </div>
              <Link
                className="icon-button"
                href="/dashboard/contacts"
                aria-label="Tutup detail kontak"
              >
                <XIcon size={20} aria-hidden="true" />
              </Link>
            </div>
            <div className="contact-drawer-profile">
              <span className="contact-detail-avatar" aria-hidden="true">
                {selected.contactName.slice(0, 1).toUpperCase()}
              </span>
              <strong>{selected.identifierMasked ?? "Identitas disamarkan"}</strong>
              <StatusBadge tone="success">{selected.status}</StatusBadge>
            </div>
            <dl className="details-list">
              <div>
                <dt>Jumlah percakapan</dt>
                <dd>Belum tersedia</dd>
              </div>
              <div>
                <dt>Aktivitas terakhir</dt>
                <dd>{selected.lastMessageRelative}</dd>
              </div>
              <div>
                <dt>Status akun</dt>
                <dd>{selected.accountStatus}</dd>
              </div>
            </dl>
            <div className="unavailable-inline">
              <TagIcon size={18} aria-hidden="true" />
              <span>Tags belum memiliki penyimpanan backend.</span>
            </div>
            <div className="unavailable-inline">
              <UserCircleIcon size={18} aria-hidden="true" />
              <span>Assignment belum tersedia.</span>
            </div>
            <Link
              className="button button-primary button-full"
              href={`/dashboard/inbox?conversation=${selected.id}`}
            >
              Buka percakapan
            </Link>
          </aside>
        ) : null}
      </div>
    );
  } catch {
    return (
      <div className="page-stack">
        <PageHeader title="Contacts" description="Kontak dari percakapan WhatsApp workspace." />
        <ErrorState
          description="Kontak belum dapat dimuat. Tidak ada perubahan data yang dilakukan."
          retryHref="/dashboard/contacts"
        />
      </div>
    );
  }
}
