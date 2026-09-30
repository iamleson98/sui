<script lang="ts">
	import { SUI_CONTROL } from '../styles.js';
	import type { SuiFieldVariant, SuiSize } from '../types.js';
	import SuiSkeleton from '../skeleton/skeleton.svelte';
	import SuiSkeletonContainer from '../skeleton/skeleton-container.svelte';

	let {
		size = 'md',
		label = false
	}: {
		/** Must match the size used by the real control. */
		size?: SuiSize;
		/** Also render a skeleton for the label row. Default `false`. */
		label?: boolean;
	} = $props();
</script>

<SuiSkeletonContainer>
	{#if label}
		<SuiSkeleton data-sui-skeleton="label" data-sui-size={size} class="mb-1.5 h-4 w-1/3" />
	{/if}
	<SuiSkeleton
		data-sui-skeleton="input"
		data-sui-size={size}
		class="{SUI_CONTROL[size]} w-full"
	/>
</SuiSkeletonContainer>
