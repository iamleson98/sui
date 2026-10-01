/**
 * Responsive chip-overflow math for `SuiMultiSelect`, inspired by
 * Ant Design's `maxTagCount="responsive"` (rc-overflow):
 *
 * 1. every chip is measured (via a hidden measurer row with identical styles)
 * 2. the available inner width of the trigger is measured (ResizeObserver)
 * 3. {@link fitChipCount} computes how many chips fit in a single row while
 *    reserving room for the "+n" overflow badge — always showing at least one
 *    chip, and preferring to show *more* chips over the badge when possible.
 *
 * The math is a pure function so it can be unit-tested headlessly (jsdom has
 * no layout engine) and reused for any chip list.
 */

export type FitChipOptions = {
	/** Rendered width of each chip, in px (measured). */
	widths: number[];
	/** Inner width available for chips, in px (measured). */
	available: number;
	/** Width of the "+n" overflow badge, in px (measured). */
	badgeWidth: number;
	/** Horizontal gap between chips, in px (defaults to 4). */
	gap?: number;
	/**
	 * Minimum chips that must remain visible when collapsing
	 * (defaults to 1 — never collapse below one visible chip).
	 */
	minVisible?: number;
};

/**
 * Computes how many leading chips fit into `available` px as a single row.
 *
 * Rules (mirroring rc-overflow's behaviour):
 * - when every chip fits, `widths.length` is returned (no badge needed)
 * - otherwise the badge is charged to the budget up-front and as many chips
 *   as possible are fitted after it
 * - the result never drops below `minVisible`, even if that row technically
 *   overflows (better to clip one long chip than to show an empty row)
 * - non-positive `available` (SSR / jsdom, nothing measured yet) returns
 *   `minVisible` so callers can fall back gracefully
 */
export function fitChipCount({
	widths,
	available,
	badgeWidth,
	gap = 4,
	minVisible = 1
}: FitChipOptions): number {
	const total = widths.length;
	if (total === 0) return 0;
	if (!(available > 0)) return Math.min(minVisible, total);

	const rowWidth = (count: number): number =>
		widths.slice(0, count).reduce((sum, w) => sum + w, 0) + gap * Math.max(0, count - 1);

	if (rowWidth(total) <= available) return total;

	const budget = available - badgeWidth - gap;
	if (budget <= 0) return Math.min(minVisible, total);

	let count = 0;
	let used = 0;
	for (let i = 0; i < total; i++) {
		const w = widths[i] ?? 0;
		const next = used === 0 ? w : used + gap + w;
		if (next > budget) break;
		used = next;
		count++;
	}
	return Math.max(Math.min(minVisible, total), count);
}
