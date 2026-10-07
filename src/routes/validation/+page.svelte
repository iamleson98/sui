<script lang="ts">
	import Seo from '$lib/demo/seo.svelte';
	import { SuiInput, SuiTextarea } from '$lib/sui/input/index.js';
	import { SuiCheckbox } from '$lib/sui/checkbox/index.js';
	import { SuiRadioGroup } from '$lib/sui/radio-group/index.js';
	import { SuiSelect } from '$lib/sui/select/index.js';
	import { SuiButton } from '$lib/sui/button/index.js';
	import { SuiMultiSelect } from '$lib/sui/multi-select/index.js';
	import { SuiForm, createSuiForm, createSuiSubmitter } from '$lib/sui/form/index.js';
	import { SuiErrorSummary } from '$lib/sui/error-summary/index.js';
	import CodeBlock from '$lib/demo/code-block.svelte';
	import Section from '$lib/demo/section.svelte';
	import { z, ZodError } from 'zod';

	// --- form state ---
	let name = $state('');
	let email = $state('');
	let role = $state<string | undefined>(undefined);
	let plan = $state('pro');
	let bio = $state('');
	let accept = $state(false);
	let topics = $state<string[]>([]);

	const schema = z.object({
		name: z.string().min(2, 'Name must be at least 2 characters').max(40, 'Keep it under 40'),
		email: z.email('Enter a valid email'),
		role: z.enum(['admin', 'editor', 'viewer'], 'Pick a role'),
		plan: z.enum(['free', 'pro', 'enterprise']),
		bio: z.string().max(160, 'Bios are capped at 160 characters'),
		accept: z.literal(true, { error: 'Please accept the terms' }),
		topics: z.array(z.string()).min(1, 'Select at least one topic')
	});

	const roles = [
		{ value: 'admin', label: 'Admin', description: 'Full access to everything' },
		{ value: 'editor', label: 'Editor', description: 'Can write and publish' },
		{ value: 'viewer', label: 'Viewer', description: 'Read-only access' }
	];

	const topicsOptions = [
		{ value: 'svelte', label: 'Svelte' },
		{ value: 'ui', label: 'UI design' },
		{ value: 'testing', label: 'Testing' },
		{ value: 'performance', label: 'Performance' }
	];

	// --- manual wiring, submitter-orchestrated ---
	// One call replaces the whole hand-rolled handler: no candidate object,
	// no safeParse, no bind:this refs, no flattenError mapping, no focus
	// management. Controls register by `name`; the schema owns the rest.
	let submitted = $state<null | Record<string, unknown>>(null);
	const signup = createSuiSubmitter(schema, {
		onvalid: async (data) => {
			// simulate a server round-trip
			await new Promise((r) => setTimeout(r, 500));
			submitted = data;
		}
	});

	// --- timing showcase ---
	const timingSchema = z.string().min(4, 'At least 4 characters');
	let autoValue = $state('');
	let changeValue = $state('');
	let blurValue = $state('');

	// --- schema-driven form (createSuiForm) ---
	const accountSchema = z
		.object({
			name: z.string().min(2, 'Name must be at least 2 characters').max(40, 'Keep it under 40'),
			email: z.email('Enter a valid email'),
			password: z.string().min(8, 'Use at least 8 characters'),
			confirm: z.string(),
			role: z.enum(['admin', 'editor', 'viewer'], 'Pick a role'),
			topics: z.array(z.string()).min(1, 'Select at least one topic'),
			bio: z.string().max(160, 'Bios are capped at 160 characters').optional(),
			accept: z.literal(true, { error: 'Please accept the terms' })
		})
		.refine((d) => d.password === d.confirm, {
			path: ['confirm'],
			error: "Passwords don't match"
		});

	let accountResult = $state<z.output<typeof accountSchema> | null>(null);

	const accountForm = createSuiForm(accountSchema, {
		onsubmit: async (data) => {
			// simulate a server round-trip
			await new Promise((r) => setTimeout(r, 600));
			// simulate a server-side rejection: throw a ZodError and the form
			// maps it back onto the fields (no manual error parsing)
			if (data.email === 'taken@example.com') {
				throw new ZodError([
					{
						code: 'custom' as const,
						input: data.email,
						path: ['email'],
						message: 'That email is already registered.'
					}
				]);
			}
			accountResult = data;
		}
	});

	const formCode = `const schema = z.object({
  name: z.string().min(2),
  email: z.email(),
  password: z.string().min(8),
  confirm: z.string(),
  role: z.enum(['admin', 'editor', 'viewer'], 'Pick a role'),
  topics: z.array(z.string()).min(1),
  accept: z.literal(true)
}).refine((d) => d.password === d.confirm, {
  path: ['confirm'],
  error: "Passwords don't match"
});

// ONE call wires values, timing, error display and submit parsing
const form = createSuiForm(schema, {
  onsubmit: async (data) => await save(data) // zod-parsed + typed
});

<SuiForm {form}>
  <SuiInput field={form.fields.name} label="Name" required />
  <SuiSelect field={form.fields.role} items={roles} label="Role" />
  <SuiInput field={form.fields.password} label="Password" type="password" />
  <SuiCheckbox field={form.fields.accept} label="I accept the terms" />
  <SuiButton type="submit">Create account</SuiButton>
</SuiForm>

// reactive form state, server errors, programmatic control:
form.isValid                              // silent full-schema check
form.formErrors                           // root refine errors
form.setErrors({ email: ['Taken'] })      // cleared once the field is edited
form.reset()`;

	const code = `const schema = z.object({
  name: z.string().min(2).max(40),
  email: z.email(),
  role: z.enum(['admin', 'editor', 'viewer'], 'Pick a role'),
  topics: z.array(z.string()).min(1, 'Select at least one topic'),
  accept: z.literal(true, { error: 'Please accept the terms' })
});

// one call replaces the whole hand-rolled submit handler
const signup = createSuiSubmitter(schema, {
  onvalid: async (data) => await save(data) // zod-parsed + typed
});

<form onsubmit={signup.handleSubmit} novalidate>
  <!-- a name matching the schema key is all a control needs -->
  <SuiInput name="name" label="Name" bind:value={name} />
  <SuiSelect name="role" label="Role" items={roles} bind:value={role} />
  <SuiCheckbox name="accept" label="Accept" bind:checked={accept} />
  <SuiButton type="submit" loading={signup.isSubmitting}>Save</SuiButton>
</form>

// submit failure: every invalid field highlights at once, focus lands on
// the first problem, and editing a field clears its error instantly

// standalone fields keep working per-control (see "Validation timing" below):
<SuiInput label="Bio" schema={schema.shape.bio} bind:value={bio} />`;
</script>

