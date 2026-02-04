import { api } from "./client";
import type { Item, Paginated } from "./types";

export type ListItemsParams = {
  page?: number;
  page_size?: number;
  q?: string;
  sort?: "name" | "sku" | "quantity_on_hand" | "min_quantity" | "created_at" | "updated_at";
  direction?: "asc" | "desc";
};

export async function listItems(params: ListItemsParams): Promise<Paginated<Item>> {
  return (
    await api.get<Paginated<Item>>("/api/items", {
      params
    })
  ).data;
}

export type CreateItemPayload = {
  sku: string;
  name: string;
  description?: string | null;
  unit_price?: number | null;
  quantity_on_hand?: number;
  min_quantity?: number;
  supplier_id?: number | null;
};

export async function createItem(payload: CreateItemPayload): Promise<Item> {
  return (await api.post<Item>("/api/items", payload)).data;
}

export type UpdateItemPayload = {
  sku?: string;
  name?: string;
  description?: string | null;
  unit_price?: number | null;
  quantity_on_hand?: number;
  min_quantity?: number;
  supplier_id?: number | null;
};

export async function updateItem(itemId: number, payload: UpdateItemPayload): Promise<Item> {
  return (await api.put<Item>(`/api/items/${itemId}`, payload)).data;
}

export async function listLowStock(params?: { limit?: number; q?: string }): Promise<Item[]> {
  return (
    await api.get<Item[]>("/api/stock/low", {
      params
    })
  ).data;
}

