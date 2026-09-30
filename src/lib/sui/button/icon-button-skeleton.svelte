<script lang="ts">
	import { SUI_SQUARE } from '../styles.js';
	import type { SuiSize } from '../types.js';
	import SuiSkeleton from '../skeleton/skeleton.svelte';

	let { size = 'md' }: { size?: SuiSize } = $props();
</script>

<SuiSkeleton
	data-sui-skeleton="icon-button"
	data-sui-size={size}
	class="rounded-md {SUI_SQUARE[size]}"
/>
