<script lang="ts">
	import { debounceInput } from '$lib/actions/input-debounce.js';
	import { shortcuts } from '$lib/actions/shortcut.js';
	import { Icon } from '$lib/Icon/index.js';
	import { randomID } from '$lib/utils/consts.js';
	import { TEXT_AREA_SIZE_MAP } from './input.types.js';
	import { INPUT_CLASSES, type InputProps } from './input.types.js';
	import Label from './label.svelte';
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	let {
		label,
		id = randomID(),
		placeholder = 'Please provide value',
		variant = 'info',
		subText,
		startIcon,
		class: className = '',
		size = 'md',
		action,
		ref = $bindable<HTMLInputElement | HTMLTextAreaElement>(),
		inputDebounceOption,
		selectShortcutOptions = [],
		value = $bindable<string | number>(),
		required,
		inputClass = '',
		...rest
	}: InputProps & HTMLTextareaAttributes = $props();
</script>

<div class={`${className}`}>
	{#if label}
		<Label {label} {id} {required} {size} {variant} requiredAtPos="end" />
	{/if}
	<div class={`${INPUT_CLASSES[variant].fg}`}>
		<div class={`relative`}>
			{#if startIcon}
				<div class="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-2.5">
					<Icon icon={startIcon} />
				</div>
			{/if}

			<textarea
				bind:this={ref}
				{id}
				{placeholder}
				{required}
				bind:value
				use:shortcuts={selectShortcutOptions}
				use:debounceInput={inputDebounceOption}
				class={[
					rest.disabled && 'cursor-not-allowed! text-gray-400!',
					'inline-block field-sizing-content w-full rounded-lg px-2.5 py-1 text-sm ring-1 transition-all duration-200 ease-in-out outline-none! placeholder:opacity-55 hover:ring-2 focus:ring-2',
					inputClass,
					INPUT_CLASSES[variant].bg,
					startIcon && 'ps-8',
					TEXT_AREA_SIZE_MAP[size]
				]}
				{...rest}
			></textarea>

			{#if action}
				<div class="input-action absolute end-2 top-1/2 -translate-y-1/2 transform">
					{@render action()}
				</div>
			{/if}
		</div>
		{#if subText}
			<div class={`text-right! text-[10px]`}>{subText}</div>
		{/if}
	</div>
</div>

<style lang="postcss">
	@reference "tailwindcss";

	.input-action > * {
		@apply max-h-full max-w-full;
	}
</style>
