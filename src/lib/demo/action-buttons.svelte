<script lang="ts">
	/** Right-pinned table action cell: a row menu affordance that must stay
	 * reachable while the rest of the row scrolls horizontally. */
	let { name }: { name: string } = $props();

	let fired = $state('');

	function act(what: string) {
		fired = `${what} ${name}`;
		setTimeout(() => (fired = ''), 1500);
	}
</script>

<div class="flex items-center justify-end gap-1">
	<button
		type="button"
		class="hover:bg-accent hover:text-accent-foreground inline-flex size-6 items-center justify-center rounded-md text-xs outline-none"
		aria-label="Edit {name}"
		title="Edit {name}"
		onclick={(e) => {
			e.stopPropagation();
			act('Edit');
		}}
	>
		✎
	</button>
	<button
		type="button"
		class="hover:bg-accent hover:text-accent-foreground inline-flex size-6 items-center justify-center rounded-md text-xs outline-none"
		aria-label="Delete {name}"
		title="Delete {name}"
		onclick={(e) => {
			e.stopPropagation();
			act('Delete');
		}}
	>
		🗑
	</button>
	{#if fired}
		<span class="text-muted-foreground sr-only" role="status">{fired}</span>
	{/if}
</div>
