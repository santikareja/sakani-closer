"use client";

import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { ImageIcon } from "@phosphor-icons/react/dist/csr/Image";
import { InfoIcon } from "@phosphor-icons/react/dist/csr/Info";
import { LockKeyIcon } from "@phosphor-icons/react/dist/csr/LockKey";
import Link from "next/link";
import { useEffect, useRef } from "react";

import type { InboxConversationDetailView, InboxMessageView } from "../../types/inbox";

function formatFileSize(value: number | null): string | null {
  if (value === null) return null;
  if (value < 1_024) return `${value} B`;
  if (value < 1_048_576) return `${Math.round(value / 1_024)} KB`;
  return `${(value / 1_048_576).toFixed(1)} MB`;
}

function MessageBubble({ message }: { message: InboxMessageView }) {
  const mediaLabel = message.messageType === "image" ? "Gambar" : "Dokumen";
  return (
    <article className={`message-bubble message-bubble-${message.direction}`}>
      {message.media ? (
        <div className="message-media">
          <span className="message-media-icon" aria-hidden="true">
            {message.messageType === "image" ? <ImageIcon size={19} /> : <FileTextIcon size={19} />}
          </span>
          <span>
            <strong>{message.media.fileName ?? mediaLabel}</strong>
            <small>
              {message.media.mimeType}
              {formatFileSize(message.media.fileSize)
                ? `, ${formatFileSize(message.media.fileSize)}`
                : ""}
            </small>
          </span>
          <span className="media-safe-label">Metadata saja</span>
        </div>
      ) : null}
      {message.text ? <p>{message.text}</p> : null}
      <footer>
        <span>{message.direction === "inbound" ? "Masuk" : "Keluar"}</span>
        <time dateTime={message.providerTimestamp}>{message.timeLabel}</time>
      </footer>
    </article>
  );
}

export function MessageTimeline({
  conversation,
  historyMode,
}: {
  conversation: InboxConversationDetailView;
  historyMode: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const previousMessageCount = useRef(conversation.messages.length);

  useEffect(() => {
    const surface = scrollRef.current;
    if (!surface) return;
    const hasNewMessages = conversation.messages.length > previousMessageCount.current;
    if (
      (!historyMode && previousMessageCount.current === conversation.messages.length) ||
      (hasNewMessages && nearBottom.current)
    ) {
      surface.scrollTop = surface.scrollHeight;
    }
    previousMessageCount.current = conversation.messages.length;
  }, [conversation.messages.length, historyMode]);

  const historyParams = new URLSearchParams({ conversation: conversation.id });
  if (conversation.nextCursor) historyParams.set("messageCursor", conversation.nextCursor);

  return (
    <section className="message-pane" aria-label={`Percakapan dengan ${conversation.contactName}`}>
      <header className="message-pane-header">
        <Link
          className="icon-button mobile-inbox-back"
          href="/dashboard/inbox"
          aria-label="Kembali ke daftar percakapan"
        >
          <ArrowLeftIcon size={20} aria-hidden="true" />
        </Link>
        <span className="contact-avatar" aria-hidden="true">
          {conversation.contactName.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h2>{conversation.contactName}</h2>
          <p>{conversation.identifierMasked ?? "Identitas disamarkan"}</p>
        </div>
        <span className="conversation-state">{conversation.status}</span>
      </header>

      <div
        className="message-scroll"
        ref={scrollRef}
        onScroll={(event) => {
          const target = event.currentTarget;
          nearBottom.current = target.scrollHeight - target.scrollTop - target.clientHeight < 96;
        }}
      >
        {conversation.nextCursor ? (
          <Link className="history-loader" href={`/dashboard/inbox?${historyParams}`}>
            Muat pesan sebelumnya
          </Link>
        ) : (
          <div className="history-unavailable">
            <InfoIcon size={17} aria-hidden="true" />
            <span>Sinkronisasi riwayat belum tersedia</span>
          </div>
        )}
        {conversation.messageGroups.map((group) => (
          <section className="message-day" key={group.dateKey} aria-label={group.dateLabel}>
            <div className="date-separator">
              <span>{group.dateLabel}</span>
            </div>
            <div className="message-group">
              {group.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="receive-only-composer" aria-label="Balasan belum tersedia">
        <LockKeyIcon size={19} aria-hidden="true" />
        <div>
          <strong>Mode receive-only</strong>
          <p>Balasan akan tersedia pada fase outbound yang disetujui.</p>
        </div>
      </footer>
    </section>
  );
}
