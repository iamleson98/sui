<script lang="ts">
	import { TablerChevronDown, TablerChevronUp } from '$lib/Icon/consts.js';
	import type { AccordionProps } from './types.js';
	import { slide } from 'svelte/transition';
	import { Icon } from '$lib/Icon/index.js';

	let {
		header,
		class: className = '',
		children,
		open = $bindable(true),
		fixed = false,
		headerIcon
	}: AccordionProps = $props();

	const toggle = () => {
		if (!fixed) open = !open;
	};
</script>

<div class={`${className} rounded-lg text-gray-800`}>
	<div
		class="flex cursor-pointer items-center justify-between select-none"
		role="button"
		tabindex="0"
		onclick={toggle}
		onkeyup={(evt) => evt.key === 'Enter' && toggle()}
	>
		<div class="flex items-center text-sm font-semibold">
			{#if headerIcon}
				<Icon icon={headerIcon} class="mr-2" />
			{/if}
			<div>
				{#if typeof header === 'string'}
					{header}
				{:else}
					{@render header()}
				{/if}
			</div>
		</div>
		<div>
			<Icon icon={open ? TablerChevronUp : TablerChevronDown} />
		</div>
	</div>

	{#if open}
		<div transition:slide class="mt-4">
			{@render children()}
		</div>
	{/if}
</div>
