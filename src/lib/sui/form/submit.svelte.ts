import { tick } from 'svelte';
import { ZodError, type ZodType, type z } from 'zod';
import { focusFirstInvalid } from './utils.js';
import { collectSuiFields } from './field-registry.js';
import { suiMobileQuery } from '../mobile.svelte.js';

/**
 * Whole-form submit orchestration for hand-wired controls — the Felte /
 * formisch / react-hook-form `handleSubmit` shape, adapted to sui.
 *
 * `createSuiForm` owns values and drives everything automatically; this is
 * the bridge for pages that keep their own `bind:value` state: give each
 * control a `name` matching the schema, hand the schema to the submitter,
 * and the ~50-line submit handler disappears:
 *
 * ```svelte
 * <script lang="ts">
 *   const submit = createSuiSubmitter(schema, {
 *     onvalid: async (data) => await save(data) // zod-parsed, typed
 *   });
 * </script>
 *
 * <form onsubmit={submit.handleSubmit} novalidate>
 *   <SuiInput name="email" label="Email" bind:value={email} />
 *   <SuiSelect name="role" label="Role" items={roles} bind:value={role} />
 *   <SuiButton type="submit" loading={submit.isSubmitting}>Save</SuiButton>
 * </form>
 * ```
 *
 * On submit the helper collects every registered control's live value,
 * parses the whole schema, distributes issues to the matching fields
 * (displaying until that field is edited), lands focus on the first
 * invalid control (WCAG 3.3.1 — scrolled into view on touch devices) and
 * calls `onvalid` with the typed, transformed output. A `ZodError` thrown
 * from `onvalid` maps back onto fields, exactly like `createSuiForm`.
 */

/** Options accepted by {@link createSuiSubmitter}. */
export type SuiSubmitterOptions<Schema extends ZodType> = {
	/**
	 * Called with the zod-parsed output when the submit passes validation.
	 * Throw a `ZodError` to map (server-side) issues back onto fields.
	 */
	onvalid: (data: z.output<Schema>) => void | Promise<void>;
	/**
	 * Called when validation fails, with issues grouped by dotted field
	 * path (`''` collects root / refine-level messages).
	 */
	oninvalid?: (errors: { fields: Record<string, string[]>; form: string[] }) => void;
	/**
	 * Move focus (desktop) or scroll (touch) to the first invalid control
	 * after a failed submit. Default `true`.
	 */
	focusFirst?: boolean;
};

/** Group zod issues under full dotted paths, deduplicated, message order preserved. */
function groupIssues(error: ZodError): Record<string, string[]> {
	const map: Record<string, string[]> = {};
	for (const issue of error.issues) {
		const key = issue.path.join('.');
		const message = issue.message || 'Invalid value';
		const list = map[key] ?? (map[key] = []);
		if (!list.includes(message)) list.push(message);
	}
	return map;
}

/** True for thenables — guards against async zod schemas sneaking in. */
function isPromiseLike(value: unknown): value is Promise<unknown> {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { then?: unknown }).then === 'function'
	);
}

/**
 * The submitter returned by {@link createSuiSubmitter}. `handleSubmit` is
 * a bound `onsubmit` handler; the reactive state powers loading buttons
 * and form-level message rendering.
 */
export class SuiSubmitter<Schema extends ZodType> {
	/** An `onvalid` callback is currently running. */
	isSubmitting = $state(false);
	/** Completed submit attempts (success or failure). */
	submitCount = $state(0);
	/** Root-level issues (path `''`) from the last failed parse. */
	formErrors = $state<string[]>([]);
	/** Issues by dotted field path from the last failed parse. */
	fieldErrors = $state<Record<string, string[]>>({});
	#schema: Schema;
	#options: SuiSubmitterOptions<Schema> & { focusFirst: boolean };
	#isMobile = suiMobileQuery();

	constructor(schema: Schema, options: SuiSubmitterOptions<Schema>) {
		this.#schema = schema;
		this.#options = { focusFirst: true, ...options };
	}

