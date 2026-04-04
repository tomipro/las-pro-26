export function fmt(value: unknown, digits = 2): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return value.toFixed(digits);
}

export function statusMeta(meta?: { source?: string; model?: string; reason?: string }): string {
  const source = meta?.source || "N/A";
  const detail = meta?.model || meta?.reason || "";
  return detail ? `Source: ${source} | ${detail}` : `Source: ${source}`;
}
