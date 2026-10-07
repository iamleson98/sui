<script lang="ts">
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Command from '$lib/components/ui/command/index.js';

	let open = $state(false);
</script>

<Popover.Root bind:open>
	<Popover.Trigger
		id="pt"
		class="h-9 border px-3"
		aria-haspopup="listbox"
		aria-invalid={undefined}
		aria-describedby={undefined}
		onblur={() => {}}
	>
		Trigger label
	</Popover.Trigger>
	<Popover.Content class="z-50" style="--sui-trigger-width: 100px" align="start">
		<Command.Root data-test-cmd shouldFilter={true}>
			<Command.Input value="" placeholder="Search…" data-test-input />
			<Command.List class="max-h-64">
				<Command.Empty>No results</Command.Empty>
				<Command.Item value="nl" onSelect={() => {}}>Netherlands</Command.Item>
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
