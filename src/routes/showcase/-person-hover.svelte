<script lang="ts">
	import * as HoverCard from '$lib/components/ui/hover-card/index.js';
	import PersonAvatar from './-person-avatar.svelte';
	import { person } from './-data.svelte';
	import type { Snippet } from 'svelte';

	/**
	 * HoverCard wrapper: pass any trigger via the `children` snippet (an
	 * avatar, a name, …). Falls back to rendering the person's avatar.
	 */
	let {
		id,
		children,
		class: className = ''
	}: { id: string; children?: Snippet; class?: string } = $props();

	const p = $derived(person(id));
</script>

<HoverCard.Root openDelay={120} closeDelay={80}>
	<HoverCard.Trigger class={className}>
		{#if children}
			{@render children()}
		{:else}
			<PersonAvatar {id} class="size-8" />
		{/if}
	</HoverCard.Trigger>
	<HoverCard.Content class="w-60" side="bottom" align="start">
		<div class="flex items-start gap-3">
			<PersonAvatar {id} class="size-11" dot />
			<div class="min-w-0 flex-1 space-y-1">
				<div class="text-sm font-semibold">{p.name}</div>
				<div class="text-xs text-muted-foreground">{p.role} · {p.pronouns}</div>
				<div class="truncate text-xs text-muted-foreground">{p.email}</div>
				<div class="text-xs text-muted-foreground">{p.tz} · currently {p.status}</div>
			</div>
		</div>
	</HoverCard.Content>
</HoverCard.Root>
