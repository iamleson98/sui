<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, description, children }: { title: string; description?: string; children: Snippet } =
		$props();
</script>

<section class="mb-12">
	<h2 class="mb-1 text-xl font-semibold tracking-tight">{title}</h2>
	{#if description}
		<p class="mb-5 max-w-2xl text-sm text-muted-foreground">{description}</p>
	{:else}
		<div class="mb-5"></div>
	{/if}
	{@render children()}
</section>
