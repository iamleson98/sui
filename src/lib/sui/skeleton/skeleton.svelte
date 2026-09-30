<script lang="ts">
	import { cn } from '$lib/utils.js';

	type Props = {
		class?: string;
		/** Render as a circle instead of rounded corners. */
		rounded?: boolean;
		/** Disable the pulse animation (e.g. for static layouts). */
		animated?: boolean;
		[key: string]: unknown;
	};

	let {
		class: className = '',
		rounded = false,
		animated = true,
		...rest
	}: Props = $props();
</script>

<div
	aria-hidden="true"
	data-sui-skeleton
	data-animated={animated || undefined}
	class={cn('bg-accent animate-pulse', rounded ? 'rounded-full' : 'rounded-md', animated || 'animate-none', className)}
	{...rest}
></div>
