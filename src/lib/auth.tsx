"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken, type User } from "./api";

type AuthState = {
  user: User | null;
  ready: boolean;
  demo: boolean;
  signIn: (token: string, user: User) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [demo, setDemo] = useState(false);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      return;
    }
    try {
      const res = await api<{ data: User }>("/me");
      setUser(res.data);
    } catch {
      // Token kedaluwarsa atau dicabut: anggap keluar.
      setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      try {
        const res = await api<{ demo: boolean }>("/demo");
        setDemo(res.demo);
      } catch {
        setDemo(false);
      }
      setReady(true);
    })();
  }, [refresh]);

  const signIn = useCallback((token: string, next: User) => {
    setToken(token);
    setUser(next);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* token sudah tidak berlaku: tidak apa-apa */
    }
    setToken(null);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, ready, demo, signIn, signOut, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return ctx;
}
