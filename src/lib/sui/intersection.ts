/**
 * Observes a sentinel element and invokes `onEnd` whenever it comes near the
 * visible end of its scroll container — triggering a "load more" while the
 * user is still scrolling towards the end of the list (256px prefetch).
 *
 * Two complementary mechanisms are used because neither alone is reliable:
 *
 * 1. An `IntersectionObserver` rooted at the browser viewport — it covers the
 *    "list is shorter than the popup" case (the sentinel is immediately
 *    visible, so pages keep streaming until the popup fills) and any outer
 *    page scrolling. NOTE: an IO rooted at the viewport does NOT reliably
 *    re-evaluate when an *inner* container is scrolled (browsers coalesce
 *    those recomputations), and rooting it at the container is fragile
 *    because the container's overflow styles are applied asynchronously
 *    while the popup is positioning.
 *
 * 2. A capture-phase `scroll` listener on `document` — scroll events do not
 *    bubble, but they *do* capture through the ancestor chain, so this
 *    catches scrolling inside any nested container (the bits-ui select
 *    viewport, the command list, …). On every such scroll the sentinel's
 *    distance to its scroll container's visible bottom is measured directly,
 *    which is deterministic regardless of when styles were applied.
 *
 * Both are no-ops in jsdom (no layout engine / no IntersectionObserver).
 */
export function observeSentinel(
	sentinel: HTMLElement,
	onEnd: () => void,
	options: { threshold?: number } = {}
): () => void {
	const threshold = options.threshold ?? 256;
	const disposers: Array<() => void> = [];

	if (typeof IntersectionObserver !== 'undefined') {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) onEnd();
			},
			{ root: null, rootMargin: `${threshold}px` }
		);
		observer.observe(sentinel);
		disposers.push(() => observer.disconnect());
	}

	const onScroll = () => {
		if (!sentinel.isConnected) return;
		const container = findScrollParent(sentinel);
		if (!container) return;
		const containerRect = container.getBoundingClientRect();
		const sentinelRect = sentinel.getBoundingClientRect();
		// distance from the sentinel (end of the list) to the visible bottom
		// of its scroll container — negative when it is already on screen
		if (sentinelRect.bottom - containerRect.bottom < threshold) onEnd();
	};
	document.addEventListener('scroll', onScroll, { capture: true, passive: true });
	disposers.push(() => document.removeEventListener('scroll', onScroll, { capture: true }));

	return () => disposers.forEach((dispose) => dispose());
}

/**
 * Finds the nearest ancestor (or self) that actually scrolls vertically —
 * used to measure how close a sentinel is to the visible end of its list.
 */
export function findScrollParent(node: HTMLElement): HTMLElement | null {
	let current: HTMLElement | null = node;
	while (current) {
		const style = window.getComputedStyle(current);
		const scrolls = /(auto|scroll|overlay)/.test(style.overflowY);
		if (scrolls && current.scrollHeight > current.clientHeight) return current;
		current = current.parentElement;
	}
	return null;
}
