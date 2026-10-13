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
		 * submit when no error summary is rendered. Errors that no rendered
		 * control can display (`form.unmappedErrors`) always render here,
		 * even without this flag: a failed submit is never silent.
		 */
		showFormErrors?: boolean;
		/** Banner title. Default `'There is a problem:'` (see `setSuiStrings`). */
		formErrorTitle?: string;
		class?: string;
	};
</script>

<script lang="ts" generics="Schema extends SuiSchemaLike">
	import { focusFailedSubmit } from './utils.js';
	import { getSuiStrings } from '../strings.js';
	import { cn } from '$lib/utils.js';
	import AlertCircleIcon from '@lucide/svelte/icons/circle-alert';

	let {
		form,
		showFormErrors = false,
		formErrorTitle,
		class: className = '',
		children,
		...rest
	}: SuiFormProps<Schema> = $props();

	const strings = getSuiStrings();

	// form-level messages + errors no rendered control displays (a schema
	// key without a field, an unmounted step…) — deduplicated
	const bannerMessages = $derived([...new Set([...form.formErrors, ...form.unmappedErrors])]);
	const showBanner = $derived(showFormErrors || form.unmappedErrors.length > 0);

	async function submit(event: SubmitEvent & { currentTarget: EventTarget & HTMLFormElement }) {
		// SvelteKit's `enhance` owns this submit (see `suiEnhance`)
		if (event.currentTarget.hasAttribute('data-sui-enhanced')) return;
		// currentTarget is only populated during dispatch — capture before awaiting
		const formEl = event.currentTarget;
		const ok = await form.handleSubmit(event);
		if (!ok) await focusFailedSubmit(formEl, form);
	}
</script>

<!-- novalidate: the schema owns validation, not the Constraint Validation API -->
<form novalidate class={className} onsubmit={submit} data-sui-form {...rest}>
	{#if showBanner}
		<!-- Focusable alert banner: receives focus on failed submits that
		     produced form-level errors (when no error summary is rendered).
		     Fully collapses while empty — the region stays mounted so
		     screen readers observe it, but paints nothing. -->
		<div
			data-sui-form-errors
			role="alert"
			tabindex="-1"
			class={cn(
				bannerMessages.length > 0 &&
					'mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-red-700 dark:text-red-300'
			)}
		>
			{#if bannerMessages.length > 0}
				<p class="flex items-center gap-2 font-medium">
					<AlertCircleIcon class="size-4 shrink-0" aria-hidden="true" />
					{formErrorTitle ?? strings.formErrorTitle}
				</p>
				<ul class="mt-2 list-inside list-disc space-y-1 pl-1.5">
					{#each bannerMessages as message (message)}
						<li>{message}</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
	{@render children()}
</form>
