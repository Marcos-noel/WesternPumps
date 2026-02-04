import axios from "axios";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatLoc(loc: unknown): string | null {
  if (!Array.isArray(loc)) return null;
  const parts = loc
    .filter((p) => typeof p === "string" || typeof p === "number")
    .map(String);
  if (parts.length === 0) return null;
  const prefix = parts[0];
  if (prefix === "body" || prefix === "query" || prefix === "path") return parts.slice(1).join(".");
  return parts.join(".");
}

function extractFastApiDetail(detail: unknown): string | null {
  if (typeof detail === "string") return detail;
  if (!Array.isArray(detail)) return null;

  const parts = detail
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (!isRecord(entry)) return null;
      const msg = typeof entry.msg === "string" ? entry.msg : null;
      const loc = formatLoc(entry.loc);
      if (!msg) return null;
      if (!loc) return msg;
      return `${loc}: ${msg}`;
    })
    .filter((v): v is string => Boolean(v));

  if (parts.length === 0) return null;
  return parts.join("; ");
}

function extractDetail(data: unknown): string | null {
  if (!data) return null;
  if (typeof data === "string") return data;
  if (!isRecord(data)) return null;

  const detail = data.detail;
  const fastApi = extractFastApiDetail(detail);
  if (fastApi) return fastApi;

  if (typeof detail === "string") return detail;
  return null;
}

export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = extractDetail(err.response?.data);
    if (detail) return detail;
    if (typeof err.message === "string" && err.message.trim()) return err.message;
  }

  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}

