import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  setData: (data: T | null) => void;
}

/**
 * Runs an async loader and tracks loading / error state.
 * `deps` controls when the loader re-runs.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []): AsyncResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    loaderRef
      .current()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load data.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  // AppShell dispatches this after any Supabase Realtime database change.
  // Existing loaders therefore stay current without each page polling.
  useEffect(() => {
    const refresh = () => setTick((current) => current + 1);
    window.addEventListener("iw:realtime", refresh);
    return () => window.removeEventListener("iw:realtime", refresh);
  }, []);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { data, loading, error, reload, setData };
}
