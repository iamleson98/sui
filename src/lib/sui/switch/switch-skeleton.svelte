<script lang="ts">
	import type { SuiSize } from '../types.js';
	import SuiSkeleton from '../skeleton/skeleton.svelte';
	import SuiSkeletonContainer from '../skeleton/skeleton-container.svelte';

	let { size = 'md', label = true }: { size?: SuiSize; label?: boolean } = $props();

	const TRACK: Record<SuiSize, string> = {
		xs: 'h-3.5 w-6',
		sm: 'h-4 w-7',
		md: 'h-5 w-9',
		lg: 'h-6 w-11',
		xl: 'h-7 w-13'
	};

	const LABEL_H: Record<SuiSize, string> = {
		xs: 'h-3',
		sm: 'h-3.5',
		md: 'h-4',
		lg: 'h-4',
		xl: 'h-5'
	};
</script>

<SuiSkeletonContainer>
	<div class="flex items-center justify-between gap-3" aria-hidden="true">
		{#if label}
			<SuiSkeleton data-sui-skeleton="label" data-sui-size={size} class="{LABEL_H[size]} w-28" />
		{:else}
			<span></span>
		{/if}
		<SuiSkeleton data-sui-skeleton="switch" data-sui-size={size} class="{TRACK[size]} rounded-full" />
	</div>
</SuiSkeletonContainer>
