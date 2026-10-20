import { useEffect, useState } from "react";
import type { PublicUser } from "@glucoplate/types";
import { api } from "@/lib/api-client";

/**
 * The signed-in user, loaded from the API.
 *
 * The mobile app keeps the access token in the device's secure storage, so
 * every screen that needs the user's limits calls this hook.
 */
export function useCurrentUser() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const result = await api.auth.me();
        if (!cancelled) setUser(result.user);
      } catch {
        // Not signed in, or the token expired.
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, loading };
}
