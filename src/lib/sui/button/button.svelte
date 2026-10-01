<script lang="ts">
	import { Button as UiButton, type ButtonSize as UiButtonSize } from '$lib/components/ui/button/index.js';
	import SuiIcon from '../sui-icon.svelte';
	import { SUI_CONTROL, SUI_ICON } from '../styles.js';
	import type { SuiIconComponent, SuiSize } from '../types.js';
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
		/** sui size — heights match all other sui controls. Default `md`. */
		size?: SuiSize;
		/** Icon component rendered before the content. */
		startIcon?: SuiIconComponent;
		/** Icon component rendered after the content. */
		endIcon?: SuiIconComponent;
		/** Renders a spinner and disables interaction. */
		loading?: boolean;
		/** Stretch to the full width of the container. */
		fullWidth?: boolean;
		/** Render as an anchor with this href. */
		href?: string;
		/** Extra classes appended to the button. */
		class?: string;
		/** Button content. */
		children?: Snippet;
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
		...rest
	}: Props = $props();

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
	{href}
	variant={VARIANTS[variant]}
	size={SHADCN_SIZE[size]}
	type={href ? undefined : type}
	disabled={disabled || loading || undefined}
	aria-busy={loading || undefined}
	data-sui-size={size}
	data-loading={loading || undefined}
	class="{SUI_CONTROL[size]} {fullWidth ? 'w-full' : ''} {className}"
	{...(rest as Record<string, unknown>)}
>
	{#if loading}
		<span
			class="animate-spin rounded-full border-2 border-current border-t-transparent {SUI_ICON[size]}"
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
