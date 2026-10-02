import { FileTextIcon } from "@phosphor-icons/react/dist/ssr/FileText";
import { ImageIcon } from "@phosphor-icons/react/dist/ssr/Image";
import { SortAscendingIcon } from "@phosphor-icons/react/dist/ssr/SortAscending";
import Link from "next/link";

import type { InboxConversationView } from "../../types/inbox";
import { EmptyState } from "../ui/states";
import { FilterBar } from "../ui/filter-bar";
import { SearchInput } from "../ui/search-input";

function conversationHref(id: string, query: string): string {
  const params = new URLSearchParams({ conversation: id });
  if (query) params.set("q", query);
  return `/dashboard/inbox?${params.toString()}`;
}

export function ConversationRow({
  conversation,
  active,
  query,
}: {
  conversation: InboxConversationView;
  active: boolean;
  query: string;
}) {
  return (
    <Link
      className={`conversation-row${active ? " conversation-row-active" : ""}`}
      href={conversationHref(conversation.id, query)}
      aria-current={active ? "true" : undefined}
    >
      <span className="contact-avatar" aria-hidden="true">
        {conversation.contactName.slice(0, 1).toUpperCase()}
      </span>
      <span className="conversation-row-body">
        <span className="conversation-row-topline">
          <strong>{conversation.contactName}</strong>
          <time dateTime={conversation.lastMessageAt}>{conversation.lastMessageRelative}</time>
        </span>
        <span className="conversation-row-preview">
          {conversation.lastMessageType === "image" ? (
            <ImageIcon size={15} aria-hidden="true" />
          ) : conversation.lastMessageType === "document" ? (
            <FileTextIcon size={15} aria-hidden="true" />
          ) : null}
          <span>{conversation.lastMessagePreview}</span>
        </span>
        <span className="conversation-row-meta">
          <small>{conversation.identifierMasked ?? "Identitas disamarkan"}</small>
          {conversation.unreadCount ? (
            <span className="unread-count">{conversation.unreadCount}</span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}

export function ConversationList({
  conversations,
  selectedId,
  query,
  nextCursor,
}: {
  conversations: InboxConversationView[];
  selectedId: string | undefined;
  query: string;
  nextCursor: string | null;
}) {
  const nextParams = new URLSearchParams();
  if (nextCursor) nextParams.set("cursor", nextCursor);
  if (query) nextParams.set("q", query);

  return (
    <aside
      className={`inbox-list-pane${selectedId ? " inbox-list-pane-has-selection" : ""}`}
      aria-label="Daftar percakapan"
    >
      <div className="inbox-list-toolbar">
        <div className="inbox-pane-title">
          <div>
            <h2>Percakapan</h2>
            <p>{conversations.length} ditampilkan</p>
          </div>
        </div>
        <form action="/dashboard/inbox" method="get" className="inbox-search-form">
          <SearchInput
            defaultValue={query}
            label="Cari percakapan"
            placeholder="Cari nama atau pesan"
          />
          <button className="sr-only" type="submit">
            Cari
          </button>
        </form>
        <FilterBar>
          <span className="filter-tab filter-tab-active">Semua</span>
          <button type="button" disabled title="Status belum dibaca belum tersedia">
            Belum dibaca
          </button>
          <button type="button" disabled title="Assignment belum tersedia">
            Ditugaskan
          </button>
          <button type="button" disabled title="Penanda perhatian belum tersedia">
            Perlu perhatian
          </button>
        </FilterBar>
        <div className="sort-control" aria-label="Urutan percakapan">
          <SortAscendingIcon size={17} aria-hidden="true" />
          <span>Terbaru</span>
          <small>Urutan dari backend</small>
        </div>
      </div>

      <div className="conversation-scroll">
        {conversations.length === 0 ? (
          <EmptyState
            title={query ? "Percakapan tidak ditemukan" : "Belum ada percakapan"}
            description={
              query
                ? "Coba kata pencarian lain. Pencarian berlaku pada halaman yang sedang dimuat."
                : "Chat pribadi pertama akan muncul setelah diterima gateway."
            }
          />
        ) : (
          conversations.map((conversation) => (
            <ConversationRow
              active={selectedId === conversation.id}
              conversation={conversation}
              key={conversation.id}
              query={query}
            />
          ))
        )}
      </div>

      {nextCursor ? (
        <div className="inbox-list-footer">
          <Link
            className="button button-secondary button-full"
            href={`/dashboard/inbox?${nextParams}`}
          >
            Muat percakapan berikutnya
          </Link>
        </div>
      ) : null}
    </aside>
  );
}
