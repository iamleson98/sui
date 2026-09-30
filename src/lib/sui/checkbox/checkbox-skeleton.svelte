<script lang="ts">
	import type { SuiSize } from '../types.js';
	import SuiSkeleton from '../skeleton/skeleton.svelte';
	import SuiSkeletonContainer from '../skeleton/skeleton-container.svelte';

	let { size = 'md', label = true }: { size?: SuiSize; label?: boolean } = $props();

	const BOX: Record<SuiSize, string> = {
		xs: 'size-3',
		sm: 'size-3.5',
		md: 'size-4',
		lg: 'size-[18px]',
		xl: 'size-5'
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
	<div class="flex items-start gap-2" aria-hidden="true">
		<SuiSkeleton data-sui-skeleton="checkbox" data-sui-size={size} class="{BOX[size]} rounded-[4px]" />
		{#if label}
			<SuiSkeleton data-sui-skeleton="label" data-sui-size={size} class="{LABEL_H[size]} w-24" />
		{/if}
	</div>
</SuiSkeletonContainer>
