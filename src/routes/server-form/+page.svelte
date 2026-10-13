<script lang="ts">
	import { enhance } from '$app/forms';
	import Seo from '$lib/demo/seo.svelte';
	import Section from '$lib/demo/section.svelte';
	import CodeBlock from '$lib/demo/code-block.svelte';
	import {
		SuiForm,
		SuiInput,
		SuiSelect,
		SuiDatePicker,
		SuiCheckbox,
		SuiButton,
		createSuiForm,
		suiEnhance
	} from '$lib/sui/index.js';
	import { signupSchema } from './schema.js';
	import type { ActionData } from './$types';

	let { form: result }: { form: ActionData } = $props();

	// a no-JS failed post re-renders with the values + messages the action returned
	// (captured once on purpose: they seed the form's initial state)
	// svelte-ignore state_referenced_locally
	const form = createSuiForm(signupSchema, {
		initialValues: result && 'values' in result ? (result.values as never) : undefined,
		initialErrors: result && 'errors' in result ? result.errors : undefined
	});

	const code = `// +page.server.ts — the same schema, authoritative
const parsed = suiParseFormData(schema, await request.formData());
if (!parsed.ok) return fail(400, { errors: parsed.errors, values: parsed.values });

// +page.svelte — live client validation, progressive enhancement
const form = createSuiForm(schema, {
  initialValues: result?.values,   // no-JS failure keeps what was typed
  initialErrors: result?.errors    // …and shows the messages
});

<SuiForm {form} method="POST" action="?/signup" {@attach suiEnhance(form, enhance)}>
  <SuiInput field={form.fields.name} label="Name" required />
  …
</SuiForm>`;
</script>

<Seo path="/server-form" />

<h1 class="mb-8 text-3xl font-bold tracking-tight">Server form</h1>

<Section
	title="SvelteKit form action"
	description="Posts to a real +page.server.ts action. With JavaScript the client schema gates the request and the server's errors map back onto fields; with JavaScript disabled the browser posts natively and the page re-renders with the input and messages in place. Try taken@example.com."
>
	<div class="grid gap-6 lg:grid-cols-[1fr_18rem]">
		<SuiForm
			{form}
			method="POST"
			action="?/signup"
			showFormErrors
			class="grid max-w-xl gap-5"
			{@attach suiEnhance(form, enhance)}
		>
			<SuiInput field={form.fields.name} label="Name" required />
			<SuiInput field={form.fields.email} label="Email" type="email" required />
			<SuiSelect
				field={form.fields.plan}
				label="Plan"
				items={[
					{ value: 'free', label: 'Free' },
					{ value: 'pro', label: 'Pro' }
				]}
				required
			/>
			<SuiDatePicker field={form.fields.startDate} label="Start date" required />
			<SuiCheckbox field={form.fields.accept} label="I accept the terms" />
			<div>
				<SuiButton type="submit" loading={form.isSubmitting}>Create account</SuiButton>
			</div>
		</SuiForm>

		<div class="rounded-lg border bg-muted/30 p-4 text-sm">
			<p class="mb-2 font-medium">Server response</p>
			<!-- a scrollable region must be keyboard-reachable (WCAG 2.1.1) -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<pre tabindex="0" class="overflow-x-auto text-xs" data-testid="server-result">{result &&
				'saved' in result
					? JSON.stringify(result.saved, null, 2)
					: 'Submit the form to see what the action saved.'}</pre>
		</div>
	</div>
	<div class="mt-8">
		<CodeBlock {code} />
	</div>
</Section>
