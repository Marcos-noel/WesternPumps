import { api } from "./client";

export async function downloadReport(path: string, params?: Record<string, unknown>): Promise<Blob> {
  return (
    await api.get(path, {
      params,
      responseType: "blob"
    })
  ).data;
}
