<script lang="ts">
	import SuiRadioGroup from '$lib/sui/radio-group/radio-group.svelte';
	import type { ZodType } from 'zod';
	import type { SuiRadioItem } from '$lib/sui/radio-group/radio-group.svelte';

	let {
		label = 'Plan',
		items,
		schema,
		value = $bindable('')
	}: {
		label?: string;
		items: SuiRadioItem[];
		schema?: ZodType;
		value?: string;
	} = $props();
</script>

<SuiRadioGroup {label} {items} {schema} bind:value />
<div data-testid="radio-value">{value}</div>
