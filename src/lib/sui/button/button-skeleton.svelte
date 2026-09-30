<script lang="ts">
	import { SUI_CONTROL, SUI_SKELETON_W, SUI_SQUARE } from '../styles.js';
	import type { SuiSize } from '../types.js';
	import SuiSkeleton from '../skeleton/skeleton.svelte';

	let {
		size = 'md',
		fullWidth = false
	}: { size?: SuiSize; fullWidth?: boolean } = $props();
</script>

<SuiSkeleton
	data-sui-skeleton="button"
	data-sui-size={size}
	class="{SUI_CONTROL[size]} {SUI_SKELETON_W[size]} {fullWidth ? 'w-full' : ''}"
/>
