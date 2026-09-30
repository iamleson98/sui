<script lang="ts">
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';

	type Props = {
		class?: string;
		/**
		 * Announce the loading state to screen readers via a visually
		 * hidden live region. Default `true`.
		 */
		announce?: boolean;
		children: Snippet;
	};

	let { class: className = '', announce = true, children }: Props = $props();
</script>

<div class={cn('contents', className)} aria-busy="true">
	{#if announce}
		<span class="sr-only" role="status">Loading</span>
	{/if}
	{@render children()}
</div>
