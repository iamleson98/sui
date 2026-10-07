<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { HTMLFormAttributes } from 'svelte/elements';
	import type { ZodType } from 'zod';
	import type { SuiFormInstance } from './create-form.svelte.js';

	export type SuiFormProps<Schema extends ZodType> = Omit<
		HTMLFormAttributes,
		'class' | 'onsubmit'
	> & {
		/** The schema-driven form instance (see `createSuiForm`). */
		form: SuiFormInstance<Schema>;
		/** Form content — the wired sui controls and the submit button. */
		children: Snippet;
		class?: string;
	};
</script>

<script lang="ts" generics="Schema extends ZodType">
	import { tick } from 'svelte';
	import { focusFirstInvalid } from './utils.js';
	import { suiMobileQuery } from '../mobile.svelte.js';

	let { form, class: className = '', children, ...rest }: SuiFormProps<Schema> = $props();

	const isMobile = suiMobileQuery();

	async function submit(event: SubmitEvent & { currentTarget: EventTarget & HTMLFormElement }) {
		// currentTarget is only populated during dispatch — capture before awaiting
		const formEl = event.currentTarget;
		const ok = await form.handleSubmit(event);
		if (ok) return;
		// let the DOM settle so fresh data-invalid attributes are painted
		await tick();
		if (isMobile.current) {
			// focusing on touch devices opens the on-screen keyboard and
			// shifts the viewport away from the message — scroll instead
			// (superforms `autoFocusOnError: 'detect'` behaviour)
			formEl
				.querySelector('[data-invalid]')
				?.scrollIntoView({ block: 'center', behavior: 'smooth' });
		} else {
			// WCAG 3.3.1: land keyboard and screen-reader users on the first problem
			focusFirstInvalid(formEl);
		}
	}
</script>

<!-- novalidate: the zod schema owns validation, not the Constraint Validation API -->
<form novalidate class={className} onsubmit={submit} data-sui-form {...rest}>
	{@render children()}
</form>
