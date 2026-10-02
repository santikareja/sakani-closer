export function TypingIndicator({ typing }: { typing: boolean }) {
  if (!typing) return null;
  return (
    <div className="typing-indicator" aria-label="Sedang mengetik" role="status">
      <span />
      <span />
      <span />
    </div>
  );
}
