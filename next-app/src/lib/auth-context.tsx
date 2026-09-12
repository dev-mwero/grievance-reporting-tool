"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiPost, onAuthFailure } from "@/lib/api";
import type { AuthUser } from "@/types";

interface LoginResponse {
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  setUser: (user: AuthUser | null) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: AuthUser | null;
  children: ReactNode;
}) {
  const [user, setUserState] = useState<AuthUser | null>(initialUser);

  const setUser = useCallback((next: AuthUser | null) => {
    setUserState(next);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { user: signedIn } = await apiPost<LoginResponse>("/auth/login", {
      email,
      password,
    });
    setUserState(signedIn);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiPost("/auth/logout");
    } finally {
      setUserState(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      setUser,
      signIn,
      signOut,
    }),
    [user, setUser, signIn, signOut],
  );

  // Force sign-out when a 401 cannot be refreshed.
  useEffect(() => {
    return onAuthFailure(() => setUserState(null));
  }, []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
