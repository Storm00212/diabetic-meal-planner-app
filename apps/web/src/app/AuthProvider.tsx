import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PublicUser } from "@glucoplate/types";
import { api, clearToken, readToken, writeToken } from "./api";

type AuthState = {
  user: PublicUser | null;
  /** The standing "planning aid, not medical advice" notice. */
  notice: string;
  /** The clinician banner for high-risk personas. */
  banner: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: {
    name: string;
    email: string;
    password: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [notice, setNotice] = useState("");
  const [banner, setBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!readToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const result = await api.auth.me();
      setUser(result.user);
      setNotice(result.notice);
      setBanner(result.banner);
    } catch {
      // The token is missing, expired or rejected — drop it.
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api.auth.login({ email, password });
    writeToken(result.token);
    setUser(result.user);
    setNotice(result.notice);
    setBanner(result.banner);
  }, []);

  const signUp = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      const result = await api.auth.register(input);
      writeToken(result.token);
      setUser(result.user);
      setNotice(result.notice);
      setBanner(result.banner);
    },
    [],
  );

  const signOut = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      /* the token may already be gone */
    }
    clearToken();
    setUser(null);
    setBanner(null);
  }, []);

  const value = useMemo(
    () => ({ user, notice, banner, loading, signIn, signUp, signOut, refresh }),
    [user, notice, banner, loading, signIn, signUp, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** The signed-in user and the auth actions. */
export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }
  return context;
}
