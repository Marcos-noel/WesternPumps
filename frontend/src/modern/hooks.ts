import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchDashboardSummary, fetchProducts, fetchStockTrend, fetchSuppliers, receiveOrder } from "./api";
import type { ReceivingPayload } from "./types";
import type { Product } from "./types";

export function useDashboardSummary() {
  return useQuery({ queryKey: ["modern", "summary"], queryFn: fetchDashboardSummary });
}

export function useStockTrend(days: number) {
  return useQuery({ queryKey: ["modern", "trend", days], queryFn: () => fetchStockTrend(days) });
}

export function useProducts(params: {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  return useQuery({
    queryKey: ["modern", "products", params],
    queryFn: () => fetchProducts(params),
    placeholderData: (prev: { items: Product[]; total: number } | undefined) => prev
  });
}

export function useSuppliers() {
  return useQuery({ queryKey: ["modern", "suppliers"], queryFn: fetchSuppliers });
}

export function useReceiveOrderMutation() {
  return useMutation({ mutationFn: (payload: ReceivingPayload) => receiveOrder(payload) });
}
