import { useCallback, useEffect, useState } from "react";
import type { AdminUser } from "../types";
import { fetchAdminSession } from "../services/adminAuth";

export function useAdminSession() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const current = await fetchAdminSession();
      setUser(current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { user, loading, error, refresh };
}
