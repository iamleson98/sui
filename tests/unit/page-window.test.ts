import { describe, expect, it } from 'vitest';
import { pageWindow } from '$lib/sui/data-table/page-window';

describe('pageWindow', () => {
	it('lists every page while there are few', () => {
		expect(pageWindow(0, 0)).toEqual([]);
		expect(pageWindow(0, 1)).toEqual([0]);
		expect(pageWindow(3, 7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
	});

	it('keeps seven slots, with gaps, however many pages there are', () => {
		expect(pageWindow(0, 20)).toEqual([0, 1, 2, 3, 4, null, 19]);
		expect(pageWindow(3, 20)).toEqual([0, 1, 2, 3, 4, null, 19]);
		expect(pageWindow(9, 20)).toEqual([0, null, 8, 9, 10, null, 19]);
		expect(pageWindow(15, 20)).toEqual([0, null, 14, 15, 16, null, 19]);
		expect(pageWindow(16, 20)).toEqual([0, null, 15, 16, 17, 18, 19]);
		expect(pageWindow(19, 20)).toEqual([0, null, 15, 16, 17, 18, 19]);
		for (const current of [0, 4, 9, 15, 19]) expect(pageWindow(current, 20)).toHaveLength(7);
	});

	it('always includes the current page', () => {
		for (let current = 0; current < 30; current++) {
			expect(pageWindow(current, 30)).toContain(current);
		}
	});
});
