<script lang="ts">
	import { z } from 'zod';
	import { createSuiForm } from '$lib/sui/form/index.js';
	import SuiInput from '$lib/sui/input/input.svelte';
	import SuiTextarea from '$lib/sui/input/textarea.svelte';
	import SuiCheckbox from '$lib/sui/checkbox/checkbox.svelte';
	import SuiSwitch from '$lib/sui/switch/switch.svelte';
	import SuiRadioGroup from '$lib/sui/radio-group/radio-group.svelte';
	import SuiSelect from '$lib/sui/select/select.svelte';
	import SuiCombobox from '$lib/sui/combobox/combobox.svelte';
	import SuiMultiSelect from '$lib/sui/multi-select/multi-select.svelte';

	// every control driven by createSuiForm — no explicit `name` anywhere
	const form = createSuiForm(
		z.object({
			email: z.string(),
			bio: z.string(),
			accept: z.boolean(),
			notify: z.boolean(),
			plan: z.string(),
			role: z.string(),
			country: z.string(),
			tags: z.array(z.string())
		}),
		{
			initialValues: {
				email: 'ada@example.com',
				bio: 'Hi',
				accept: true,
				notify: true,
				plan: 'pro',
				role: 'admin',
				country: 'vn',
				tags: ['a', 'b']
			}
		}
	);
	const items = [
		{ value: 'admin', label: 'Admin' },
		{ value: 'vn', label: 'Vietnam' },
		{ value: 'a', label: 'A' },
		{ value: 'b', label: 'B' }
	];
</script>

<form data-testid="native-form">
	<SuiInput field={form.fields.email} label="Email" />
	<SuiTextarea field={form.fields.bio} label="Bio" />
	<SuiCheckbox field={form.fields.accept} label="Accept" />
	<SuiSwitch field={form.fields.notify} label="Notify" />
	<SuiRadioGroup
		field={form.fields.plan}
		label="Plan"
		items={[
			{ value: 'free', label: 'Free' },
			{ value: 'pro', label: 'Pro' }
		]}
	/>
	<SuiSelect field={form.fields.role} label="Role" {items} />
	<SuiCombobox field={form.fields.country} label="Country" {items} />
	<SuiMultiSelect field={form.fields.tags} label="Tags" {items} />
</form>
