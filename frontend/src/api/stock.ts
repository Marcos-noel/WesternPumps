import { api } from "./client";
import type { StockTransaction, StockTransactionType } from "./types";

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

