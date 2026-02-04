import React, { createContext, useContext, useMemo, useState } from "react";
import { login as apiLogin } from "../api/auth";

type AuthContextValue = {
  isAuthenticated: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("access_token"));

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(token),
      token,
      login: async (email, password) => {
        const data = await apiLogin(email, password);
        localStorage.setItem("access_token", data.access_token);
        setToken(data.access_token);
      },
      logout: () => {
        localStorage.removeItem("access_token");
        setToken(null);
      }
    }),
    [token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

