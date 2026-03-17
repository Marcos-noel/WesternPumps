export function formatRequestRef(requestId: number | null | undefined): string {
  if (!requestId || requestId < 1) return "N/A";
  return `REQ-${requestId}`;
}
