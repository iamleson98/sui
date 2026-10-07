<script lang="ts">
	import { Command as CommandPrimitive, useId } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import { containedScrollIntoView } from './contained-scroll-into-view.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		heading,
		value,
		...restProps
	}: CommandPrimitive.GroupProps & {
		heading?: string;
	} = $props();

	// bits-ui scrolls group headings into view when the first item of a group
	// is selected — contain that scroll to the command list (page-jump fix)
	let headingRef: HTMLElement | null = $state(null);
	$effect(() => {
		if (!headingRef) return;
		const release = containedScrollIntoView(headingRef);
		return () => release.destroy();
	});
</script>

<CommandPrimitive.Group
	bind:ref
	data-slot="command-group"
	class={cn(
		'overflow-hidden p-1 text-foreground **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-muted-foreground',
		className
	)}
	value={value ?? heading ?? `----${useId()}`}
	{...restProps}
>
	{#if heading}
		<CommandPrimitive.GroupHeading
			bind:ref={headingRef}
			class="px-2 py-1.5 text-xs font-medium text-muted-foreground"
		>
			{heading}
		</CommandPrimitive.GroupHeading>
	{/if}
	<CommandPrimitive.GroupItems {children} />
</CommandPrimitive.Group>
