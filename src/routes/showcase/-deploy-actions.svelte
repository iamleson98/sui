<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { SuiIconButton } from '$lib/sui/button/index.js';
	import type { Deployment } from './-data.svelte';

	import MoreHorizontalIcon from '@lucide/svelte/icons/more-horizontal';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';

	let {
		dep,
		onView,
		onRedeploy,
		onRollback
	}: {
		dep: Deployment;
		onView: (dep: Deployment) => void;
		onRedeploy: (dep: Deployment) => void;
		onRollback: (dep: Deployment) => void;
	} = $props();
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props: triggerProps })}
			<SuiIconButton
				icon={MoreHorizontalIcon}
				label={`Actions for ${dep.service} ${dep.version}`}
				size="xs"
				variant="ghost"
				{...triggerProps}
				onclick={(e: MouseEvent) => {
					// run the menu toggle, but keep the click from reaching the
					// table row's own onclick (opens the detail sheet)
					(triggerProps.onclick as ((ev: MouseEvent) => void) | undefined)?.(e);
					e.stopPropagation();
				}}
			/>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end" class="w-44">
		<DropdownMenu.Item inset onclick={() => onView(dep)}>
			<EyeIcon aria-hidden="true" />View details
		</DropdownMenu.Item>
		<DropdownMenu.Item inset onclick={() => onRedeploy(dep)}>
			<RefreshCwIcon aria-hidden="true" />Redeploy
		</DropdownMenu.Item>
		<DropdownMenu.Separator />
		<DropdownMenu.Item
			variant="destructive"
			inset
			disabled={dep.status !== 'success'}
			onclick={() => onRollback(dep)}
		>
			<RotateCcwIcon aria-hidden="true" />Rollback
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
