<script lang="ts">
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import type { SuiFormInstance } from '#lib/sui/form/create-form.svelte.js';
	import DialogFormBody from './dialog-form-body.svelte';
	import GuardProbe from './guard-probe.svelte';
	import type { dialogFormSchema } from './form-schema.js';

	let { form }: { form: SuiFormInstance<typeof dialogFormSchema> } = $props();
</script>

<Dialog.Root open>
	<Dialog.Content data-testid="outer">
		<Dialog.Title>Outer</Dialog.Title>
		<GuardProbe name="outer" />
		<Dialog.Root open>
			<Dialog.Content data-testid="inner">
				<Dialog.Title>Inner</Dialog.Title>
				<GuardProbe name="inner" />
				<DialogFormBody {form} />
			</Dialog.Content>
		</Dialog.Root>
	</Dialog.Content>
</Dialog.Root>
