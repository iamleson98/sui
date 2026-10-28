/**
 * The page buttons a pager shows: zero-based page indexes, `null` for a gap
 * ("…"). Always seven slots once there are more than seven pages, so the
 * pager never changes width while the user pages through:
 *
 *   1 2 3 4 5 … 20      near the start
 *   1 … 8 9 10 … 20     in the middle
 *   1 … 16 17 18 19 20  near the end
 */
export function pageWindow(current: number, count: number): (number | null)[] {
	if (count <= 7) return Array.from({ length: count }, (_, i) => i);
	const last = count - 1;
	if (current < 4) return [0, 1, 2, 3, 4, null, last];
	if (current > last - 4) return [0, null, last - 4, last - 3, last - 2, last - 1, last];
	return [0, null, current - 1, current, current + 1, null, last];
}
