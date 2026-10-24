import { SvelteMap } from 'svelte/reactivity';
import type { SuiItem } from './types.js';

/**
 * Looks up the items behind selected values that no loaded page contains
 * (a value set from a URL or a saved record, over a server-paginated list),
 * so the trigger shows a label instead of the raw value. Each value is
 * asked once; a failed lookup is not retried and leaves the raw value.
 */
export class SuiItemResolver<V extends string> {
	/** Items found, by value. */
	found = new SvelteMap<V, SuiItem<V>>();
	#asked = new Set<V>();

	/** Looks up `values` that `has` does not already know, through `resolve`. */
	request(
		values: V[],
		has: (value: V) => boolean,
		resolve: ((value: V) => Promise<SuiItem<V> | undefined>) | undefined
	): void {
		if (!resolve) return;
		for (const value of values) {
			if (value === '' || has(value) || this.#asked.has(value)) continue;
			this.#asked.add(value);
			resolve(value).then(
				(item) => {
					if (item) this.found.set(value, item);
				},
				() => {}
			);
		}
	}
}
