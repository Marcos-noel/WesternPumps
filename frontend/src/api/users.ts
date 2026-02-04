import { api } from "./client";
import type { User, UserRole } from "./types";

export type CreateUserPayload = {
  email: string;
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

export async function createUser(payload: CreateUserPayload): Promise<User> {
  return (await api.post<User>("/users", payload)).data;
}