<Seo path="/validation" />

<h1 class="mb-8 text-3xl font-bold tracking-tight">zod v4 Validation</h1>

<Section
	title="Schema-driven forms — createSuiForm"
	description="One zod schema wires the whole form — no safeParse, no flattenError, no per-field error props, no bind:this refs. Text fields stay quiet until the first blur, then validate on every keystroke; pickers validate on selection; the password/confirm refinement stays fresh without unmasking pristine fields. A failed submit reveals every error at once and focus lands on the first problem. Try taken@example.com to watch a server-side ZodError map back onto the email field — then edit it and watch the error clear."
>
	<div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
		<SuiForm form={accountForm} class="grid max-w-xl gap-5">
			{#if accountForm.errorSummary.length}
				<SuiErrorSummary errors={accountForm.errorSummary} id="account-error-summary" />
			{/if}
			<SuiInput
				field={accountForm.fields.name}
				label="Name"
				placeholder="Ada Lovelace"
				autocomplete="name"
				required
			/>
			<SuiInput
				field={accountForm.fields.email}
				label="Email"
				type="email"
				placeholder="ada@example.com (try taken@example.com)"
				autocomplete="email"
				required
			/>
			<SuiSelect
				field={accountForm.fields.role}
				label="Role"
				placeholder="Choose a role…"
				items={roles}
				required
			/>
			<div class="grid gap-5 sm:grid-cols-2">
				<SuiInput
					field={accountForm.fields.password}
					label="Password"
					type="password"
					placeholder="At least 8 characters"
					autocomplete="new-password"
					required
				/>
				<SuiInput
					field={accountForm.fields.confirm}
					label="Confirm password"
					type="password"
					autocomplete="new-password"
					required
				/>
			</div>
			<SuiMultiSelect
				field={accountForm.fields.topics}
				label="Topics"
				placeholder="Pick topics…"
				items={topicsOptions}
				required
			/>
			<SuiTextarea
				field={accountForm.fields.bio}
				label="Bio"
				placeholder="Optional…"
				rows={3}
				subText="Up to 160 characters."
			/>
			<SuiCheckbox
				field={accountForm.fields.accept}
				label="I accept the terms and conditions"
				required
			/>
			<div class="flex items-center gap-3">
				<SuiButton type="submit" loading={accountForm.isSubmitting}>Create account</SuiButton>
				<SuiButton
					variant="ghost"
					onclick={() => {
						accountForm.reset();
						accountResult = null;
					}}
				>
					Reset
				</SuiButton>
			</div>
		</SuiForm>

		<aside class="rounded-lg border bg-muted/40 p-4">
			<h3 class="mb-2 text-sm font-semibold">Parsed result</h3>
			{#if accountResult}
				<pre class="overflow-x-auto text-xs leading-relaxed">{JSON.stringify(
						accountResult,
						null,
						2
					)}</pre>
			{:else}
				<p class="text-xs text-muted-foreground">
					The onsubmit callback receives the zod-parsed, typed payload — transforms included. No
					manual parsing anywhere.
				</p>
			{/if}
			<dl class="mt-4 space-y-1 text-xs text-muted-foreground">
				<div class="flex justify-between">
					<dt>isValid (silent)</dt>
					<dd>{String(accountForm.isValid)}</dd>
				</div>
				<div class="flex justify-between">
					<dt>submitCount</dt>
					<dd>{accountForm.submitCount}</dd>
				</div>
				<div class="flex justify-between">
					<dt>isSubmitting</dt>
					<dd>{String(accountForm.isSubmitting)}</dd>
				</div>
			</dl>
		</aside>
	</div>
	<div class="mt-8">
		<CodeBlock title="createSuiForm" code={formCode} />
	</div>
</Section>

<Section
	title="Per-field schemas — manual wiring"
	description="Keep your own bind:value state and let a form-level submitter orchestrate the rest: each control takes a name matching the schema, createSuiSubmitter collects values, parses, maps issues onto fields, lands focus on the first problem and hands you typed data — no candidate object, no safeParse, no refs, no flattenError. A failed submit highlights every invalid field; fixing one clears it instantly without re-submitting. Prefer createSuiForm above when the form engine can own the values."
>
	<div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
		<form class="grid max-w-xl gap-5" onsubmit={signup.handleSubmit} novalidate>
			<SuiInput
				name="name"
				label="Name"
				placeholder="Ada Lovelace"
				autocomplete="name"
				bind:value={name}
				required
			/>
			<SuiInput
				name="email"
				label="Email"
				type="email"
				placeholder="ada@example.com"
				autocomplete="email"
				bind:value={email}
				required
			/>
			<SuiSelect
				name="role"
				label="Role"
				placeholder="Choose a role…"
				items={roles}
				bind:value={role}
				required
			/>
			<SuiRadioGroup
				label="Plan"
				items={[
					{ value: 'free', label: 'Hobby' },
					{ value: 'pro', label: 'Pro' },
					{ value: 'enterprise', label: 'Enterprise' }
				]}
				name="plan"
				bind:value={plan}
			/>
			<SuiMultiSelect
				name="topics"
				label="Topics"
				placeholder="Pick topics…"
				items={topicsOptions}
				bind:value={topics}
				required
			/>
			<SuiTextarea
				name="bio"
				label="Bio"
				placeholder="Optional…"
				bind:value={bio}
				rows={3}
				subText="Up to 160 characters."
			/>
			<SuiCheckbox
				name="accept"
				label="I accept the terms and conditions"
				bind:checked={accept}
				required
			/>
			<div class="flex items-center gap-3">
				<SuiButton type="submit" loading={signup.isSubmitting}>Create account</SuiButton>
				<SuiButton
					variant="ghost"
					onclick={() => {
						submitted = null;
					}}>Reset output</SuiButton
				>
			</div>
		</form>

		<aside class="rounded-lg border bg-muted/40 p-4">
			<h3 class="mb-2 text-sm font-semibold">Parsed result</h3>
			{#if submitted}
				<pre class="overflow-x-auto text-xs leading-relaxed">{JSON.stringify(
						submitted,
						null,
						2
					)}</pre>
			{:else}
				<p class="text-xs text-muted-foreground">
					Submit the form to see the zod-parsed payload. Invalid fields highlight in red with inline
					messages.
				</p>
			{/if}
		</aside>
	</div>
	<div class="mt-8">
		<CodeBlock title="schema + fields" {code} />
	</div>
</Section>

<Section
	title="Validation timing"
	description="When does a field run its schema? Try each mode: type a short value, Tab away, keep typing. auto stays quiet during the first pass and turns eager after the first blur — the pattern recommended by Baymard's inline-validation research and matched by react-hook-form's onTouched and superforms' auto."
>
	<div class="grid max-w-xl gap-5">
		<SuiInput
			label="auto — blur first, then eager"
			subText="Quiet while you type the first answer; validates on blur; every keystroke after that."
			placeholder="Type at least 4 characters, Tab away, keep typing…"
			schema={timingSchema}
			bind:value={autoValue}
		/>
		<SuiInput
			label="change — every keystroke"
			subText="Instant feedback, including mid-word."
			validateOn="change"
			placeholder="Type at least 4 characters…"
			schema={timingSchema}
			bind:value={changeValue}
		/>
		<SuiInput
			label="blur — only on exit"
			subText="Never interrupts; checks once when you leave the field."
			validateOn="blur"
			placeholder="Type anything, then Tab away…"
			schema={timingSchema}
			bind:value={blurValue}
		/>
	</div>
</Section>
