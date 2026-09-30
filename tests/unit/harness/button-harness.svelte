<script lang="ts">
	import SuiButton from '$lib/sui/button/button.svelte';
	import type { SuiSize } from '$lib/sui/types';
	import type { SuiIconComponent } from '$lib/sui/types';

	let {
		label = 'Click me',
		size = 'md',
		variant = 'primary',
		loading = false,
		startIcon,
		endIcon,
		href,
		onclick
	}: {
		label?: string;
		size?: SuiSize;
		variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
		loading?: boolean;
		startIcon?: SuiIconComponent;
		endIcon?: SuiIconComponent;
		href?: string;
		onclick?: () => void;
	} = $props();
</script>

<SuiButton {size} {variant} {loading} {startIcon} {endIcon} {href} {onclick}>{label}</SuiButton>
