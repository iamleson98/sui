<script lang="ts">
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import { setSuiStrings } from '#lib/sui/strings.js';

	let { kind = 'dialog' }: { kind?: 'dialog' | 'sheet' } = $props();

	setSuiStrings({ close: 'Đóng' });
</script>

{#if kind === 'dialog'}
	<Dialog.Root open>
		<Dialog.Content>
			<Dialog.Title>Edit</Dialog.Title>
		</Dialog.Content>
	</Dialog.Root>
{:else}
	<Sheet.Root open>
		<Sheet.Content>
			<Sheet.Title>Edit</Sheet.Title>
		</Sheet.Content>
	</Sheet.Root>
{/if}
