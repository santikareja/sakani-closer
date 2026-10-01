import Link from "next/link";
import { z } from "zod";

import { requireSession } from "../../../lib/auth/dal";
import { decodeInboxCursor } from "../../../lib/inbox/cursor";
import { DrizzleInboxRepository } from "../../../lib/inbox/repository";
import type { ConversationDetailDto } from "../../../lib/inbox/types";
import { getWhatsAppRouteDependencies } from "../../../lib/whatsapp/route-runtime";

export const dynamic = "force-dynamic";

const searchSchema = z.object({
  conversation: z.string().uuid().optional(),
  cursor: z
    .string()
    .max(512)
    .refine((value) => decodeInboxCursor(value) !== undefined)
    .optional(),
  messageCursor: z
    .string()
    .max(512)
    .refine((value) => decodeInboxCursor(value) !== undefined)
    .optional(),
});

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function connectionLabel(state: string): string {
  const labels: Record<string, string> = {
    connected: "Terhubung",
    connecting: "Menghubungkan",
    qr_ready: "Menunggu pemindaian QR",
    transient_error: "Mencoba menyambung ulang",
    logged_out: "Keluar",
    auth_error: "Session bermasalah",
    stopping: "Menghentikan layanan",
    disconnected: "Terputus",
  };
  return labels[state] ?? "Tidak diketahui";
}

function ConversationPanel({ conversation }: { conversation: ConversationDetailDto | null }) {
  if (!conversation) {
    return (
      <section className="inbox-detail inbox-empty" aria-label="Detail percakapan">
        <div>
          <p className="eyebrow">Receive-only</p>
          <h2>Pilih percakapan</h2>
          <p>Pesan masuk akan terlihat di sini. Pengiriman balasan belum tersedia.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="inbox-detail" aria-label={`Percakapan dengan ${conversation.contactName}`}>
      <header className="conversation-heading">
        <div>
          <p className="eyebrow">Percakapan langsung</p>
          <h2>{conversation.contactName}</h2>
          {conversation.phoneMasked ? <p>{conversation.phoneMasked}</p> : null}
        </div>
        <span className="inbox-status">{conversation.status}</span>
      </header>
      <div className="message-timeline">
        {[...conversation.messages].reverse().map((message) => (
          <article className="message-bubble" key={message.id}>
            <p className="message-kind">
              {message.messageType === "image"
                ? "Gambar"
                : message.messageType === "document"
                  ? "Dokumen"
                  : "Pesan teks"}
            </p>
            {message.text ? <p>{message.text}</p> : null}
            {message.media ? (
              <dl className="media-metadata">
                <div>
                  <dt>Tipe</dt>
                  <dd>{message.media.mimeType}</dd>
                </div>
                {message.media.fileName ? (
                  <div>
                    <dt>Nama file</dt>
                    <dd>{message.media.fileName}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Proses</dt>
                  <dd>Metadata saja</dd>
                </div>
              </dl>
            ) : null}
            <time dateTime={message.providerTimestamp}>
              {formatTime(message.providerTimestamp)}
            </time>
          </article>
        ))}
      </div>
      {conversation.nextCursor ? (
        <Link
          className="text-link inbox-pagination"
          href={`/dashboard/inbox?conversation=${conversation.id}&messageCursor=${encodeURIComponent(conversation.nextCursor)}`}
        >
          Muat pesan lebih lama
        </Link>
      ) : null}
      <p className="receive-only-note">Mode receive-only aktif. Tidak ada kontrol kirim pesan.</p>
    </section>
  );
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession("/dashboard/inbox");
  const rawSearch = await searchParams;
  const parsedSearch = searchSchema.safeParse({
    conversation: typeof rawSearch.conversation === "string" ? rawSearch.conversation : undefined,
    cursor: typeof rawSearch.cursor === "string" ? rawSearch.cursor : undefined,
    messageCursor:
      typeof rawSearch.messageCursor === "string" ? rawSearch.messageCursor : undefined,
  });
  const query = parsedSearch.success ? parsedSearch.data : {};
  const repository = new DrizzleInboxRepository();
  const workspace = { workspaceId: session.workspaceId };

  try {
    const [list, detail, gatewayStatus] = await Promise.all([
      repository.listConversations(workspace, { cursor: query.cursor }),
      query.conversation
        ? repository.getConversation(workspace, query.conversation, {
            cursor: query.messageCursor,
          })
        : Promise.resolve(null),
      getWhatsAppRouteDependencies()
        .gateway.getStatus()
        .catch(() => null),
    ]);
    await repository.recordInboxViewed(workspace, session.userId);

    return (
      <main className="dashboard-shell inbox-shell">
        <header className="inbox-page-header">
          <div>
            <Link className="text-link back-link" href="/dashboard">
              ← Kembali ke dashboard
            </Link>
            <p className="eyebrow">Inbox WhatsApp</p>
            <h1>Pesan masuk</h1>
            <p className="lead">Pantau chat pribadi tanpa mengirim balasan dari sistem.</p>
          </div>
          <div className="gateway-summary">
            <span
              className={`connection-indicator connection-${gatewayStatus?.connection.state}`}
            />
            <div>
              <small>Status koneksi</small>
              <strong>{connectionLabel(gatewayStatus?.connection.state ?? "unknown")}</strong>
            </div>
          </div>
        </header>

        <div className="inbox-layout">
          <aside className="conversation-list" aria-label="Daftar percakapan">
            <div className="conversation-list-heading">
              <h2>Percakapan</h2>
              <span>{list.conversations.length}</span>
            </div>
            {list.conversations.length === 0 ? (
              <div className="conversation-empty">
                <h3>Belum ada pesan</h3>
                <p>Chat pribadi pertama akan muncul setelah diterima gateway.</p>
              </div>
            ) : (
              <nav>
                {list.conversations.map((conversation) => (
                  <Link
                    className={`conversation-item ${query.conversation === conversation.id ? "conversation-item-active" : ""}`}
                    href={`/dashboard/inbox?conversation=${conversation.id}`}
                    key={conversation.id}
                  >
                    <span className="conversation-avatar" aria-hidden="true">
                      {conversation.contactName.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="conversation-copy">
                      <strong>{conversation.contactName}</strong>
                      <small>{conversation.lastMessagePreview}</small>
                    </span>
                    <time dateTime={conversation.lastMessageAt}>
                      {formatTime(conversation.lastMessageAt)}
                    </time>
                  </Link>
                ))}
              </nav>
            )}
            {list.nextCursor ? (
              <Link
                className="text-link inbox-pagination"
                href={`/dashboard/inbox?cursor=${encodeURIComponent(list.nextCursor)}`}
              >
                Percakapan berikutnya
              </Link>
            ) : null}
          </aside>
          <ConversationPanel conversation={detail} />
        </div>
      </main>
    );
  } catch {
    return (
      <main className="dashboard-shell inbox-shell">
        <Link className="text-link back-link" href="/dashboard">
          ← Kembali ke dashboard
        </Link>
        <section className="inbox-error" role="alert">
          <p className="eyebrow">Inbox tidak tersedia</p>
          <h1>Pesan belum dapat dimuat</h1>
          <p>Coba muat ulang halaman. Koneksi WhatsApp tidak akan mengirim balasan otomatis.</p>
        </section>
      </main>
    );
  }
}
