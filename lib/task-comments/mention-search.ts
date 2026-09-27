import type { TaskCommentsApi } from './api';
import type { TaskCommentFailure } from './errors';
import type { MentionCandidate } from './types';

/** Искать после паузы в наборе, а не на каждую букву. */
const DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;
/** Длиннее сервер не ищет: такого имени у участника нет. */
const MAX_QUERY_CODE_POINTS = 100;

export interface MentionSearchState {
  /** Запрос, для которого показаны или ищутся кандидаты. */
  query: string;
  items: MentionCandidate[];
  hasMore: boolean;
  loading: boolean;
  failure: TaskCommentFailure | null;
}

export interface Timers {
  set(run: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

const realTimers: Timers = {
  set: (run, ms) => setTimeout(run, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface MentionSearch {
  getState(): MentionSearchState;
  subscribe(listener: () => void): () => void;
  /** Искать `query` после паузы в наборе. Прежний поиск отменяется, его ответ не применяется. */
  search(query: string): void;
  loadMore(): void;
  /** Список закрыт: отменить ожидание и запрос, забыть найденное. Поиск можно начать заново. */
  reset(): void;
}

/**
 * Поиск кандидатов для @ в одной задаче. Кандидаты — только те, кого предлагает сервер: текущие
 * участники задачи, кроме самого пишущего.
 */
export function createMentionSearch({
  api,
  taskId,
  debounceMs = DEBOUNCE_MS,
  pageSize = PAGE_SIZE,
  timers = realTimers,
}: {
  api: Pick<TaskCommentsApi, 'searchMentionCandidates'>;
  taskId: number;
  debounceMs?: number;
  pageSize?: number;
  timers?: Timers;
}): MentionSearch {
  const initial: MentionSearchState = { query: '', items: [], hasMore: false, loading: false, failure: null };
  let state = initial;
  /** Запрос, чьи кандидаты показаны или ищутся; null — поиска ещё не было. */
  let searched: string | null = null;
  let cursor: string | null = null;
  let timer: unknown = null;
  let controller: AbortController | null = null;
  /** Номер последнего запроса: ответы более ранних не применяются. */
  let latest = 0;
  const listeners = new Set<() => void>();

  function set(next: Partial<MentionSearchState>): void {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
  }

  function stop(): void {
    if (timer !== null) timers.clear(timer);
    timer = null;
    controller?.abort();
    controller = null;
    latest += 1;
  }

  function run(query: string, after: string | null): void {
    const request = ++latest;
    controller = new AbortController();
    void api.searchMentionCandidates(taskId, { q: query, limit: pageSize, cursor: after }, controller.signal).then((result) => {
      if (request !== latest) return;
      controller = null;
      if (!result.ok) {
        set({ loading: false, failure: result.failure });
        return;
      }
      const page = result.value;
      cursor = page.has_more ? page.next_cursor : null;
      // Между страницами состав мог измениться: один человек — один раз.
      const shown = new Set(after === null ? [] : state.items.map((item) => item.id));
      const added = page.items.filter((item) => !shown.has(item.id));
      set({
        items: after === null ? added : [...state.items, ...added],
        hasMore: cursor !== null,
        loading: false,
        failure: null,
      });
    });
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    search(input) {
      const query = input.trim();
      if (query === searched && !state.failure) return;
      stop();
      searched = query;
      cursor = null;
      if ([...query].length > MAX_QUERY_CODE_POINTS) {
        set({ query, items: [], hasMore: false, loading: false, failure: null });
        return;
      }
      // Прежние кандидаты видны, пока ищутся новые: список не мигает на каждой букве.
      set({ query, loading: true, failure: null });
      timer = timers.set(() => {
        timer = null;
        run(query, null);
      }, debounceMs);
    },

    loadMore() {
      if (state.loading || cursor === null) return;
      set({ loading: true, failure: null });
      run(state.query, cursor);
    },

    reset() {
      stop();
      searched = null;
      cursor = null;
      if (state !== initial) set(initial);
    },
  };
}
