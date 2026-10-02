import { AddressBookIcon } from "@phosphor-icons/react/dist/ssr/AddressBook";
import { TagIcon } from "@phosphor-icons/react/dist/ssr/Tag";
import { UserCircleIcon } from "@phosphor-icons/react/dist/ssr/UserCircle";

import type { InboxConversationDetailView, InboxConversationView } from "../../types/inbox";
import { StatusBadge } from "../ui/status-badge";
import { CopilotPanel } from "./copilot-panel";

export function ContactPanel({
  conversation,
  summary,
}: {
  conversation: InboxConversationDetailView;
  summary: InboxConversationView | null;
}) {
  return (
    <aside className="contact-detail-pane" aria-label="Detail kontak dan percakapan">
      <section className="contact-summary">
        <span className="contact-detail-avatar" aria-hidden="true">
          {conversation.contactName.slice(0, 1).toUpperCase()}
        </span>
        <h2>{conversation.contactName}</h2>
        <p>{conversation.identifierMasked ?? "Identitas disamarkan"}</p>
        <StatusBadge tone={conversation.status === "open" ? "success" : "neutral"}>
          {conversation.status}
        </StatusBadge>
      </section>

      <section className="contact-details-section">
        <div className="details-section-heading">
          <AddressBookIcon size={19} aria-hidden="true" />
          <h3>Detail percakapan</h3>
        </div>
        <dl className="details-list">
          <div>
            <dt>Akun</dt>
            <dd>{summary?.accountLabel ?? "Label akun belum tersedia"}</dd>
          </div>
          <div>
            <dt>Status akun</dt>
            <dd>{summary?.accountStatus ?? "Tidak diketahui"}</dd>
          </div>
          <div>
            <dt>Jumlah percakapan</dt>
            <dd>Belum tersedia</dd>
          </div>
          <div>
            <dt>Terakhir aktif</dt>
            <dd>{summary?.lastMessageRelative ?? "Tidak diketahui"}</dd>
          </div>
        </dl>
      </section>

      <section className="contact-details-section">
        <div className="details-section-heading">
          <TagIcon size={19} aria-hidden="true" />
          <h3>Tags</h3>
        </div>
        <div className="unavailable-inline">
          <UserCircleIcon size={18} aria-hidden="true" />
          <span>Tags dan assignment belum tersedia.</span>
        </div>
      </section>

      <CopilotPanel />
    </aside>
  );
}
