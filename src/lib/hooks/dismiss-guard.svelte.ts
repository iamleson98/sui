import { getContext, setContext, untrack } from 'svelte';

const KEY = Symbol('sui-dismiss-guard');

/**
 * Lets whatever sits inside a dialog, sheet or alert dialog say "do not
 * close me yet" (a form that is saving): while any hold is active the
 * overlay refuses Escape, an outside click and its X button, and marks its
 * content `aria-busy`. Code can still close it by setting its `open` state.
 *
 * What is deliberately NOT guarded:
 * - `DialogClose`, `SheetClose` and `AlertDialogCancel` are plain bits-ui
 *   close triggers. They stay an escape hatch for a Cancel button outside
 *   the form (and the caller's decision, e.g. to abort the request first).
 * - Drawers and popovers have no guard. A SuiForm inside one holds the
 *   guard of the nearest OUTER dialog, if there is one.
 */
export class DismissGuard {
	#holds = $state(0);

	/** Something inside is busy: the overlay must not be dismissed by the user. */
	get busy(): boolean {
		return this.#holds > 0;
	}

	/**
	 * Take a hold. Returns its release, which is idempotent — call it when
	 * the work ends (an effect can return it as its cleanup).
	 */
	hold(): () => void {
		// untracked: called from an effect, the read inside `+= 1` must not
		// make that effect depend on (and endlessly re-run for) the counter
		untrack(() => (this.#holds += 1));
		let released = false;
		return () => {
			if (released) return;
			released = true;
			untrack(() => (this.#holds -= 1));
		};
	}
}

/** Called by an overlay's content: creates its guard and shares it with the subtree. */
export function provideDismissGuard(): DismissGuard {
	const guard = new DismissGuard();
	setContext(KEY, guard);
	return guard;
}

/**
 * The guard of the nearest overlay around this component, or `undefined`
 * outside any (a form on a plain page has nothing to hold).
 */
export function useDismissGuard(): DismissGuard | undefined {
	return getContext<DismissGuard | undefined>(KEY);
}
