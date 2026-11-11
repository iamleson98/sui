<script lang="ts">
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.js';
	import type { SuiFormInstance } from '#lib/sui/form/create-form.svelte.js';
	import DialogFormBody from './dialog-form-body.svelte';
	import type { dialogFormSchema } from './form-schema.js';

	let {
		form,
		kind = 'dialog',
		open = $bindable(true),
		escapeKeydownBehavior,
		onEscapeKeydown,
		onInteractOutside
	}: {
		form: SuiFormInstance<typeof dialogFormSchema>;
		/** `plain` puts the form on the page, outside any overlay. */
		kind?: 'dialog' | 'sheet' | 'alert' | 'plain';
		open?: boolean;
		/** A caller's own value, which must survive while nothing is saving. */
		escapeKeydownBehavior?: 'close' | 'ignore';
		/** A caller's own event hooks on the Content component. */
		onEscapeKeydown?: (event: KeyboardEvent) => void;
		onInteractOutside?: (event: Event) => void;
	} = $props();
</script>

{#if kind === 'dialog'}
	<Dialog.Root bind:open>
		<Dialog.Content {escapeKeydownBehavior} {onEscapeKeydown} {onInteractOutside}>
			<Dialog.Title>Edit</Dialog.Title>
			<DialogFormBody {form} />
		</Dialog.Content>
	</Dialog.Root>
{:else if kind === 'sheet'}
	<Sheet.Root bind:open>
		<Sheet.Content {escapeKeydownBehavior} {onEscapeKeydown} {onInteractOutside}>
			<Sheet.Title>Edit</Sheet.Title>
			<DialogFormBody {form} />
		</Sheet.Content>
	</Sheet.Root>
{:else if kind === 'alert'}
	<AlertDialog.Root bind:open>
		<AlertDialog.Content {escapeKeydownBehavior} {onEscapeKeydown} {onInteractOutside}>
			<AlertDialog.Title>Edit</AlertDialog.Title>
			<DialogFormBody {form} />
		</AlertDialog.Content>
	</AlertDialog.Root>
{:else}
	<DialogFormBody {form} />
{/if}
<p data-testid="state">{open ? 'open' : 'closed'}</p>
