<script lang="ts" module>
	export type SuiErrorSummaryProps = {
		/** One entry per invalid field: the message + the focusable field id. */
		errors: { fieldId: string; message: string }[];
		/** Box title. Default `Please fix the following:`. */
		title?: string;
		/** Accessible id — focus it (or call `focusFirstInvalid`) after a failed submit. */
		id?: string;
		class?: string;
	};
</script>

<script lang="ts">
	import { cn } from '$lib/utils.js';
	import AlertCircleIcon from '@lucide/svelte/icons/circle-alert';

	/**
	 * WCAG 3.3.1 error summary: after a failed submit, screen readers and
	 * sighted users get one box listing every invalid field as a link that
	 * focuses the field when activated. Render it above the form and focus
	 * it (or the first field — see `focusFirstInvalid`) on failed submits.
	 */
	let {
		errors,
		title = 'Please fix the following:',
		id = 'sui-error-summary',
		class: className = ''
	}: SuiErrorSummaryProps = $props();

	function focusField(event: MouseEvent, fieldId: string) {
		event.preventDefault();
		document.getElementById(fieldId)?.focus();
	}
</script>

{#if errors.length > 0}
	<div
		{id}
		role="alert"
		data-sui-error-summary
		data-sui-variant="error"
		class={cn(
			'border-destructive/40 bg-destructive/5 rounded-md border px-4 py-3 text-sm',
			className
		)}
	>
		<p class="text-destructive flex items-center gap-2 font-medium">
			<AlertCircleIcon class="size-4 shrink-0" aria-hidden="true" />
			{title}
		</p>
		<ul class="mt-2 list-inside list-disc space-y-1 pl-1.5">
			{#each errors as error (error.fieldId)}
				<li>
					<!-- href keeps the link semantics + keyboard focusable; the click
						handler focuses the field without a hash navigation jump -->
					<a
						href="#{error.fieldId}"
						class="text-destructive underline underline-offset-2 hover:opacity-80"
						onclick={(event) => focusField(event, error.fieldId)}
					>
						{error.message}
					</a>
				</li>
			{/each}
		</ul>
	</div>
{/if}
