<script lang="ts">
	import { useDismissGuard } from '#lib/hooks/dismiss-guard.svelte.js';

	// shows what the nearest overlay's guard says, for tests that cannot
	// reach the guard object itself
	let { name }: { name: string } = $props();
	const guard = useDismissGuard();
</script>

<p data-testid="guard-{name}">{guard ? (guard.busy ? 'busy' : 'idle') : 'none'}</p>