	#parse(
		values: Record<string, unknown>
	): { success: true; data: z.output<Schema> } | { success: false; error: ZodError } {
		let result: ReturnType<ZodType['safeParse']>;
		try {
			result = this.#schema.safeParse(values);
		} catch (cause) {
			// zod v4 throws $ZodAsyncError during sync parse of async schemas
			throw new Error(
				'createSuiSubmitter: the schema is asynchronous — use a synchronous zod schema (or move async checks into onvalid).',
				{ cause }
			);
		}
		if (isPromiseLike(result)) {
			throw new Error(
				'createSuiSubmitter: the schema is asynchronous — use a synchronous zod schema (or move async checks into onvalid).'
			);
		}
		return result as
			{ success: true; data: z.output<Schema> } | { success: false; error: ZodError };
	}

	/** Distribute issues to the registered fields of a form element. */
	#distribute(formEl: HTMLFormElement | null, byPath: Record<string, string[]>): void {
		const fields = formEl ? collectSuiFields(formEl) : [];
		for (const { reg } of fields) reg.clearSubmitErrors();
		for (const { reg } of fields) {
			const errors = byPath[reg.name];
			if (errors && errors.length > 0) reg.setSubmitErrors(errors);
		}
	}

	async #afterInvalid(formEl: HTMLFormElement | null): Promise<void> {
		if (!this.#options.focusFirst || !formEl) return;
		// let the DOM settle so fresh data-invalid attributes are painted
		await tick();
		if (this.#isMobile.current) {
			// focusing on touch devices opens the on-screen keyboard and shifts
			// the viewport away from the message — scroll instead
			formEl
				.querySelector('[data-invalid]')
				?.scrollIntoView({ block: 'center', behavior: 'smooth' });
		} else {
			focusFirstInvalid(formEl);
		}
	}

	/**
	 * The `onsubmit` handler: `<form onsubmit={submit.handleSubmit}>`.
	 * Returns whether the submit passed validation.
	 */
	handleSubmit = async (
		event: SubmitEvent & { currentTarget?: EventTarget & HTMLFormElement }
	): Promise<boolean> => {
		event.preventDefault();
		// currentTarget is only populated during dispatch — capture before awaiting
		const formEl = event.currentTarget ?? null;
		this.submitCount += 1;

		// 1. collect live values from the registered controls
		const values: Record<string, unknown> = {};
		for (const { reg } of formEl ? collectSuiFields(formEl) : []) values[reg.name] = reg.get();

		// 2. whole-schema parse
		const result = this.#parse(values);

		if (!result.success) {
			const byPath = groupIssues(result.error);
			this.fieldErrors = byPath;
			this.formErrors = byPath[''] ?? [];
			this.#distribute(formEl, byPath);
			this.#options.oninvalid?.({ fields: byPath, form: this.formErrors });
			await this.#afterInvalid(formEl);
			return false;
		}

		this.fieldErrors = {};
		this.formErrors = [];
		const { onvalid } = this.#options;
		this.isSubmitting = true;
		try {
			await onvalid(result.data);
			return true;
		} catch (error) {
			if (error instanceof ZodError) {
				// server-side issues map back onto fields (createSuiForm contract)
				const byPath = groupIssues(error);
				this.fieldErrors = byPath;
				this.formErrors = byPath[''] ?? [];
				this.#distribute(formEl, byPath);
				await this.#afterInvalid(formEl);
				return false;
			}
			const message = error instanceof Error ? error.message : String(error);
			this.formErrors = [message];
			return false;
		} finally {
			this.isSubmitting = false;
		}
	};
}

/**
 * Create a submit orchestrator for a hand-wired form. See
 * {@link SuiSubmitter} for the full contract.
 *
 * ```ts
 * const submit = createSuiSubmitter(schema, (data) => save(data));
 * ```
 */
export function createSuiSubmitter<Schema extends ZodType>(
	schema: Schema,
	options: SuiSubmitterOptions<Schema> | SuiSubmitterOptions<Schema>['onvalid']
): SuiSubmitter<Schema> {
	const resolved: SuiSubmitterOptions<Schema> =
		typeof options === 'function' ? { onvalid: options } : options;
	return new SuiSubmitter(schema, resolved);
}
