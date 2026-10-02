import { LoadingSkeleton } from "../../../components/ui/states";

export default function InboxLoading() {
  return (
    <div className="page-stack" aria-busy="true" aria-label="Memuat inbox">
      <div className="page-header page-header-loading">
        <div className="page-header-copy">
          <LoadingSkeleton className="skeleton-title" />
          <LoadingSkeleton className="skeleton-copy" />
        </div>
      </div>
      <div className="inbox-workspace inbox-loading-shell">
        <aside className="inbox-list-pane">
          <div className="inbox-list-toolbar">
            <LoadingSkeleton className="skeleton-label" />
            <LoadingSkeleton className="skeleton-input" />
          </div>
          <div className="conversation-scroll">
            {Array.from({ length: 6 }, (_, index) => (
              <div className="conversation-row" key={index}>
                <LoadingSkeleton className="skeleton-avatar" />
                <div className="conversation-row-body">
                  <LoadingSkeleton className="skeleton-label" />
                  <LoadingSkeleton className="skeleton-copy" />
                </div>
              </div>
            ))}
          </div>
        </aside>
        <section className="message-pane message-pane-loading">
          <LoadingSkeleton className="skeleton-message skeleton-message-left" />
          <LoadingSkeleton className="skeleton-message skeleton-message-right" />
          <LoadingSkeleton className="skeleton-message skeleton-message-left" />
        </section>
        <aside className="contact-detail-pane">
          <LoadingSkeleton className="skeleton-avatar-large" />
          <LoadingSkeleton className="skeleton-label" />
          <LoadingSkeleton className="skeleton-panel-small" />
        </aside>
      </div>
    </div>
  );
}
