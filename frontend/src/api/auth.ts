import { api } from "./client";
import type { Token } from "./types";

export async function login(email: string, password: string): Promise<Token> {
  const body = new URLSearchParams();
  body.set("username", email);
  body.set("password", password);
  return (
    await api.post<Token>("/auth/login", body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    })
  ).data;
}

export async function bootstrapAdmin(email: string, password: string, fullName?: string): Promise<void> {
  await api.post("/auth/bootstrap", {
    email,
    password,
    full_name: fullName ?? null,
    role: "admin"
  });
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post("/auth/forgot-password", { email });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await api.post("/auth/reset-password", { token, new_password: newPassword });
}
