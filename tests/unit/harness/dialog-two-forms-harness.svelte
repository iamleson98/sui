<script lang="ts">
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import type { SuiFormInstance } from '#lib/sui/form/create-form.svelte.js';
	import DialogFormBody from './dialog-form-body.svelte';
	import GuardProbe from './guard-probe.svelte';
	import type { dialogFormSchema } from './form-schema.js';

	type Form = SuiFormInstance<typeof dialogFormSchema>;
	let {
		first,
		second,
		showFirst = true,
		showSecond = true
	}: {
		first: Form;
		second: Form;
		/** Unmounting a form while it saves must hand its hold back. */
		showFirst?: boolean;
		showSecond?: boolean;
	} = $props();
</script>

<Dialog.Root open>
	<Dialog.Content>
		<Dialog.Title>Edit</Dialog.Title>
		<GuardProbe name="dialog" />
		{#if showFirst}
			<DialogFormBody form={first} suffix=" A" />
		{/if}
		{#if showSecond}
			<DialogFormBody form={second} suffix=" B" />
		{/if}
	</Dialog.Content>
</Dialog.Root>
