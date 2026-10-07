<script lang="ts">
	import { SUI_CONTROL } from '../styles.js';
	import type { SuiSize } from '../types.js';
	import SuiSkeleton from '../skeleton/skeleton.svelte';
	import SuiSkeletonContainer from '../skeleton/skeleton-container.svelte';

	let {
		size = 'md',
		label = false,
		badges = 2
	}: { size?: SuiSize; label?: boolean; badges?: number } = $props();

	const BADGE: Record<SuiSize, string> = {
		xs: 'h-3.5',
		sm: 'h-4',
		md: 'h-5',
		lg: 'h-5',
		xl: 'h-6'
	};
</script>

<SuiSkeletonContainer>
	{#if label}
		<SuiSkeleton data-sui-skeleton="label" data-sui-size={size} class="mb-1.5 h-4 w-1/4" />
	{/if}
	<SuiSkeleton
		data-sui-skeleton="multi-select"
		data-sui-size={size}
		class="{SUI_CONTROL[size]} w-full"
	>
		<div class="flex items-center gap-1 px-0.5">
			{#each Array.from({ length: badges }) as _, i (i)}
				<SuiSkeleton
					data-sui-skeleton="badge"
					data-sui-size={size}
					class="{BADGE[size]} w-10 rounded-full"
				/>
			{/each}
		</div>
	</SuiSkeleton>
</SuiSkeletonContainer>
