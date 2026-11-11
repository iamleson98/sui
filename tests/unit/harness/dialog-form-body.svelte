<script lang="ts">
	import { SuiForm } from '#lib/sui/form/index.js';
	import SuiInput from '#lib/sui/input/input.svelte';
	import type { SuiFormInstance } from '#lib/sui/form/create-form.svelte.js';
	import type { dialogFormSchema } from './form-schema.js';

	// a child component of its own: the guard must reach a form that is
	// not written in the overlay's own markup
	let { form }: { form: SuiFormInstance<typeof dialogFormSchema> } = $props();
</script>

<SuiForm {form} class="grid gap-4">
	<SuiInput field={form.fields.name} label="Name" />
	<button type="submit">Save</button>
</SuiForm>
