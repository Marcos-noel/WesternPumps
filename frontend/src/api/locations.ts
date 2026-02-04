import { api } from "./client";
import type { Location } from "./types";

export async function listLocations(params?: { include_inactive?: boolean }): Promise<Location[]> {
  return (await api.get<Location[]>("/api/locations", { params })).data;
}

export async function createLocation(payload: { name: string; description?: string | null }): Promise<Location> {
  return (await api.post<Location>("/api/locations", payload)).data;
}

export async function updateLocation(
  locationId: number,
  payload: { name?: string; description?: string | null; is_active?: boolean }
): Promise<Location> {
  return (await api.patch<Location>(`/api/locations/${locationId}`, payload)).data;
}

