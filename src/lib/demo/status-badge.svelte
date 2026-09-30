<script lang="ts">
	import Badge from '$lib/components/ui/badge/badge.svelte';

	let { status }: { status: 'single' | 'relationship' | 'complicated' } = $props();

	const STYLES: Record<string, string> = {
		single: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-transparent',
		relationship: 'bg-green-500/10 text-green-600 dark:text-green-400 border-transparent',
		complicated: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-transparent'
	};
</script>

<Badge class="text-xs {STYLES[status]}">{status}</Badge>
