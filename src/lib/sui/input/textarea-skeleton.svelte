<script lang="ts">
	import { SUI_CONTROL } from '../styles.js';
	import type { SuiSize } from '../types.js';
	import SuiSkeleton from '../skeleton/skeleton.svelte';
	import SuiSkeletonContainer from '../skeleton/skeleton-container.svelte';

	let {
		size = 'md',
		label = false,
		rows = 4
	}: {
		size?: SuiSize;
		label?: boolean;
		rows?: number;
	} = $props();

	/** Approximate the rendered height of a textarea with `rows` rows. */
	const height = $derived(`${rows * 1.5 + 1}rem`);
</script>

<SuiSkeletonContainer>
	{#if label}
		<SuiSkeleton data-sui-skeleton="label" data-sui-size={size} class="mb-1.5 h-4 w-1/3" />
	{/if}
	<SuiSkeleton
		data-sui-skeleton="textarea"
		data-sui-size={size}
		class="{SUI_CONTROL[size]} w-full"
		style="height: {height}"
	/>
</SuiSkeletonContainer>
