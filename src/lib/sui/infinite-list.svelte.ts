import type { SuiPageRequest, SuiSource } from './pagination.js';

export type SuiInfiniteListOptions<T> = {
	/** Page size passed to every request. Default `25`. */
	pageSize?: number;
	/**
	 * Extracts the stable identity of an item, used to de-duplicate pages
	 * (a row can appear on two pages when data changes between requests —
	 * a known weakness of offset pagination, which we mitigate client-side).
	 */
	itemKey?: (item: T) => string | number | undefined;
	/**
	 * Whether duplicate keys are dropped when appending. Default `true`
	 * (when an `itemKey` can be resolved).
	 */
	dedupe?: boolean;
};

/**
 * Reactive state machine that drives infinite scrolling for any component.
 *
 * Features:
 * - initial `loading` vs incremental `loadingMore` states
 * - cursor AND offset pagination (auto-detected from the page result)
 * - request superseding: stale responses are discarded (`requestId` guard)
 * - `AbortSignal` plumbing so the endpoint can cancel superseded requests
 * - optional dedupe by item key
 * - `search()` resets the list and re-fetches with a new query
 *
 * The store is intentionally UI-free so it can be unit-tested headlessly
 * and reused across SuiSelect / SuiCombobox / SuiMultiSelect.
 */
export class SuiInfiniteList<T> {
	items: T[] = $state([]);
	/** True while the first page is loading. */
	loading = $state(false);
	/** True while an additional page is loading. */
	loadingMore = $state(false);
	/** False once the last page arrived (or an error occurred). */
	hasMore = $state(true);
	/** Total count when the source provides one (offset mode). */
	total = $state<number | undefined>(undefined);
	/** Last error message, if a request failed. */
	error = $state<string | null>(null);

	readonly pageSize: number;

	/** The page loader. Swappable at runtime. */
	source: SuiSource<T>;
	#itemKey?: (item: T) => string | number | undefined;
	#dedupe: boolean;
	#seen = new Set<string | number>();
	#page = 0;
	#cursor: string | null = null;
	#mode: 'unknown' | 'cursor' | 'offset' = 'unknown';
	#requestId = 0;
	#abort: AbortController | null = null;
	#query = '';

	constructor(source: SuiSource<T>, options: SuiInfiniteListOptions<T> = {}) {
		this.source = source;
		this.pageSize = options.pageSize ?? 25;
		this.#itemKey = options.itemKey;
		this.#dedupe = options.dedupe ?? true;
	}

	/** The query used for the currently loaded items. */
	get query(): string {
		return this.#query;
	}

	#keyOf(item: T): string | number | undefined {
		return this.#itemKey?.(item);
	}

	#append(items: T[]) {
		if (!this.#dedupe || this.#itemKey === undefined) {
			this.items = [...this.items, ...items];
			return;
		}
		const fresh: T[] = [];
		for (const item of items) {
			const key = this.#keyOf(item);
			if (key === undefined || key === null) {
				fresh.push(item);
				continue;
			}
			if (this.#seen.has(key)) continue;
			this.#seen.add(key);
			fresh.push(item);
		}
		if (fresh.length > 0) this.items = [...this.items, ...fresh];
	}

	/**
	 * Loads the next page. Safe to call repeatedly — concurrent calls
	 * are ignored while a request is in flight and after the last page.
	 */
	async loadMore(): Promise<void> {
		if (!this.hasMore || this.loading || this.loadingMore) return;
		const requestId = ++this.#requestId;
		const isFirst = this.#page === 0 && this.#cursor === null;
		if (isFirst) this.loading = true;
		else this.loadingMore = true;
		this.error = null;

		this.#abort?.abort();
		const abort = new AbortController();
		this.#abort = abort;

		const request: SuiPageRequest = {
			size: this.pageSize,
			page: this.#page,
			cursor: this.#cursor,
			query: this.#query,
			signal: abort.signal
		};

		try {
			const result = await this.source(request);
			if (requestId !== this.#requestId) return; // superseded
			this.#append(result.items);
			this.total = result.total;
			if (result.nextCursor !== undefined) {
				this.#mode = 'cursor';
				this.#cursor = result.nextCursor;
				this.hasMore = result.hasMore;
			} else {
				this.#mode = 'offset';
				this.#page += 1;
				this.hasMore = result.hasMore;
			}
		} catch (err) {
			if (requestId !== this.#requestId) return;
			if (abort.signal.aborted) return;
			this.error = err instanceof Error ? err.message : 'Failed to load';
		} finally {
			if (requestId === this.#requestId) {
				this.loading = false;
				this.loadingMore = false;
			}
		}
	}

	/**
	 * Resets the list and loads the first page for `query`.
	 * Empty/blank queries are normalized to `''`.
	 */
	async search(query: string): Promise<void> {
		const next = query.trim();
		if (next === this.#query && this.items.length > 0) return;
		this.reset({ query: next });
		await this.loadMore();
	}

	/** Clears all state. The next `loadMore()` starts from page 0. */
	reset(options: { query?: string } = {}): void {
		this.#requestId += 1;
		this.#abort?.abort();
		this.#abort = null;
		this.items = [];
		this.#seen.clear();
		this.#page = 0;
		this.#cursor = null;
		this.#mode = 'unknown';
		this.loading = false;
		this.loadingMore = false;
		this.hasMore = true;
		this.error = null;
		this.total = undefined;
		if (options.query !== undefined) this.#query = options.query.trim();
	}
}
