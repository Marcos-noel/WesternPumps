const kesFormatter = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 2
});

export function formatKes(value?: number | null, fallback = ""): string {
  if (value == null || Number.isNaN(value)) return fallback;
  return kesFormatter.format(value);
}
