import { api } from "./client";
import type { StockRequest } from "./types";

export type CreateRequestPayload = {
  customer_id?: number | null;
  job_id?: number | null;
  lines: Array<{ part_id: number; quantity: number }>;
};

export async function createRequest(payload: CreateRequestPayload): Promise<StockRequest> {
  return (await api.post<StockRequest>("/api/requests", payload)).data;
}

export async function listRequests(params?: { status?: string; mine?: boolean }): Promise<StockRequest[]> {
  return (await api.get<StockRequest[]>("/api/requests", { params })).data;
}

export async function approveRequest(requestId: number): Promise<StockRequest> {
  return (await api.post<StockRequest>(`/api/requests/${requestId}/approve`)).data;
}

export async function rejectRequest(requestId: number, reason: string): Promise<StockRequest> {
  return (await api.post<StockRequest>(`/api/requests/${requestId}/reject`, { reason })).data;
}

export type IssueRequestPayload = {
  lines: Array<{ line_id: number; quantity: number; item_instance_ids?: number[] }>;
};

export async function issueRequest(requestId: number, payload: IssueRequestPayload): Promise<StockRequest> {
  return (await api.post<StockRequest>(`/api/requests/${requestId}/issue`, payload)).data;
}
