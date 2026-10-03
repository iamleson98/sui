<script lang="ts">
	import type { Snippet } from 'svelte';

	/** Keyboard key hint, shadcn-style. */
	let { children }: { children: Snippet } = $props();
</script>

<kbd
	class="bg-muted text-muted-foreground pointer-events-none inline-flex h-5 min-w-5 items-center justify-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium select-none"
>
	{@render children()}
</kbd>
