import { describe, expect, it } from 'vitest';
import { cursorSource, offsetSource, type SuiPageRequest, type SuiSource } from '$lib/sui/pagination';
import { SuiInfiniteList } from '$lib/sui/infinite-list.svelte';

function pageRequest(overrides: Partial<SuiPageRequest> = {}): SuiPageRequest {
	return { size: 25, page: 0, cursor: null, query: '', signal: undefined, ...overrides };
}

describe('offsetSource', () => {
	it('infers hasMore from a full page when not provided', async () => {
		const source = offsetSource<number>(async () => ({ items: [1, 2, 3] }));
		const result = await source(pageRequest({ size: 3 }));
		expect(result.hasMore).toBe(true);
		expect(result.nextCursor).toBeUndefined();
	});

	it('full page with explicit hasMore=false respects the flag', async () => {
		const source = offsetSource<number>(async () => ({ items: [1, 2, 3], hasMore: false }));
		const result = await source(pageRequest({ size: 3 }));
		expect(result.hasMore).toBe(false);
	});

	it('carries the total through', async () => {
		const source = offsetSource<number>(async () => ({ items: [1], total: 41 }));
		const result = await source(pageRequest());
		expect(result.total).toBe(41);
	});

	it('passes page, size, query and signal to the loader', async () => {
		const seen: unknown[] = [];
		const source = offsetSource<number>(async (req) => {
			seen.push({ ...req });
			return { items: [] };
		});
		const controller = new AbortController();
		await source(pageRequest({ page: 2, size: 10, query: 'abc', signal: controller.signal }));
		expect(seen[0]).toMatchObject({ page: 2, size: 10, query: 'abc' });
	});
});

describe('cursorSource', () => {
	it('maps nextCursor to hasMore', async () => {
		const source = cursorSource<string>(async () => ({ items: ['a'], nextCursor: 'next' }));
		const result = await source(pageRequest());
		expect(result.hasMore).toBe(true);
		expect(result.nextCursor).toBe('next');
	});

	it('null nextCursor means the last page', async () => {
		const source = cursorSource<string>(async () => ({ items: ['a'], nextCursor: null }));
		const result = await source(pageRequest());
		expect(result.hasMore).toBe(false);
		expect(result.nextCursor).toBeNull();
	});

	it('falls back to items.length === size when no cursor given', async () => {
		const source = cursorSource<string>(async () => ({ items: ['a', 'b'] }));
		expect((await source(pageRequest({ size: 2 }))).hasMore).toBe(true); // full page
		expect((await source(pageRequest({ size: 5 }))).hasMore).toBe(false); // short page
	});

	it('forwards the cursor to the loader', async () => {
		let seenCursor: string | null | undefined;
		const source = cursorSource<string>(async ({ cursor }) => {
			seenCursor = cursor;
			return { items: [], nextCursor: null };
		});
		await source(pageRequest({ cursor: 'opaque-token' }));
		expect(seenCursor).toBe('opaque-token');
	});
});

