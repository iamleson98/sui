/**
 * LOCAL DEVIATION FROM UPSTREAM shadcn-svelte — sui bug fix (do not drop on re-sync).
 *
 * bits-ui's Command scrolls the selected/highlighted item into view with
 * `item.scrollIntoView({ block: "nearest" })`. That call races floating-ui
 * positioning: in the frames before the portaled content receives
 * `position: fixed`, the item still sits at the top of the document flow, so
 * the browser scrolls the PAGE to "reveal" it — on a scrolled form, opening a
 * combobox or multi-select menu (or selecting an item while it stays open)
 * yanks the page to the top. Native `scrollIntoView` also mis-scrolls outer
 * scrollers for elements inside transformed fixed containers in
 * Chromium/Safari, so the same jump can fire on selection and keyboard
 * navigation even after positioning settles.
 *
 * The fix mirrors what bits-ui's own Menu does (manual scrollTop math): the
 * element's `scrollIntoView` is replaced with a contained implementation that
 * only ever scrolls the nearest scrollable ancestor — the command list.
 */

/** Vertical delta needed to bring `item` into the visible edge(s) of `container`. */
export function containedScrollDelta(
	item: { top: number; bottom: number; height: number },
	container: { top: number; bottom: number; height: number },
	block: ScrollLogicalPosition
): number {
	switch (block) {
		case 'start':
			return item.top - container.top;
		case 'end':
			return item.bottom - container.bottom;
		case 'center':
			return item.top + item.height / 2 - (container.top + container.height / 2);
		case 'nearest':
		default:
			if (item.top < container.top) return item.top - container.top;
			if (item.bottom > container.bottom) return item.bottom - container.bottom;
			return 0;
	}
}

/**
 * Nearest ancestor that actually scrolls vertically. Stops at `body` — the
 * page itself must never be scrolled by the contained implementation.
 */
function nearestScrollable(node: HTMLElement): HTMLElement | null {
	let current: HTMLElement | null = node.parentElement;
	while (current && current !== document.body) {
		const style = window.getComputedStyle(current);
		if (
			/(auto|scroll|overlay|hidden)/.test(style.overflowY) &&
			current.scrollHeight > current.clientHeight
		) {
			return current;
		}
		current = current.parentElement;
	}
	return null;
}

/**
 * Svelte-action-shaped installer: patches `node.scrollIntoView` so the scroll
 * is contained to the nearest scrollable ancestor and never reaches the page.
 * Restores the native method on destroy.
 */
export function containedScrollIntoView(node: HTMLElement): { destroy(): void } {
	node.scrollIntoView = function contained(arg?: boolean | ScrollIntoViewOptions) {
		const block: ScrollLogicalPosition =
			typeof arg === 'object' && arg !== null
				? (arg.block ?? 'start')
				: arg === false
					? 'end'
					: 'start';
		const container = nearestScrollable(node);
		// no scrollable ancestor (list shorter than its max height, styles not
		// applied yet, …): do nothing rather than letting the page move
		if (!container) return;
		const delta = containedScrollDelta(
			node.getBoundingClientRect(),
			container.getBoundingClientRect(),
			block
		);
		if (delta !== 0) container.scrollTop += delta;
	};
	return {
		destroy() {
			// drop the own-property override, restoring the prototype method
			Reflect.deleteProperty(node, 'scrollIntoView');
		}
	};
}
