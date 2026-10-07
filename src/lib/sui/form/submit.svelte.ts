import { tick } from 'svelte';
import { focusFirstInvalid } from './utils.js';
import { collectSuiFields } from './field-registry.js';
import { suiMobileQuery } from '../mobile.svelte.js';
import {
	groupSuiIssues,
	resolveSuiMessages,
	suiIssuesFromError,
	suiParse,
	type SuiFocusOnSubmit,
	type SuiIssue,
	type SuiMessages,
	type SuiOut,
	type SuiSchemaLike
} from './schema.js';

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
 *     onvalid: async (data) => await save(data) // parsed, typed
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
 * calls `onvalid` with the typed, transformed output. A `ZodError` (or any
 * issue-carrying error) thrown from `onvalid` maps back onto fields,
 * exactly like `createSuiForm`.
 */

/** Options accepted by {@link createSuiSubmitter}. */
export type SuiSubmitterOptions<Schema extends SuiSchemaLike> = {
	/**
	 * Called with the parsed output when the submit passes validation.
	 * Throw a `ZodError` (or any issue-carrying error) to map (server-side)
	 * issues back onto fields.
	 */
	onvalid: (data: SuiOut<Schema>) => void | Promise<void>;
	/**
	 * Called when validation fails, with issues grouped by dotted field
	 * path (`''` collects root / refine-level messages).
	 */
	oninvalid?: (errors: { fields: Record<string, string[]>; form: string[] }) => void;
	/**
	 * Where focus lands after a failed submit: `'summary'` (default) —
	 * the error summary box when one is rendered, else the first invalid
	 * field; `'field'` — always the first invalid field; `'none'` — no
	 * focus management. Kept boolean `focusFirst` (`true` = `'field'`,
	 * `false` = `'none'`) for backwards compatibility.
	 */
	focusOnSubmit?: SuiFocusOnSubmit;
	/** @deprecated use `focusOnSubmit`; kept for compatibility (`false` → `'none'`). */
	focusFirst?: boolean;
	/** Centralised message overrides (copy / i18n), keyed by field path. */
	messages?: SuiMessages;
};

/**
 * The submitter returned by {@link createSuiSubmitter}. `handleSubmit` is
 * a bound `onsubmit` handler; the reactive state powers loading buttons
 * and form-level message rendering.
 */
export class SuiSubmitter<Schema extends SuiSchemaLike> {
	/** An `onvalid` callback is currently running. */
	isSubmitting = $state(false);
	/** Completed submit attempts (success or failure). */
	submitCount = $state(0);
	/** Root-level issues (path `''`) from the last failed parse. */
	formErrors = $state<string[]>([]);
	/** Issues by dotted field path from the last failed parse. */
	fieldErrors = $state<Record<string, string[]>>({});
	#schema: Schema;
	#options: SuiSubmitterOptions<Schema>;
	#isMobile = suiMobileQuery();

	constructor(schema: Schema, options: SuiSubmitterOptions<Schema>) {
		this.#schema = schema;
		this.#options = options;
	}

	#parse(values: Record<string, unknown>): ReturnType<typeof suiParse> {
		return suiParse(this.#schema, values, 'createSuiSubmitter');
	}

	/** Issues → copy overrides → grouped by path. */
	#grouped(issues: readonly SuiIssue[]): Record<string, string[]> {
		return groupSuiIssues(resolveSuiMessages(issues, this.#options.messages));
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
		const mode: SuiFocusOnSubmit =
			this.#options.focusOnSubmit ??
			(this.#options.focusFirst === false
				? 'none'
				: this.#options.focusFirst === true
					? 'field'
					: 'summary');
		if (mode === 'none' || !formEl) return;
		// let the DOM settle so fresh data-invalid attributes are painted
		await tick();
		// GOV.UK pattern: focus the error summary when one is rendered —
		// announcing the whole problem list at once — falling back to the
		// first invalid control
		if (mode === 'summary') {
			const summary = formEl.querySelector<HTMLElement>('[data-sui-error-summary]');
			if (summary) {
				summary.focus();
				if (this.#isMobile.current) {
					summary.scrollIntoView({ block: 'center', behavior: 'smooth' });
				}
				return;
			}
		}
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

		if (!result.ok) {
			const byPath = this.#grouped(result.issues);
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
			await onvalid(result.data as SuiOut<Schema>);
			return true;
		} catch (error) {
			const issues = suiIssuesFromError(error);
			if (issues.length > 0) {
				// server-side issues map back onto fields (createSuiForm contract).
				// Server copy is authoritative — the messages map does NOT re-resolve it.
				const byPath = groupSuiIssues(issues);
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
export function createSuiSubmitter<Schema extends SuiSchemaLike>(
	schema: Schema,
	options: SuiSubmitterOptions<Schema> | SuiSubmitterOptions<Schema>['onvalid']
): SuiSubmitter<Schema> {
	const resolved: SuiSubmitterOptions<Schema> =
		typeof options === 'function' ? { onvalid: options } : options;
	return new SuiSubmitter(schema, resolved);
}