describe('SuiInfiniteList', () => {
	function paged<T>(pages: T[][], delay = 0): SuiSource<T> {
		let call = 0;
		return async () => {
			const items = pages[Math.min(call, pages.length - 1)] ?? [];
			call += 1;
			if (delay) await new Promise((r) => setTimeout(r, delay));
			return { items, hasMore: call < pages.length };
		};
	}

	it('loads the first page with loading flag', async () => {
		const list = new SuiInfiniteList<number>(paged([[1, 2, 3], [4]]), { pageSize: 3 });
		const promise = list.loadMore();
		expect(list.loading).toBe(true);
		await promise;
		expect(list.loading).toBe(false);
		expect(list.items).toEqual([1, 2, 3]);
		expect(list.hasMore).toBe(true);
	});

	it('offset mode increments pages across loadMore calls', async () => {
		const requests: number[] = [];
		const source: SuiSource<string> = async (req) => {
			requests.push(req.page);
			return { items: [`p${req.page}`], hasMore: req.page < 2 };
		};
		const list = new SuiInfiniteList(source, { pageSize: 10 });
		await list.loadMore();
		await list.loadMore();
		await list.loadMore();
		expect(requests).toEqual([0, 1, 2]);
		expect(list.items).toEqual(['p0', 'p1', 'p2']);
		expect(list.hasMore).toBe(false);
	});

	it('cursor mode passes the returned cursor to the next request', async () => {
		const cursors: (string | null)[] = [];
		const source: SuiSource<string> = async (req) => {
			cursors.push(req.cursor);
			return { items: [`${req.cursor ?? 'root'}`], nextCursor: `c${cursors.length}`, hasMore: cursors.length < 3 };
		};
		const list = new SuiInfiniteList(source, { pageSize: 5 });
		await list.loadMore();
		await list.loadMore();
		await list.loadMore();
		expect(cursors).toEqual([null, 'c1', 'c2']);
	});

	it('stops when hasMore is false and ignores concurrent calls', async () => {
		let pending = 0;
		const source: SuiSource<number> = async () => {
			pending += 1;
			await new Promise((r) => setTimeout(r, 10));
			pending -= 1;
			return { items: [1], hasMore: false };
		};
		const list = new SuiInfiniteList(source, { pageSize: 1 });
		await Promise.all([list.loadMore(), list.loadMore(), list.loadMore()]);
		expect(pending).toBe(0);
		expect(list.items).toEqual([1]);
		// exhausted
		await list.loadMore();
		expect(list.items).toEqual([1]);
	});

	it('deduplicates items by key across pages', async () => {
		const source: SuiSource<{ value: string }> = async (req) => ({
			// every page repeats the same item plus one new
			items: [{ value: 'dup' }, { value: `new-${req.page}` }],
			hasMore: req.page < 2
		});
		const list = new SuiInfiniteList(source, {
			pageSize: 2,
			itemKey: (item) => item.value
		});
		await list.loadMore();
		await list.loadMore();
		await list.loadMore();
		expect(list.items.map((i) => i.value)).toEqual(['dup', 'new-0', 'new-1', 'new-2']);
	});

	it('a stale (superseded) response is discarded', async () => {
		let call = 0;
		const source: SuiSource<string> = async () => {
			call += 1;
			// first call resolves slowly, second fast
			if (call === 1) {
				await new Promise((r) => setTimeout(r, 50));
				return { items: ['SLOW'], hasMore: true };
			}
			return { items: ['FAST'], hasMore: true };
		};
		const list = new SuiInfiniteList(source, { pageSize: 1 });
		const first = list.loadMore(); // superseded by reset
		list.reset();
		await list.loadMore();
		await first;
		expect(list.items).toEqual(['FAST']);
	});

	it('captures load errors and keeps hasMore for retry', async () => {
		let fail = true;
		const source: SuiSource<string> = async () => {
			if (fail) throw new Error('network down');
			return { items: ['ok'], hasMore: false };
		};
		const list = new SuiInfiniteList(source);
		await list.loadMore();
		expect(list.error).toBe('network down');
		expect(list.loading).toBe(false);
		expect(list.items).toEqual([]);

		fail = false;
		await list.loadMore(); // retry works
		expect(list.items).toEqual(['ok']);
		expect(list.error).toBeNull();
	});

	it('search resets the list and reloads with the new query', async () => {
		const queries: string[] = [];
		const source: SuiSource<string> = async (req) => {
			queries.push(req.query);
			return { items: [req.query || 'all'], hasMore: false };
		};
		const list = new SuiInfiniteList(source);
		await list.loadMore();
		expect(queries).toEqual(['']);
		await list.search('minh');
		expect(queries).toEqual(['', 'minh']);
		expect(list.items).toEqual(['minh']);
		expect(list.query).toBe('minh');
	});

	it('skips search when the query is unchanged', async () => {
		let calls = 0;
		const source: SuiSource<string> = async () => {
			calls += 1;
			return { items: ['x'], hasMore: false };
		};
		const list = new SuiInfiniteList(source);
		await list.search('minh');
		await list.search('minh'); // same query — no reload
		expect(calls).toBe(1);
	});

	it('aborts in-flight requests when reset', async () => {
		const abortedSignals: boolean[] = [];
		const source: SuiSource<string> = async (req) => {
			await new Promise((r) => setTimeout(r, 30));
			abortedSignals.push(req.signal?.aborted ?? false);
			return { items: ['late'], hasMore: false };
		};
		const list = new SuiInfiniteList(source);
		const first = list.loadMore();
		list.reset();
		await first;
		expect(abortedSignals[0]).toBe(true);
		expect(list.items).toEqual([]);
	});

	it('exposes pageSize and total', async () => {
		const source: SuiSource<number> = async () => ({ items: [1, 2], hasMore: true, total: 99 });
		const list = new SuiInfiniteList(source, { pageSize: 2 });
		expect(list.pageSize).toBe(2);
		await list.loadMore();
		expect(list.total).toBe(99);
	});
});
