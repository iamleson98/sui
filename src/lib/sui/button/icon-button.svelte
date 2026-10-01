<script lang="ts">
	import { Button as UiButton, type ButtonSize as UiButtonSize } from '$lib/components/ui/button/index.js';
	import SuiIcon from '../sui-icon.svelte';
	import { SUI_ICON, SUI_SQUARE } from '../styles.js';
	import type { SuiIconComponent, SuiSize } from '../types.js';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	const SHADCN_SIZE: Record<SuiSize, UiButtonSize> = {
		xs: 'icon-xs',
		sm: 'icon-sm',
		md: 'icon',
		lg: 'icon-lg',
		xl: 'icon-lg'
	};

	type Props = {
		/** Icon rendered as the only content. */
		icon: SuiIconComponent;
		/** sui size — square, heights match all other sui controls. Default `md`. */
		size?: SuiSize;
		variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
		/** Accessible label (required — icon-only buttons must be named). */
		label: string;
		loading?: boolean;
		class?: string;
	} & HTMLButtonAttributes;

	let {
		icon,
		size = 'md',
		variant = 'ghost',
		label,
		loading = false,
		class: className = '',
		disabled,
		type = 'button',
		...rest
	}: Props = $props();

	const VARIANTS = {
		primary: 'default',
		secondary: 'secondary',
		outline: 'outline',
		ghost: 'ghost',
		destructive: 'destructive'
	} as const;
</script>

<UiButton
	variant={VARIANTS[variant]}
	size={SHADCN_SIZE[size]}
	{type}
	disabled={disabled || loading || undefined}
	aria-label={label}
	aria-busy={loading || undefined}
	data-sui-size={size}
	data-loading={loading || undefined}
	class="{SUI_SQUARE[size]} {className}"
	{...(rest as Record<string, unknown>)}
>
	{#if loading}
		<span
			class="animate-spin rounded-full border-2 border-current border-t-transparent {SUI_ICON[size]}"
			aria-hidden="true"
		></span>
	{:else}
		<SuiIcon {icon} {size} />
	{/if}
</UiButton>
