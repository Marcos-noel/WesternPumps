import { api } from "./client";
import type { User, UserPreferences, UserRole } from "./types";

export type CreateUserPayload = {
  email: string;
  phone?: string | null;
  password: string;
  full_name?: string | null;
  role?: UserRole;
};

export async function readMe(): Promise<User> {
  return (await api.get<User>("/users/me")).data;
}

export async function listUsers(): Promise<User[]> {
  return (await api.get<User[]>("/users")).data;
}

export async function listAssignableUsers(): Promise<User[]> {
  return (await api.get<User[]>("/users/assignable")).data;
}

export async function createUser(payload: CreateUserPayload): Promise<User> {
  return (await api.post<User>("/users", payload)).data;
}

export async function updateUser(
  userId: number,
  payload: { phone?: string | null; full_name?: string | null; role?: UserRole; is_active?: boolean }
): Promise<User> {
  return (await api.patch<User>(`/users/${userId}`, payload)).data;
}

export async function deactivateUser(userId: number): Promise<void> {
  await api.delete(`/users/${userId}`);
}

export async function reactivateUser(userId: number): Promise<void> {
  await api.post(`/users/${userId}/reactivate`);
}

export async function hardDeleteUser(userId: number): Promise<void> {
  await api.delete(`/users/${userId}/hard`);
}

export async function changeMyPassword(payload: { current_password: string; new_password: string }): Promise<void> {
  await api.post("/users/me/password", payload);
}

export async function adminResetUserPassword(userId: number, newPassword: string): Promise<void> {
  await api.post(`/users/${userId}/password`, { new_password: newPassword });
}

export async function getMyPreferences(): Promise<UserPreferences> {
  return (await api.get<UserPreferences>("/users/me/preferences")).data;
}

export async function updateMyPreferences(
  payload: Partial<UserPreferences>
): Promise<UserPreferences> {
  return (await api.put<UserPreferences>("/users/me/preferences", payload)).data;
}
