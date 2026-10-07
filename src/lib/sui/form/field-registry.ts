/**
 * Element-keyed registry connecting hand-wired sui controls to a
 * form-level submitter (`createSuiSubmitter`).
 *
 * sui controls render a `[data-sui-field]` root; when a control receives
 * a `name` prop (and is not driven by a `createSuiForm` field handle) it
 * registers itself on its root element at mount. A submitter walks the
 * submitted `<form>` for `[data-sui-field]` roots, collects live values
 * and distributes parse errors back — the consumer never touches a ref,
 * never builds a candidate object and never maps an issue to a field.
 */

/** What a control registers for submit orchestration. */
export type SuiFieldRegistration = {
	/**
	 * Schema path this field maps to (`'email'`, `'address.city'`) — must
	 * match the key the whole-form schema expects.
	 */
	name: string;
	/** Live value getter — read at submit time. */
	get: () => unknown;
	/** Attach whole-form parse errors; display until the field is edited. */
	setSubmitErrors: (errors: string[]) => void;
	/** Drop any previously distributed submit errors. */
	clearSubmitErrors: () => void;
};

const REGISTRY = new WeakMap<HTMLElement, SuiFieldRegistration>();

/**
 * Register (or, with `null`, unregister) a control on its root element.
 * Call from an `$effect` — return the unregister function it hands back
 * so Svelte cleans up on destroy.
 */
export function registerSuiField(
	el: HTMLElement | null,
	registration: SuiFieldRegistration | null
): () => void {
	if (el && registration) REGISTRY.set(el, registration);
	return () => {
		if (el) REGISTRY.delete(el);
	};
}

/** Does this element carry a live registration? (exposed for tests) */
export function isSuiFieldRegistered(el: HTMLElement | null): boolean {
	return el !== null && REGISTRY.has(el);
}

/**
 * Every registered field inside `root`, in DOM order — the order the
 * submitter both collects values and focuses the first invalid control.
 * Queries both field-root flavors: `data-sui-field` (input, textarea,
 * select, combobox, multi-select) and `data-sui-control` (checkbox,
 * radio-group, switch).
 */
export function collectSuiFields(
	root: ParentNode
): { el: HTMLElement; reg: SuiFieldRegistration }[] {
	const out: { el: HTMLElement; reg: SuiFieldRegistration }[] = [];
	for (const el of root.querySelectorAll<HTMLElement>('[data-sui-field], [data-sui-control]')) {
		const reg = REGISTRY.get(el);
		if (reg) out.push({ el, reg });
	}
	return out;
}
