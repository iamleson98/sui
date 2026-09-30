import type { ZodType } from 'zod';
import type { SuiValidateOn } from './zod.js';
import { shouldValidate, suiValidate } from './zod.js';

/**
 * Per-field validation state shared by every sui form control.
 *
 * Timing (`validateOn`) follows the inline-validation research consensus
 * (Baymard, react-hook-form `onTouched`, superforms `auto`):
 *
 * - `'auto'` (default on text fields): the first blur validates; once the
 *   field has been touched, every change re-validates. Users are never
 *   scolded mid-keystroke, but feedback becomes instant after their first
 *   attempt at an answer.
 * - `'both'` (default on discrete controls): change + blur both validate.
 *
 * External errors (the `errors` prop, e.g. server-side messages) display
 * until the user edits the field — editing hands display rights back to
 * the local schema, so stale server messages never linger (superforms
 * "tainted field" behaviour).
 */
export class SuiFieldState {
	/** Schema errors from the last validation run. */
	errors = $state<string[]>([]);
	/** Messages supplied via the `errors` prop (server-side etc.). */
	external = $state<string[]>([]);
	/** The field has been blurred or force-validated at least once. */
	touched = $state(false);
	/** The user changed the value since the last external-errors update. */
	edited = $state(false);
	/**
	 * Raw identity of the last synced external list. `$state` proxies
	 * assigned arrays, so `next === this.external` can never hold — the
	 * plain field keeps the reference comparison meaningful.
	 */
	#externalRef: string[] | null = null;

	/**
	 * Call from `$effect` when the `errors` prop reference changes.
	 * Fresh external errors re-take the display; re-passing an unchanged
	 * (or still-empty) list never resurrects cleared messages, so parent
	 * re-renders cannot interrupt an in-progress edit.
	 */
	syncExternal(errors: string[] | undefined): void {
		const next = errors ?? [];
		if (next === this.#externalRef) return;
		// both sides empty: remember the identity, skip the state writes
		if (next.length === 0 && this.external.length === 0) {
			this.#externalRef = next;
			return;
		}
		this.#externalRef = next;
		this.external = next;
		this.edited = false;
	}

	/**
	 * Runs validation (respecting `validateOn`) and stores the result.
	 * Blur always marks the field touched; change additionally marks it
	 * edited (handing error display from external to local). Returns the
	 * resulting error messages.
	 */
	validate(
		value: unknown,
		schema: ZodType | undefined,
		event: 'change' | 'blur',
		validateOn: SuiValidateOn = 'auto'
	): string[] {
		// any edit takes error-display ownership from the external list —
		// server messages describe a previous value and must not survive
		// an edit, regardless of when the schema itself runs
		if (event === 'change') this.edited = true;
		if (!shouldValidate(validateOn, event, this.touched)) return this.errors;
		this.touched = true;
		this.errors = suiValidate(schema, value);
		return this.errors;
	}

	/**
	 * Validates regardless of configuration. Use for submit handlers.
	 * Does not mark the field edited — freshly submitted external errors
	 * must stay visible even when a schema is absent.
	 */
	forceValidate(value: unknown, schema: ZodType | undefined): string[] {
		this.touched = true;
		this.errors = suiValidate(schema, value);
		return this.errors;
	}

	/**
	 * Errors the field should display: local schema results once the user
	 * has edited the field, otherwise the deduplicated union of external
	 * and local messages.
	 */
	get displayed(): string[] {
		if (this.edited) return this.errors;
		return [...new Set([...this.external, ...this.errors])];
	}

	/** Replaces the local error list externally (rarely needed). */
	setErrors(errors: string[]): void {
		this.touched = true;
		this.errors = errors;
	}

	clear(): void {
		this.errors = [];
	}

	reset(): void {
		this.touched = false;
		this.edited = false;
		this.errors = [];
		this.external = [];
		this.#externalRef = null;
	}
}
