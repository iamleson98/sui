<script lang="ts">
	import {
		Button as UiButton,
		type ButtonSize as UiButtonSize
	} from '$lib/components/ui/button/index.js';
	import SuiIcon from '../sui-icon.svelte';
	import { SUI_CONTROL, SUI_ICON, suiButtonColor } from '../styles.js';
	import type { SuiButtonColor, SuiIconComponent, SuiSize } from '../types.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	/** Maps sui sizes onto the shadcn-svelte button size scale. */
	const SHADCN_SIZE: Record<SuiSize, UiButtonSize> = {
		xs: 'xs',
		sm: 'sm',
		md: 'default',
		lg: 'lg',
		xl: 'lg'
	};

	type Props = {
		/** Visual style. */
		variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
		/**
		 * Colour, combined with any `variant`: a semantic colour (`info`,
		 * `success`, `warning`, `error`) or any CSS colour (`'#7c3aed'`,
		 * `'var(--brand)'`) — solid fill, tinted secondary, coloured outline /
		 * ghost / link, light and dark mode. Default: the theme's neutral.
		 */
		color?: SuiButtonColor;
		/** sui size — heights match all other sui controls. Default `md`. */
		size?: SuiSize;
		/** Icon component rendered before the content. */
		startIcon?: SuiIconComponent;
		/** Icon component rendered after the content. */
		endIcon?: SuiIconComponent;
		/**
		 * Renders a spinner and blocks activation (no double submits) while
		 * keeping focus on the button — `aria-disabled`, not `disabled`,
		 * which would drop keyboard/screen-reader focus to `<body>`.
		 */
		loading?: boolean;
		/** Stretch to the full width of the container. */
		fullWidth?: boolean;
		/** Render as an anchor with this href. */
		href?: string;
		/** Extra classes appended to the button. */
		class?: string;
		/** Button content. */
		children?: Snippet;
		/** The rendered `<button>` / `<a>` element (bindable). */
		ref?: HTMLButtonElement | HTMLAnchorElement | null;
	} & HTMLButtonAttributes &
		HTMLAnchorAttributes;

	let {
		variant = 'primary',
		size = 'md',
		startIcon,
		endIcon,
		loading = false,
		fullWidth = false,
		href = undefined,
		class: className = '',
		children,
		disabled,
		type = 'button',
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
	aria-busy={loading || undefined}
	data-sui-size={size}
	data-loading={loading || undefined}
	class="{SUI_CONTROL[size]} {fullWidth ? 'w-full' : ''} {loading
		? 'pointer-events-none opacity-50'
		: ''} {tint.class} {className}"
	style={[tint.style, style].filter(Boolean).join(' ') || undefined}
	data-sui-color={color ? (tint.style ? 'custom' : color) : undefined}
	{...rest as Record<string, unknown>}
	onclick={(event: MouseEvent) => {
		// a pending action can't be re-triggered (keyboard activation and
		// implicit form submission still dispatch `click`)
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
		{#if startIcon}
			<SuiIcon icon={startIcon} {size} />
		{/if}
	{/if}
	{@render children?.()}
	{#if !loading && endIcon}
		<SuiIcon icon={endIcon} {size} />
	{/if}
</UiButton>
