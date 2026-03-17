import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { login as apiLogin } from "../api/auth";
import { readMe } from "../api/users";
import type { User } from "../api/types";

const disableAuth = import.meta.env.VITE_DISABLE_AUTH === "true";

type AuthContextValue = {
  isAuthenticated: boolean;
  token: string | null;
  user: User | null;
  isAdmin: boolean;
  loadingUser: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("access_token"));
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: disableAuth || Boolean(token),
      token,
      user,
      isAdmin: disableAuth ? true : user?.role === "admin",
      loadingUser: disableAuth ? false : loadingUser,
      login: async (email, password) => {
        if (disableAuth) return;
        const data = await apiLogin(email, password);
        localStorage.setItem("access_token", data.access_token);
        setToken(data.access_token);
        try {
          const me = await readMe();
          setUser(me);
        } catch {
          setUser(null);
        }
      },
      logout: () => {
        if (disableAuth) return;
        localStorage.removeItem("access_token");
        setToken(null);
        setUser(null);
      }
    }),
    [loadingUser, token, user]
  );

  useEffect(() => {
    if (disableAuth) {
      setUser(null);
      setLoadingUser(false);
      return;
    }
    if (!token) {
      setUser(null);
      return;
    }
    let active = true;
    setLoadingUser(true);
    readMe()
      .then((me) => {
        if (active) setUser(me);
      })
      .catch((err) => {
        if (!active) return;
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          localStorage.removeItem("access_token");
          setToken(null);
        }
        setUser(null);
      })
      .finally(() => {
        if (active) setLoadingUser(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
