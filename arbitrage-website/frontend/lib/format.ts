export function formatPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function formatPrice(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 1 ? 6 : 2,
  });
}

/** Tailwind classes for the net-profit-% cell, scaled by how strong the margin is. */
export function netProfitClasses(pct: number): string {
  if (pct >= 1) return "font-semibold text-emerald-700";
  if (pct > 0.2) return "font-medium text-emerald-600";
  if (pct > 0) return "text-slate-600";
  return "text-slate-400";
}

/** Tailwind classes for the confidence cell, scaled by score. */
export function confidenceClasses(confidence: number): string {
  if (confidence >= 0.8) return "font-medium text-emerald-700";
  if (confidence >= 0.5) return "text-amber-600";
  return "text-slate-400";
}
