<script lang="ts">
	import { SuiForm } from '$lib/sui/form/index.js';
	import { SuiErrorSummary } from '$lib/sui/error-summary/index.js';
	import SuiInput from '$lib/sui/input/input.svelte';
	import SuiCheckbox from '$lib/sui/checkbox/checkbox.svelte';
	import type { SuiFormInstance } from '$lib/sui/form/create-form.svelte.js';

	let {
		form,
		showFormErrors = false,
		showSummary = false,
		summaryId = 'a11y-error-summary'
	}: {
		// intentionally `any` — the harness is shared across schemas
		form: SuiFormInstance<any>;
		showFormErrors?: boolean;
		showSummary?: boolean;
		summaryId?: string;
	} = $props();
</script>

<SuiForm {form} {showFormErrors}>
	{#if showSummary && form.errorSummary.length > 0}
		<SuiErrorSummary errors={form.errorSummary} id={summaryId} />
	{/if}
	<SuiInput field={form.field('name')} label="Name" subText="2 characters minimum." />
	<SuiCheckbox
		field={form.field('accept')}
		label="Accept the terms"
		subText="You can unsubscribe later."
	/>
	<button type="submit">Submit</button>
</SuiForm>
