<script lang="ts" module>
	export type SuiErrorSummaryProps = {
		/** One entry per invalid field: the message + the focusable field id. */
		errors: { fieldId: string; message: string }[];
		/** Box title. Default `Please fix the following:` (see `setSuiStrings`). */
		title?: string;
		/** Element id — a unique one is generated when omitted. */
		id?: string;
		class?: string;
	};
</script>

<script lang="ts">
	import { getSuiStrings } from '../strings.js';
	import { cn } from '$lib/utils.js';
	import AlertCircleIcon from '@lucide/svelte/icons/circle-alert';

	const uid = $props.id();
	const strings = getSuiStrings();

	/**
	 * WCAG 3.3.1 error summary: after a failed submit, screen readers and
	 * sighted users get one box listing every invalid field as a link that
	 * focuses the field when activated. Render it above the form and focus
	 * it (or the first field — see `focusFirstInvalid`) on failed submits.
	 */
	let {
		errors,
		title,
		id = `sui-error-summary-${uid}`,
		class: className = ''
	}: SuiErrorSummaryProps = $props();

	const FOCUSABLE =
		'input:not([type="hidden"]), textarea, select, button, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

	function focusField(event: MouseEvent, fieldId: string) {
		event.preventDefault();
		const el = document.getElementById(fieldId);
		// a segmented date/time field registers its group: land on its first
		// segment instead of the (non-focusable) group
		const target = el?.matches(FOCUSABLE) ? el : el?.querySelector<HTMLElement>(FOCUSABLE);
		target?.focus();
	}
</script>

{#if errors.length > 0}
	<div
		{id}
		role="alert"
		tabindex="-1"
		data-sui-error-summary
		data-sui-variant="error"
		class={cn(
			'rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm outline-none',
			className
		)}
	>
		<p class="flex items-center gap-2 font-medium text-red-700 dark:text-red-300">
			<AlertCircleIcon class="size-4 shrink-0" aria-hidden="true" />
			{title ?? strings.errorSummaryTitle}
		</p>
		<ul class="mt-2 list-inside list-disc space-y-1 pl-1.5">
			{#each errors as error (error.fieldId)}
				<li>
					<!-- href keeps the link semantics + keyboard focusable; the click
                                                handler focuses the field without a hash navigation jump -->
					<a
						href="#{error.fieldId}"
						class="text-red-700 underline underline-offset-2 hover:opacity-80 dark:text-red-300"
						onclick={(event) => focusField(event, error.fieldId)}
					>
						{error.message}
					</a>
				</li>
			{/each}
		</ul>
	</div>
{/if}
