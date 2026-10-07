<script lang="ts">
	import PersonAvatar from './-person-avatar.svelte';
	import PersonHover from './-person-hover.svelte';
	import { person } from './-data.svelte';

	/** Overlapping avatar stack with a +n overflow bubble. */
	let {
		ids,
		max = 3,
		class: className = ''
	}: { ids: string[]; max?: number; class?: string } = $props();

	const shown = $derived(ids.slice(0, max));
	const rest = $derived(ids.slice(max));
</script>

{#if ids.length > 0}
	<div class="flex items-center {className}">
		{#each shown as id, i (id)}
			<PersonHover {id} class={i > 0 ? '-ml-1.5' : ''}>
				<span class="rounded-full ring-2 ring-card">
					<PersonAvatar {id} class="size-6" />
				</span>
			</PersonHover>
		{/each}
		{#if rest.length > 0}
			<span
				class="-ml-1.5 flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card"
				title={rest.map((r) => person(r).name).join(', ')}
			>
				+{rest.length}
			</span>
		{/if}
	</div>
{/if}
