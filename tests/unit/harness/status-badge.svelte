<script lang="ts">
	import Badge from '$lib/components/ui/badge/badge.svelte';

	let { status }: { status: 'single' | 'complicated' } = $props();
</script>

<Badge data-testid="status-badge" variant="secondary">{status}</Badge>
