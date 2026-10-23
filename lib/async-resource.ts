export type ResourceSnapshot<T> = {
  data: T;
  loading: boolean;
  error: string | null;
};

/** One query's lifecycle. Old responses cannot publish after refresh or unsubscribe. */
export function createAsyncResource<T>(load: () => Promise<T>, initialData: T, enabled = true) {
  let snapshot: ResourceSnapshot<T> = { data: initialData, loading: enabled, error: null };
  const listeners = new Set<() => void>();
  let generation = 0;
  let started = false;
  const publish = (next: ResourceSnapshot<T>) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };
  const refresh = async () => {
    if (!enabled) return;
    const request = ++generation;
    publish({ ...snapshot, loading: true, error: null });
    try {
      const data = await load();
      if (request === generation) publish({ data, loading: false, error: null });
    } catch (error) {
      if (request === generation) {
        publish({ ...snapshot, loading: false, error: error instanceof Error ? error.message : 'Не удалось загрузить данные' });
      }
    }
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (!started && enabled) {
        started = true;
        void refresh();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          generation += 1;
          started = false;
        }
      };
    },
    refresh,
    setData(action: T | ((previous: T) => T)) {
      const data = typeof action === 'function' ? (action as (previous: T) => T)(snapshot.data) : action;
      publish({ ...snapshot, data });
    },
  };
}
