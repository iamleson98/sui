<script lang="ts">
	import type { SuiSize } from '../types.js';
	import SuiSkeleton from '../skeleton/skeleton.svelte';
	import SuiSkeletonContainer from '../skeleton/skeleton-container.svelte';

	let {
		size = 'md',
		label = true,
		count = 2
	}: { size?: SuiSize; label?: boolean; count?: number } = $props();

	const DOT: Record<SuiSize, string> = {
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

	const dots = ['size-3', 'size-3.5', 'size-4', 'size-[18px]', 'size-5'];
	const labelHeights = ['h-3', 'h-3.5', 'h-4', 'h-4', 'h-5'];
	const widths = ['w-20', 'w-28', 'w-16', 'w-24', 'w-32'];
</script>

<SuiSkeletonContainer>
	<div class="flex flex-col gap-2" aria-hidden="true">
		{#each Array.from({ length: count }) as _, i (i)}
			<div class="flex items-start gap-2">
				<SuiSkeleton
					data-sui-skeleton="radio"
					data-sui-size={size}
					class="{dots[i % dots.length]} rounded-full"
				/>
				{#if label}
					<SuiSkeleton
						data-sui-skeleton="label"
						data-sui-size={size}
						class="{labelHeights[i % labelHeights.length]} {widths[i % widths.length]}"
					/>
				{/if}
			</div>
		{/each}
	</div>
</SuiSkeletonContainer>
