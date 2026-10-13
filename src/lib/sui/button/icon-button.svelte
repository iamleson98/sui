<script lang="ts">
	import {
		Button as UiButton,
		type ButtonSize as UiButtonSize
	} from '$lib/components/ui/button/index.js';
	import SuiIcon from '../sui-icon.svelte';
	import { SUI_ICON, SUI_SQUARE, suiButtonColor } from '../styles.js';
	import type { SuiButtonColor, SuiIconComponent, SuiSize } from '../types.js';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

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
		/** Visual style — the same set as `SuiButton`. Default `ghost`. */
		variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
		/** Colour, combined with any `variant` — same palette as `SuiButton`'s `color`. */
		color?: SuiButtonColor;
		/** Accessible label (required — icon-only buttons must be named). */
		label: string;
		/** Spinner + blocked activation, focus kept (`aria-disabled`, see SuiButton). */
		loading?: boolean;
		class?: string;
		/** Render as an anchor with this href (like `SuiButton`). */
		href?: string;
		/** The rendered `<button>` / `<a>` element (bindable). */
		ref?: HTMLButtonElement | HTMLAnchorElement | null;
	} & HTMLButtonAttributes &
		HTMLAnchorAttributes;

	let {
		icon,
		size = 'md',
		variant = 'ghost',
		label,
		loading = false,
		class: className = '',
		disabled,
		type = 'button',
		href = undefined,
		ref = $bindable(null),
		onclick,
		color,
		style,
		...rest
	}: Props = $props();

	const tint = $derived(suiButtonColor(color, variant));

	const VARIANTS = {
		primary: 'default',
		secondary: 'secondary',
		outline: 'outline',
		ghost: 'ghost',
		destructive: 'destructive',
		link: 'link'
	} as const;
</script>

<UiButton
	bind:ref
	{href}
	variant={VARIANTS[variant]}
	size={SHADCN_SIZE[size]}
	type={href ? undefined : type}
	disabled={disabled || undefined}
	aria-disabled={loading || undefined}
	aria-label={label}
	aria-busy={loading || undefined}
	data-sui-size={size}
	data-loading={loading || undefined}
	class="{SUI_SQUARE[size]} {loading ? 'pointer-events-none opacity-50' : ''} {variant ===
		'destructive' && !color
		? 'text-red-700 dark:text-red-300'
		: ''} {tint.class} {className}"
	style={[tint.style, style].filter(Boolean).join(' ') || undefined}
	data-sui-color={color ? (tint.style ? 'custom' : color) : undefined}
	{...rest as Record<string, unknown>}
	onclick={(event: MouseEvent) => {
		if (loading) {
			event.preventDefault();
			return;
		}
		onclick?.(event as never);
	}}
>
	{#if loading}
		<span
			class="animate-spin rounded-full border-2 border-current border-t-transparent {SUI_ICON[
				size
			]}"
			aria-hidden="true"
		></span>
	{:else}
		<SuiIcon {icon} {size} />
	{/if}
</UiButton>
