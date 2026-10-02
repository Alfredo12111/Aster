import { applyTheme } from "../themes";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  ModuleSnapshot,
  ModuleState,
} from "../../../../packages/core/modules";
export type Commit = (change: (state: ModuleState) => void) => Promise<void>;
type Store = {
  drafts: Map<string, unknown>;
  registerFlush(callback: () => Promise<unknown>): () => void;
  snapshot: ModuleSnapshot | null;
  commit: Commit;
  pending: number;
  error: string;
  reload(): Promise<void>;
  importPdf(): Promise<void>;
  flush(): Promise<void>;
};
const Context = createContext<Store | null>(null);
export const TabContext = createContext("");
export function useTabState<T>(
  name: string,
  initial: T,
): [T, (next: T | ((previous: T) => T)) => void] {
  const id = useContext(TabContext),
    { drafts } = useModules(),
    key = id + ":" + name;
  const [value, setValue] = useState<T>(() =>
    drafts.has(key) ? (drafts.get(key) as T) : initial,
  );
  const set = (next: T | ((previous: T) => T)) => {
    const previous = (drafts.has(key) ? drafts.get(key) : value) as T;
    const result =
      typeof next === "function" ? (next as (p: T) => T)(previous) : next;
    drafts.set(key, result);
    setValue(result);
  };
  return [value, set];
}
export function useModules() {
  const value = useContext(Context);
  if (!value) throw new Error("Module provider is missing.");
  return value;
}
export default function ModuleProvider({
  vaultId,
  children,
  onFlush,
  onSnapshot,
}: {
  vaultId: string;
  children: ReactNode;
  onFlush?(flush: () => Promise<void>): void;
  onSnapshot?(snapshot: ModuleSnapshot | null): void;
}) {
  const [snapshot, setSnapshot] = useState<ModuleSnapshot | null>(null),
    [pending, setPending] = useState(0),
    [error, setError] = useState("");
  useEffect(() => {
    onSnapshot?.(snapshot);
  }, [snapshot, onSnapshot]);
  const latest = useRef<ModuleSnapshot | null>(null),
    queue = useRef<Promise<unknown>>(Promise.resolve()),
    count = useRef(0),
    generation = useRef(0),
    alive = useRef(true);
  const drafts = useRef(new Map<string, unknown>()).current;
  const flushers = useRef(new Set<() => Promise<unknown>>()).current;
  const registerFlush = useCallback((callback: () => Promise<unknown>) => {
    flushers.add(callback);
    return () => {
      flushers.delete(callback);
    };
  }, []);
  const apply = useCallback(
    (result: ModuleSnapshot) => {
      if (result.vaultId === vaultId) {
        latest.current = result;
        if (alive.current) setSnapshot(result);
      }
    },
    [vaultId],
  );
  const reload = useCallback(async () => {
    if (!vaultId) return;
    const token = ++generation.current;
    try {
      const result = await window.aster.loadModules();
      if (token === generation.current && !count.current && alive.current) {
        apply(result);
        setError("");
      }
    } catch (e) {
      if (alive.current) setError(String(e));
    }
  }, [vaultId, apply]);
  useEffect(() => {
    alive.current = true;
    void reload();
    if (!window.aster) return;
    const changed = () => {
      if (!count.current) void reload();
    };
    const off = window.aster.onVaultChanged(changed),
      offModules = window.aster.onModulesChanged(changed);
    return () => {
      alive.current = false;
      off();
      offModules();
    };
  }, [reload]);
  const flush = useCallback(async () => {
    for (const callback of flushers) await callback();
    await queue.current;
  }, []);
  useEffect(() => {
    onFlush?.(flush);
  }, [flush, onFlush]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (
        count.current ||
        [...drafts].some(
          ([key, value]) => key.endsWith(":chart-draft") && value,
        )
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => {
      void queue.current.finally(() =>
        window.removeEventListener("beforeunload", guard),
      );
    };
  }, []);
  useEffect(() => {
    if (snapshot) applyTheme(snapshot.state.workspace.theme);
  }, [snapshot?.state.workspace.theme]);
  const commit: Commit = useCallback(
    (change) => {
      generation.current++;
      count.current++;
      setPending(count.current);
      const op = queue.current.then(async () => {
        const current = latest.current;
        if (!current) throw new Error("Module data is not loaded.");
        const state = structuredClone(current.state);
        change(state);
        apply(
          await window.aster.saveModules({
            vaultId,
            revision: current.revision,
            state,
          }),
        );
        if (alive.current) setError("");
      });
      queue.current = op.catch(() => {});
      return op
        .catch((e) => {
          if (alive.current)
            setError(
              String(e).replace(
                /^Error: Error invoking remote method '[^']+': Error: /,
                "",
              ),
            );
          throw e;
        })
        .finally(() => {
          count.current--;
          if (alive.current) setPending(count.current);
        });
    },
    [vaultId, apply],
  );
  const importPdf = useCallback(async () => {
    generation.current++;
    count.current++;
    setPending(count.current);
    const op = queue.current.then(async () => {
      const result = await window.aster.importPdf();
      if (result) apply(result);
    });
    queue.current = op.catch(() => {});
    try {
      await op;
    } catch (e) {
      if (alive.current) setError(String(e));
      throw e;
    } finally {
      count.current--;
      if (alive.current) setPending(count.current);
    }
  }, [apply]);
  return (
    <Context.Provider
      value={{
        snapshot,
        commit,
        pending,
        error,
        reload,
        importPdf,
        flush,
        drafts,
        registerFlush,
      }}
    >
      {children}
    </Context.Provider>
  );
}
