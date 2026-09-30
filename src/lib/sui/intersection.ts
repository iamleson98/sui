/**
 * Observes a sentinel element and invokes `onEnd` whenever it comes near
 * the viewport. Used to trigger "load more" when a list is scrolled
 * close to its end.
 *
 * Uses the browser viewport as the intersection root so it works inside
 * portals/floaters (bits-ui popovers render content in a portal, which is
 * still positioned within the viewport). `rootMargin` pre-fetches before
 * the sentinel actually becomes visible, which keeps scrolling smooth.
 */
export function observeSentinel(
	sentinel: HTMLElement,
	onEnd: () => void,
	options: { rootMargin?: string } = {}
): () => void {
	if (typeof IntersectionObserver === 'undefined') {
		// jsdom / very old browsers: fall back to a no-op.
		return () => {};
	}
	const observer = new IntersectionObserver(
		(entries) => {
			if (entries.some((entry) => entry.isIntersecting)) onEnd();
		},
		{ root: null, rootMargin: options.rootMargin ?? '256px' }
	);
	observer.observe(sentinel);
	return () => observer.disconnect();
}
