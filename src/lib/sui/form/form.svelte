<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { HTMLFormAttributes } from 'svelte/elements';
	import type { SuiSchemaLike } from './schema.js';
	import type { SuiFormInstance } from './create-form.svelte.js';

	export type SuiFormProps<Schema extends SuiSchemaLike> = Omit<
		HTMLFormAttributes,
		'class' | 'onsubmit'
	> & {
		/** The schema-driven form instance (see `createSuiForm`). */
		form: SuiFormInstance<Schema>;
		/** Form content — the wired sui controls and the submit button. */
		children: Snippet;
		/**
		 * Render `form.formErrors` (root refine + server-level messages) as a
		 * banner above the content — the box receives focus after a failed
		 * submit when no error summary is rendered.
		 */
		showFormErrors?: boolean;
		/** Banner title. Default `'There is a problem:'`. */
		formErrorTitle?: string;
		class?: string;
	};
</script>

<script lang="ts" generics="Schema extends SuiSchemaLike">
	import { tick } from 'svelte';
	import { focusFirstInvalid } from './utils.js';
	import { suiMobileQuery } from '../mobile.svelte.js';
	import { cn } from '$lib/utils.js';
	import AlertCircleIcon from '@lucide/svelte/icons/circle-alert';

	let {
		form,
		showFormErrors = false,
		formErrorTitle = 'There is a problem:',
		class: className = '',
		children,
		...rest
	}: SuiFormProps<Schema> = $props();

	const isMobile = suiMobileQuery();

	// focus/scroll target for a failed submit, GOV.UK error-summary pattern:
	// 1. the error summary box (when rendered) — announcing the whole list;
	// 2. the form-error banner (when it has content and no field is invalid);
	// 3. the first invalid control (desktop: focus, touch: scroll).
	function focusTarget(formEl: HTMLFormElement): HTMLElement | null {
		const summary = formEl.querySelector<HTMLElement>('[data-sui-error-summary]');
		if (summary) return summary;
		if (form.errorSummary.length === 0) {
			const banner = formEl.querySelector<HTMLElement>('[data-sui-form-errors]');
			if (banner && (banner.textContent ?? '').length > 0) return banner;
		}
		return null;
	}

	async function submit(event: SubmitEvent & { currentTarget: EventTarget & HTMLFormElement }) {
		// currentTarget is only populated during dispatch — capture before awaiting
		const formEl = event.currentTarget;
		const ok = await form.handleSubmit(event);
		if (ok) return;
		if (form.focusOnSubmit === 'none') return;
		// let the DOM settle so fresh data-invalid attributes are painted
		await tick();
		const target = form.focusOnSubmit === 'summary' ? focusTarget(formEl) : null;
		if (target) {
			// focusing the box announces the whole problem list (a div with
			// tabindex="-1" opens no on-screen keyboard, so this is touch-safe)
			target.focus();
			if (isMobile.current) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
			return;
		}
		if (isMobile.current) {
			// focusing on touch devices opens the on-screen keyboard and
			// shifts the viewport away from the message — scroll instead
			// (superforms `autoFocusOnError: 'detect'` behaviour)
			formEl
				.querySelector('[data-invalid]')
				?.scrollIntoView({ block: 'center', behavior: 'smooth' });
		} else {
			// WCAG 3.3.1: land keyboard and screen-reader users on the first problem
			focusFirstInvalid(formEl);
		}
	}
</script>

<!-- novalidate: the schema owns validation, not the Constraint Validation API -->
<form novalidate class={className} onsubmit={submit} data-sui-form {...rest}>
	{#if showFormErrors}
		<!-- Focusable alert banner: receives focus on failed submits that
                     produced form-level errors (when no error summary is rendered).
                     Fully collapses while empty — the region stays mounted so
                     screen readers observe it, but paints nothing. -->
		<div
			data-sui-form-errors
			role="alert"
			tabindex="-1"
			class={cn(
				form.formErrors.length > 0 &&
					'mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive'
			)}
		>
			{#if form.formErrors.length > 0}
				<p class="flex items-center gap-2 font-medium">
					<AlertCircleIcon class="size-4 shrink-0" aria-hidden="true" />
					{formErrorTitle}
				</p>
				<ul class="mt-2 list-inside list-disc space-y-1 pl-1.5">
					{#each form.formErrors as message (message)}
						<li>{message}</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
	{@render children()}
</form>
