<script lang="ts">
	import SuiInput from '$lib/sui/input/input.svelte';
	import SuiSelect from '$lib/sui/select/select.svelte';
	import SuiCheckbox from '$lib/sui/checkbox/checkbox.svelte';
	import SuiMultiSelect from '$lib/sui/multi-select/multi-select.svelte';
	import type { SuiSubmitter } from '$lib/sui/form/submit.svelte.js';
	import type { ZodType } from 'zod';

	let {
		submit,
		name = $bindable(''),
		role = $bindable<string | undefined>(undefined),
		topics = $bindable<string[]>([]),
		accept = $bindable(false)
	}: {
		submit: SuiSubmitter<ZodType>;
		name?: string;
		role?: string | undefined;
		topics?: string[];
		accept?: boolean;
	} = $props();
</script>

<form onsubmit={submit.handleSubmit} novalidate>
	<SuiInput name="name" label="Name" bind:value={name} />
	<SuiSelect
		name="role"
		label="Role"
		placeholder="Choose a role…"
		items={[
			{ value: 'admin', label: 'Admin' },
			{ value: 'viewer', label: 'Viewer' }
		]}
		bind:value={role}
	/>
	<SuiMultiSelect
		name="topics"
		label="Topics"
		placeholder="Pick topics…"
		items={[
			{ value: 'svelte', label: 'Svelte' },
			{ value: 'ui', label: 'UI' }
		]}
		bind:value={topics}
	/>
	<SuiCheckbox name="accept" label="Accept the terms" bind:checked={accept} />
	<button type="submit">Submit</button>
</form>
