<script lang="ts">
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import { person, type PersonStatus } from './-data.svelte';

	/**
	 * Deterministic gradient avatar with optional presence dot.
	 * No image assets — every person gets a stable hue-based gradient.
	 */
	let {
		id,
		class: className = 'size-8',
		dot = false
	}: { id: string; class?: string; dot?: boolean } = $props();

	const p = $derived(person(id));
	const STATUS_COLOR: Record<PersonStatus, string> = {
		online: 'bg-emerald-500',
		busy: 'bg-amber-500',
		away: 'bg-zinc-400'
	};
</script>

<span class="relative inline-flex shrink-0">
	<Avatar.Root class={className}>
		<Avatar.Fallback
			class="flex size-full items-center justify-center rounded-full text-[0.65em] font-semibold text-white select-none"
			style="background: linear-gradient(135deg, oklch(0.72 0.14 {p.hue}), oklch(0.46 0.13 {p.hue + 42}))"
		>
			{p.initials}
		</Avatar.Fallback>
	</Avatar.Root>
	{#if dot}
		<span
			class="{STATUS_COLOR[p.status]} ring-background absolute right-0 bottom-0 size-[0.34em] rounded-full ring-2"
			title="{p.name} is {p.status}"
			aria-hidden="true"
		></span>
	{/if}
</span>
