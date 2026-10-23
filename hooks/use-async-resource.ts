import { useMemo, useSyncExternalStore } from 'react';

import { createAsyncResource } from '@/lib/async-resource';
import { useScopedState } from './use-scoped-state';

/** Memoize load with useCallback; changing it gives the query a fresh isolated lifecycle. */
export function useAsyncResource<T>(load: () => Promise<T>, initialData: T, enabled = true, scope?: unknown) {
  const identity = useMemo(() => ({ load, enabled, scope }), [load, enabled, scope]);
  const [resource] = useScopedState(identity, () => createAsyncResource(load, initialData, enabled));
  const snapshot = useSyncExternalStore(resource.subscribe, resource.getSnapshot, resource.getSnapshot);
  return { ...snapshot, refresh: resource.refresh, setData: resource.setData };
}
