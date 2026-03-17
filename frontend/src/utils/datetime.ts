export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const raw = String(value).trim();
  // Keep local-time values stable when backend sends timezone-naive timestamps.
  const normalized = /[zZ]|[+\-]\d{2}:\d{2}$/.test(raw) ? raw : raw.replace(" ", "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return String(value);
  const date = d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}
