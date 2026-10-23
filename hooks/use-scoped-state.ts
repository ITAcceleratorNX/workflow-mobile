import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * Local state belonging to one form/query identity. Reset before children render,
 * and ignore updates from callbacks that belong to an older identity.
 * Pass a stable primitive key (or a memoized object), not an inline object.
 */
export function useScopedState<T>(key: unknown, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [stored, setStored] = useState(() => ({ key, identity: {}, value: resolveInitial(initial) }));
  let current = stored;
  if (!Object.is(stored.key, key)) {
    current = { key, identity: {}, value: resolveInitial(initial) };
    setStored(current);
  }
  const identity = current.identity;
  const setValue = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    setStored((previous) => {
      if (previous.identity !== identity) return previous;
      const value = typeof action === 'function'
        ? (action as (value: T) => T)(previous.value)
        : action;
      return Object.is(value, previous.value) ? previous : { ...previous, value };
    });
  }, [identity]);
  return [current.value, setValue];
}

function resolveInitial<T>(initial: T | (() => T)): T {
  return typeof initial === 'function' ? (initial as () => T)() : initial;
}
