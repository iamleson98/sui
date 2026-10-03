<script lang="ts">
	import PersonAvatar from './-person-avatar.svelte';
	import PersonHover from './-person-hover.svelte';
	import { person } from './-data.svelte';

	let { authorId }: { authorId: string } = $props();
</script>

<span class="inline-flex items-center gap-2">
	<PersonHover id={authorId}>
		<span><PersonAvatar id={authorId} class="size-5" /></span>
	</PersonHover>
	<span class="truncate">{person(authorId).name}</span>
</span>
