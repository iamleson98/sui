<script lang="ts">
	import type { Snippet } from 'svelte';

	/** Title block + action row at the top of every view. */
	let {
		title,
		description,
		children
	}: { title: string; description?: string; children?: Snippet } = $props();
</script>

<div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
	<div class="max-w-2xl">
		<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
		{#if description}
			<p class="mt-1.5 text-sm leading-relaxed text-pretty text-muted-foreground">{description}</p>
		{/if}
	</div>
	{#if children}
		<div class="flex shrink-0 flex-wrap items-center gap-2">{@render children()}</div>
	{/if}
</div>
