<script lang="ts">
	import SuiInput from '$lib/sui/input/input.svelte';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import type { ZodType } from 'zod';
	import type { SuiFieldVariant, SuiSize } from '$lib/sui/types';

	let {
		label = 'Email',
		size = 'md',
		variant = 'info',
		schema,
		validateDebounce = 0,
		value = $bindable(''),
		withAction = false,
		subText
	}: {
		label?: string;
		size?: SuiSize;
		variant?: SuiFieldVariant;
		schema?: ZodType;
		validateDebounce?: number;
		value?: string;
		withAction?: boolean;
		subText?: string;
	} = $props();
</script>

<SuiInput {label} {size} {variant} {schema} {validateDebounce} bind:value {subText}>
	{#snippet action({ size })}
		{#if withAction}
			<button type="button" aria-label="Toggle visibility" class="p-1">
				<EyeIcon class="size-4" />
			</button>
		{/if}
	{/snippet}
</SuiInput>
