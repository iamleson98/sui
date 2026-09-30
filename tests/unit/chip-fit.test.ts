import { describe, expect, it } from 'vitest';
import { fitChipCount } from '$lib/sui';

describe('fitChipCount', () => {
	it('returns 0 for an empty chip list', () => {
		expect(fitChipCount({ widths: [], available: 300, badgeWidth: 40 })).toBe(0);
	});

	it('returns every chip when they all fit', () => {
		expect(fitChipCount({ widths: [80, 90, 70], available: 300, badgeWidth: 40 })).toBe(3);
	});

	it('returns every chip when the row exactly fills the available width', () => {
		// 80 + 4 + 90 + 4 + 70 = 248
		expect(fitChipCount({ widths: [80, 90, 70], available: 248, badgeWidth: 40 })).toBe(3);
	});

	it('charges the badge to the budget before fitting chips', () => {
		// full row 80+4+80+4+80 = 248 > 200 → collapsing is required
		// badge budget: 200 - 40 - 4 = 156 → first chip (80) fits, second needs 164 → stops
		expect(fitChipCount({ widths: [80, 80, 80], available: 200, badgeWidth: 40 })).toBe(1);
	});

	it('shows every chip when the whole row fits without a badge', () => {
		// 80+4+80 = 164 ≤ 200 — no badge needed, so nothing is charged to the budget
		expect(fitChipCount({ widths: [80, 80], available: 200, badgeWidth: 40 })).toBe(2);
	});

	it('fits the full first row when the badge fits too', () => {
		// available 220, badge 30 + gap 4 → budget 186: 80 + 4 + 80 = 164 ≤ 186
		expect(fitChipCount({ widths: [80, 80, 80], available: 220, badgeWidth: 30 })).toBe(2);
	});

	it('never collapses below minVisible even when nothing fits', () => {
		expect(fitChipCount({ widths: [500, 400], available: 50, badgeWidth: 40 })).toBe(1);
		expect(
			fitChipCount({ widths: [500, 400, 300], available: 50, badgeWidth: 40, minVisible: 2 })
		).toBe(2);
	});

	it('falls back to minVisible when nothing has been measured yet', () => {
		// SSR / jsdom: available width is 0
		expect(fitChipCount({ widths: [120, 130], available: 0, badgeWidth: 40 })).toBe(1);
		expect(fitChipCount({ widths: [], available: 0, badgeWidth: 40 })).toBe(0);
	});

	it('handles a single overflowing chip', () => {
		expect(fitChipCount({ widths: [999], available: 200, badgeWidth: 40 })).toBe(1);
	});

	it('supports a custom gap', () => {
		// gap 0: 80 + 80 = 160 ≤ 200 - 40 = 160 → 2 chips fit
		expect(fitChipCount({ widths: [80, 80], available: 200, badgeWidth: 40, gap: 0 })).toBe(2);
	});
});
