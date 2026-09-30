<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		code,
		title,
		children
	}: {
		code: string;
		title?: string;
		children?: Snippet;
	} = $props();

	let copied = $state(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(code);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			// clipboard unavailable — ignore
		}
	}
</script>

{#if children}
	<div class="mb-4">{@render children()}</div>
{/if}

<div class="group relative overflow-hidden rounded-lg border">
	{#if title}
		<div class="bg-muted/60 text-muted-foreground border-b px-3 py-1.5 font-mono text-xs">{title}</div>
	{/if}
	<button
		type="button"
		onclick={copy}
		class="bg-background/80 hover:bg-accent absolute end-2 top-2 z-10 rounded-md border px-2 py-1 text-xs opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
		aria-label="Copy code"
	>
		{copied ? 'Copied!' : 'Copy'}
	</button>
	<pre class="bg-muted/30 overflow-x-auto p-4 text-xs leading-relaxed"><code>{code}</code></pre>
</div>
