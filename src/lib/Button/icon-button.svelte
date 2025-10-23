<script lang="ts">
	import { Icon, type IconContent } from '$lib/Icon/index.js';
	import Button from './button.svelte';
	import { ICON_BTN_SIZE_MAP } from './types.js';
	import type { ButtonProps } from './types.js';

	type Props = { icon: IconContent; rounded?: boolean } & Omit<
		ButtonProps,
		'startIcon' | 'endIcon' | 'upper' | 'fullWidth' | 'radius'
	>;

	let {
		icon,
		rounded = false,
		children,
		class: className = '',
		size = 'md',
		...rest
	}: Props = $props();
</script>

<Button
	{...rest}
	{size}
	class={`${className} ${ICON_BTN_SIZE_MAP[size]} ${rounded ? 'rounded-full!' : ''}`}
	style="padding: unset !important;"
>
	<Icon {icon} {size} />
	{#if children}
		{@render children()}
	{/if}
</Button>
