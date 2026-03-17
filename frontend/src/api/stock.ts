import { api } from "./client";
import type { PendingReturn, ReturnSubmission, StockTransaction, StockTransactionType, StockTrendPoint, StockUsageSummary } from "./types";

export async function listStockTransactions(params?: { part_id?: number; limit?: number }): Promise<StockTransaction[]> {
  return (
    await api.get<StockTransaction[]>("/api/stock/transactions", {
      params
    })
  ).data;
}

export async function createStockTransaction(payload: {
  part_id: number;
  transaction_type: StockTransactionType;
  quantity_delta: number;
  supplier_id?: number | null;
  notes?: string | null;
}): Promise<StockTransaction> {
  return (await api.post<StockTransaction>("/api/stock/transactions", payload)).data;
}

export async function listUsageSummary(params?: { days?: number; limit?: number }): Promise<StockUsageSummary[]> {
  return (
    await api.get<StockUsageSummary[]>("/api/stock/usage", {
      params
    })
  ).data;
}

export async function listStockTrend(params?: { days?: number }): Promise<StockTrendPoint[]> {
  return (
    await api.get<StockTrendPoint[]>("/api/stock/trend", {
      params
    })
  ).data;
}

export async function listStockLifecycle(params?: { technician_id?: number; limit?: number }): Promise<StockTransaction[]> {
  return (
    await api.get<StockTransaction[]>("/api/stock/lifecycle", {
      params
    })
  ).data;
}

export async function returnStock(payload: {
  part_id?: number | null;
  item_instance_id?: number | null;
  quantity?: number;
  condition?: "GOOD" | "FAULTY";
  notes?: string | null;
  request_id?: number | null;
  technician_id?: number | null;
  return_proof_token?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<StockTransaction> {
  return (await api.post<StockTransaction>("/api/stock/return", payload)).data;
}

export async function listPendingReturns(): Promise<PendingReturn[]> {
  return (await api.get<PendingReturn[]>("/api/stock/returns/pending")).data;
}

export async function approvePendingReturn(
  pendingReturnId: number,
  payload?: { comment?: string | null }
): Promise<StockTransaction> {
  return (await api.post<StockTransaction>(`/api/stock/returns/${pendingReturnId}/approve`, payload ?? {})).data;
}

export async function rejectPendingReturn(
  pendingReturnId: number,
  payload: { reason: string }
): Promise<StockTransaction> {
  return (await api.post<StockTransaction>(`/api/stock/returns/${pendingReturnId}/reject`, payload)).data;
}

export async function listMyReturnSubmissions(params?: { limit?: number }): Promise<ReturnSubmission[]> {
  return (await api.get<ReturnSubmission[]>("/api/stock/returns/mine", { params })).data;
}
