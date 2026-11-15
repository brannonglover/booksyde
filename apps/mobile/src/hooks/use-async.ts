import { type DependencyList, useCallback, useEffect, useState } from 'react';

/**
 * Run `load` whenever `deps` change and hold its result. `reload()` runs it
 * again but keeps showing the last result until the new one arrives, so a
 * refresh after an edit doesn't flash a spinner. Pass `null` to skip loading.
 */
export function useAsync<T>(load: (() => Promise<T>) | null, deps: DependencyList) {
  const base = JSON.stringify(deps);
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{ base: string; version: number; data?: T; error?: true } | null>(null);
  const enabled = load !== null;

  useEffect(() => {
    if (!load) return;
    let live = true;
    load()
      .then((data) => live && setResult({ base, version, data }))
      .catch(() => live && setResult({ base, version, error: true }));
    return () => {
      live = false;
    };
    // `load` is a fresh closure each render; `deps` say when it really changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, version, enabled]);

  const same = result?.base === base ? result : null;
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return {
    data: same?.data,
    error: Boolean(same?.error),
    loading: enabled && (!same || same.version !== version),
    reload,
  };
}
