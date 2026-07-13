/** Format an ISO timestamp as a short human-readable relative age, e.g. "12s ago". */
export function formatAge(observedAt: string, now: number = Date.now()): string {
  const then = new Date(observedAt).getTime();
  if (Number.isNaN(then)) return "unknown";

  const diffMs = now - then;
  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
