<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Component } from 'svelte';

	/** Friendly empty state with an icon, used by the agenda & board columns. */
	let {
		icon: Icon,
		title,
		description,
		children
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	}: { icon: Component<any>; title: string; description?: string; children?: Snippet } = $props();
</script>

<div class="text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
	<div class="bg-muted flex size-10 items-center justify-center rounded-full">
		<Icon class="text-muted-foreground size-5" aria-hidden="true" />
	</div>
	<div class="text-foreground text-sm font-medium">{title}</div>
	{#if description}
		<p class="max-w-xs text-xs leading-relaxed">{description}</p>
	{/if}
	{#if children}
		<div class="mt-1">{@render children()}</div>
	{/if}
</div>
