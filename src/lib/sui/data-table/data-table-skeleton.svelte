<script lang="ts">
	import type { SuiDataTableSize } from './data-table.svelte';
	import SuiSkeleton from '../skeleton/skeleton.svelte';
	import SuiSkeletonContainer from '../skeleton/skeleton-container.svelte';

	let {
		rows = 5,
		columns = 4,
		size = 'md',
		searchable = false
	}: {
		rows?: number;
		columns?: number;
		size?: SuiDataTableSize;
		searchable?: boolean;
	} = $props();

	const CELL: Record<SuiDataTableSize, { row: string; head: string }> = {
		sm: { row: 'h-8', head: 'h-8' },
		md: { row: 'h-10', head: 'h-9' },
		lg: { row: 'h-12', head: 'h-11' }
	};
</script>

<SuiSkeletonContainer>
	<div class="bg-card w-full overflow-hidden rounded-lg border" aria-hidden="true">
		{#if searchable}
			<div class="flex items-center gap-2 border-b px-3 py-2.5">
				<SuiSkeleton data-sui-skeleton="table-search" class="h-8 w-56" />
			</div>
		{/if}
		<div class="overflow-hidden">
			<div class="bg-muted/40 flex gap-3 border-b px-3 py-2.5">
				{#each Array.from({ length: columns }) as _, i (i)}
					<SuiSkeleton data-sui-skeleton="table-head" class="{CELL[size].head} flex-1" />
				{/each}
			</div>
			{#each Array.from({ length: rows }) as _, r (r)}
				<div class="flex gap-3 border-b px-3 py-2">
					{#each Array.from({ length: columns }) as _, c (c)}
						<SuiSkeleton
							data-sui-skeleton="table-cell"
							class="{CELL[size].row} flex-1"
							style="margin-top: {(r * 7 + c * 11) % 24}px"
						/>
					{/each}
				</div>
			{/each}
		</div>
		<div class="flex items-center gap-3 px-3 py-2">
			<SuiSkeleton data-sui-skeleton="table-footer" class="h-4 w-16" />
			<SuiSkeleton class="ml-auto h-7 w-40" />
		</div>
	</div>
</SuiSkeletonContainer>
