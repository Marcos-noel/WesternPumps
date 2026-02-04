import { api } from "./client";
import type { Category } from "./types";

export async function listCategories(params?: { include_inactive?: boolean }): Promise<Category[]> {
  return (await api.get<Category[]>("/api/categories", { params })).data;
}

export async function createCategory(payload: { name: string; parent_id?: number | null }): Promise<Category> {
  return (await api.post<Category>("/api/categories", payload)).data;
}

export async function updateCategory(
  categoryId: number,
  payload: { name?: string; parent_id?: number | null; is_active?: boolean }
): Promise<Category> {
  return (await api.patch<Category>(`/api/categories/${categoryId}`, payload)).data;
}

