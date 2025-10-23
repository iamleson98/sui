<script lang="ts">
	import { debounceClick } from '$lib/actions/input-debounce.js';
	import { Icon, type IconContent } from '$lib/Icon/index.js';
	import { INPUT_BUTTON_SIZE_MAP, BUTTON_VARIANT_COLORS_MAP, type ButtonProps } from './types.js';

	type IconProps = {
		icon?: IconContent;
	};

	let {
		variant = 'filled',
		ref = $bindable(),
		type = 'button',
		color = 'blue',
		upper = false,
		size = 'md',
		radius = 'rounded-md',
		class: className = '',
		loading = false,
		fullWidth = false,
		href,
		children = noopChildren,
		startIcon,
		endIcon,
		disabled,
		clickDebounceOptions,
		...restProps
	}: ButtonProps = $props();

	let extraProps = $derived.by(() => {
		const res: Record<string, unknown> = {};

		if (href) {
			res.href = href;

			if (disabled !== undefined) {
				res['aria-disabled'] = disabled;
			}
		} else {
			res.disabled = disabled;
		}

		return res;
	});
</script>

{#snippet noopChildren()}
	<span></span>
{/snippet}

{#snippet buttonIcon({ icon }: IconProps)}
	{#if icon}
		<span class={`text-xl`}>
			<Icon {icon} {size} />
		</span>
	{/if}
{/snippet}

<svelte:element
	this={href ? 'a' : 'button'}
	bind:this={ref}
	class={[
		`button button-${size} ${className}`,
		INPUT_BUTTON_SIZE_MAP[size],
		radius,
		upper && 'uppercase',
		fullWidth && 'w-full',
		(!!disabled || loading) &&
			'!pointer-events-none !cursor-not-allowed !touch-none !bg-gray-200 !text-gray-500',
		!disabled && !loading && BUTTON_VARIANT_COLORS_MAP[variant][color]
	]}
	{type}
	use:debounceClick={clickDebounceOptions}
	{...restProps}
	{...extraProps}
>
	{#if loading}
		<div class="absolute inset-0 z-10 flex items-center justify-center">
			<span class="loading loading-dots loading-sm"></span>
		</div>
	{/if}
	{@render buttonIcon({ icon: startIcon })}
	{@render children()}
	{@render buttonIcon({ icon: endIcon })}
</svelte:element>

<style lang="postcss">
	@reference "tailwindcss";

	.button {
		@apply relative inline-flex grow-0 cursor-pointer appearance-none items-center justify-center gap-1.5 text-center leading-none font-medium whitespace-nowrap outline-hidden! transition-all duration-100 ease-in-out !select-none focus:ring-4;
		-webkit-tap-highlight-color: transparent;
	}
	.button-xs {
		@apply px-3;
	}
	.button-sm {
		@apply px-3;
	}
	.button-md {
		@apply px-5;
	}
	.button-lg {
		@apply px-5;
	}
	.button-xl {
		@apply px-6;
	}
</style>
