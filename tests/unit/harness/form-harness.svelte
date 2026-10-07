<script lang="ts">
	import { SuiForm } from '$lib/sui/form/index.js';
	import SuiInput from '$lib/sui/input/input.svelte';
	import SuiCheckbox from '$lib/sui/checkbox/checkbox.svelte';
	import SuiSelect from '$lib/sui/select/select.svelte';
	import type { SuiFormInstance } from '$lib/sui/form/create-form.svelte.js';
	import type { TestSchema } from './form-schema.js';

	let { form }: { form: SuiFormInstance<TestSchema> } = $props();
</script>

<SuiForm {form} class="grid gap-4">
	<SuiInput field={form.fields.name} label="Name" />
	<SuiSelect
		field={form.fields.role}
		label="Role"
		placeholder="Choose a role…"
		items={[
			{ value: 'admin', label: 'Admin' },
			{ value: 'viewer', label: 'Viewer' }
		]}
	/>
	<SuiCheckbox field={form.fields.accept} label="Accept the terms" />
	<button type="submit">Submit</button>
</SuiForm>
