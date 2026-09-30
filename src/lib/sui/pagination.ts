/**
 * REST pagination primitives powering infinite scroll in
 * `SuiSelect`, `SuiCombobox` and `SuiMultiSelect`.
 *
 * # Choosing a pagination strategy (REST best practices)
 *
 * **Offset pagination** — `GET /items?page=0&size=20`
 * - Simple, stateless, lets users jump to arbitrary pages, and the total
 *   count is usually known.
 * - Weaknesses: rows inserted/deleted while paging shift the window
 *   (duplicates or skipped rows), and `OFFSET n` degrades on large tables
 *   because the database still scans the skipped rows.
 * - Use for: admin tables with moderate churn, small data sets, when the
 *   UI needs page numbers.
 *
 * **Cursor (keyset) pagination** — `GET /items?cursor=<opaque>&limit=20`
 * - The server returns an opaque token encoding the last row's sort key
 *   (e.g. base64 of `(createdAt, id)`); the next page uses
 *   `WHERE (created_at, id) < (cursor.created_at, cursor.id) ORDER BY …`
 *   which is index-backed and immune to row drift between pages.
 * - Weaknesses: no random access (only "next", sometimes "prev" via
 *   bi-directional cursors), the cursor must be treated as opaque, and the
 *   sort order must be stable across requests.
 * - Use for: infinite scrolling feeds, high-churn data, large data sets.
 *   **This is the recommended strategy for infinite scroll.**
 *
 * Either way, the response envelope should carry enough metadata for the
 * client to know whether more data exists. Recommended JSON envelope:
 *
 * ```json
 * {
 *   "items":  [ … ],
 *   "nextCursor": "b3BhcXVl…",   // cursor mode: null on the last page
 *   "hasMore": true,             // offset mode: page*size < total
 *   "total": 341                 // offset mode: optional total count
 * }
 * ```
 *
 * The `SuiInfiniteList` store consumes a normalized {@link SuiSource}, and
 * the `offsetSource` / `cursorSource` adapters below convert common REST
 * response shapes into it.
 */

/** The normalized page request passed to a {@link SuiSource}. */
export type SuiPageRequest = {
	/** Page size. */
	size: number;
	/** 0-based page index (offset mode). */
	page: number;
	/**
	 * Opaque cursor (cursor mode). `null` on the first page.
	 */
	cursor: string | null;
	/** Search query, when the source supports server-side filtering. */
	query: string;
	/** Aborted when a newer request supersedes this one. */
	signal: AbortSignal | undefined;
};

/** The normalized page result returned from a {@link SuiSource}. */
export type SuiPageResult<T> = {
	items: T[];
	/** Whether another page can be fetched. */
	hasMore: boolean;
	/**
	 * Cursor for the next page (cursor mode). Leave `undefined` in
	 * offset mode.
	 */
	nextCursor?: string | null;
	/** Optional total item count (offset mode), for counters. */
	total?: number;
};

/** A normalized, stateless page loader. */
export type SuiSource<T> = (request: SuiPageRequest) => Promise<SuiPageResult<T>>;

/** Shape returned by offset-style endpoints (e.g. Spring `Page<T>`). */
export type SuiOffsetPage<T> = {
	items: T[];
	/** Defaults to `items.length === size` when omitted. */
	hasMore?: boolean;
	total?: number;
};

/** Shape returned by cursor-style endpoints (e.g. Relay-style connections). */
export type SuiCursorPage<T> = {
	items: T[];
	/**
	 * Cursor for the next page; `null`/`undefined` on the last page.
	 * When omitted, `hasMore` defaults to `items.length === size`.
	 */
	nextCursor?: string | null;
	hasMore?: boolean;
};

/**
 * Adapts an offset-based REST endpoint.
 *
 * ```ts
 * const users: SuiSource<SuiItem> = offsetSource(async ({ page, size, query, signal }) => {
 *   const res = await fetch(`/api/users?page=${page}&size=${size}&q=${query}`, { signal });
 *   const body = await res.json();
 *   return { items: body.content, total: body.totalElements };
 * });
 * ```
 */
export function offsetSource<T>(
	load: (request: {
		page: number;
		size: number;
		query: string;
		signal: AbortSignal | undefined;
	}) => Promise<SuiOffsetPage<T>>
): SuiSource<T> {
	return async (request) => {
		const page = await load({
			page: request.page,
			size: request.size,
			query: request.query,
			signal: request.signal
		});
		return {
			items: page.items,
			hasMore: page.hasMore ?? page.items.length === request.size,
			total: page.total
		};
	};
}

/**
 * Adapts a cursor-based REST endpoint (recommended for infinite scroll).
 *
 * ```ts
 * const repos: SuiSource<SuiItem> = cursorSource(async ({ cursor, size, query, signal }) => {
 *   const params = new URLSearchParams({ ...(cursor && { cursor }), size: String(size), ...(query && { q: query }) });
 *   const res = await fetch(`/api/repos?${params}`, { signal });
 *   const body = await res.json();
 *   return { items: body.data, nextCursor: body.nextCursor };
 * });
 * ```
 */
export function cursorSource<T>(
	load: (request: {
		cursor: string | null;
		size: number;
		query: string;
		signal: AbortSignal | undefined;
	}) => Promise<SuiCursorPage<T>>
): SuiSource<T> {
	return async (request) => {
		const page = await load({
			cursor: request.cursor,
			size: request.size,
			query: request.query,
			signal: request.signal
		});
		const nextCursor = page.nextCursor ?? null;
		return {
			items: page.items,
			hasMore: page.hasMore ?? (page.items.length === request.size && nextCursor !== null),
			nextCursor
		};
	};
}
