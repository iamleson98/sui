<script lang="ts">
        import Seo from '$lib/demo/seo.svelte';
        import { SuiInput, SuiTextarea } from '$lib/sui/input/index.js';
        import { SuiCheckbox } from '$lib/sui/checkbox/index.js';
        import { SuiRadioGroup } from '$lib/sui/radio-group/index.js';
        import { SuiSelect } from '$lib/sui/select/index.js';
        import { SuiButton } from '$lib/sui/button/index.js';
        import { SuiMultiSelect } from '$lib/sui/multi-select/index.js';
        import { SuiForm, createSuiForm } from '$lib/sui/form/index.js';
        import { SuiErrorSummary } from '$lib/sui/error-summary/index.js';
        import { focusFirstInvalid } from '$lib/sui/form/utils';
        import CodeBlock from '$lib/demo/code-block.svelte';
        import Section from '$lib/demo/section.svelte';
        import { z, ZodError } from 'zod';
        import { tick } from 'svelte';

        // --- form state ---
        let name = $state('');
        let email = $state('');
        let role = $state<string | undefined>(undefined);
        let plan = $state('pro');
        let bio = $state('');
        let accept = $state(false);
        let topics = $state<string[]>([]);
        let submitted = $state<null | Record<string, unknown>>(null);
        let serverErrors = $state<Record<string, string[]>>({});

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

        // component refs to force-validate on submit (components are valid types in Svelte 5)
        let nameRef: SuiInput | undefined = $state();
        let emailRef: SuiInput | undefined = $state();
        let roleRef: SuiSelect | undefined = $state();
        let acceptRef: SuiCheckbox | undefined = $state();
        let formEl = $state<HTMLFormElement | null>(null);

        async function submit(event: SubmitEvent) {
                event.preventDefault();
                const candidate = { name, email, role, plan, bio, accept, topics };
                const result = schema.safeParse(candidate);
                nameRef?.validate();
                emailRef?.validate();
                roleRef?.validate();
                acceptRef?.validate();
                if (!result.success) {
                        const flat = z.flattenError(result.error);
                        serverErrors = flat.fieldErrors as Record<string, string[]>;
                        // let the DOM settle (data-invalid attributes) before moving focus
                        await tick();
                        // WCAG 3.3.1: land keyboard/screen-reader users on the first problem
                        focusFirstInvalid((event.currentTarget as HTMLFormElement) ?? formEl!);
                        return;
                }
                // simulate server round-trip
                await new Promise((r) => setTimeout(r, 500));
                submitted = result.data;
        }

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
                                        { code: 'custom' as const, input: data.email, path: ['email'], message: 'That email is already registered.' }
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

// per-field: just pass the matching slice of the schema
<SuiInput label="Name" schema={schema.shape.name} bind:value={name} />
<SuiSelect label="Role" items={roles} schema={schema.shape.role} bind:value={role} />
<SuiCheckbox label="Accept" schema={schema.shape.accept} bind:checked={accept} />

// validation timing (validateOn):
// 'auto'  — blur first, then every keystroke   (text fields, default)
// 'both'  — change + blur                      (pickers/toggles, default)
// 'change' | 'blur' | 'none'                   (explicit control)

// on submit: force every field, then move focus to the first problem
const result = schema.safeParse(candidate);
if (!result.success) focusFirstInvalid(formEl);`;
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

                <aside class="bg-muted/40 rounded-lg border p-4">
                        <h3 class="mb-2 text-sm font-semibold">Parsed result</h3>
                        {#if accountResult}
                                <pre class="overflow-x-auto text-xs leading-relaxed">{JSON.stringify(accountResult, null, 2)}</pre>
                        {:else}
                                <p class="text-muted-foreground text-xs">
                                        The onsubmit callback receives the zod-parsed, typed payload — transforms
                                        included. No manual parsing anywhere.
                                </p>
                        {/if}
                        <dl class="text-muted-foreground mt-4 space-y-1 text-xs">
                                <div class="flex justify-between"><dt>isValid (silent)</dt><dd>{String(accountForm.isValid)}</dd></div>
                                <div class="flex justify-between"><dt>submitCount</dt><dd>{accountForm.submitCount}</dd></div>
                                <div class="flex justify-between"><dt>isSubmitting</dt><dd>{String(accountForm.isSubmitting)}</dd></div>
                        </dl>
                </aside>
        </div>
        <div class="mt-8">
                <CodeBlock title="createSuiForm" code={formCode} />
        </div>
</Section>

<Section
        title="Per-field schemas — manual wiring"
        description="Every sui form control also takes a zod v4 schema directly. Text fields validate on the first blur, then on every keystroke (validateOn 'auto'); pickers and toggles validate on every change and blur (validateOn 'both'). After a failed submit, fixing a field clears its error immediately — no re-submit needed — and focus lands on the first problem. Prefer createSuiForm above: this section is the same form wired by hand."
>
        <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <form class="grid max-w-xl gap-5" bind:this={formEl} onsubmit={submit} novalidate>
                        <SuiInput
                                bind:this={nameRef}
                                label="Name"
                                placeholder="Ada Lovelace"
                                autocomplete="name"
                                schema={schema.shape.name}
                                errors={serverErrors.name}
                                bind:value={name}
                                required
                        />
                        <SuiInput
                                bind:this={emailRef}
                                label="Email"
                                type="email"
                                placeholder="ada@example.com"
                                autocomplete="email"
                                schema={schema.shape.email}
                                errors={serverErrors.email}
                                bind:value={email}
                                required
                        />
                        <SuiSelect
                                bind:this={roleRef}
                                label="Role"
                                placeholder="Choose a role…"
                                items={roles}
                                schema={schema.shape.role}
                                errors={serverErrors.role}
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
                                bind:value={plan}
                        />
                        <SuiMultiSelect
                                label="Topics"
                                placeholder="Pick topics…"
                                items={topicsOptions}
                                schema={schema.shape.topics}
                                errors={serverErrors.topics}
                                bind:value={topics}
                                required
                        />
                        <SuiTextarea label="Bio" placeholder="Optional…" schema={schema.shape.bio} bind:value={bio} rows={3} subText="Up to 160 characters." />
                        <SuiCheckbox
                                bind:this={acceptRef}
                                label="I accept the terms and conditions"
                                schema={schema.shape.accept}
                                errors={serverErrors.accept}
                                bind:checked={accept}
                                required
                        />
                        <div class="flex items-center gap-3">
                                <SuiButton type="submit">Create account</SuiButton>
                                <SuiButton variant="ghost" onclick={() => { submitted = null; serverErrors = {}; }}>Reset output</SuiButton>
                        </div>
                </form>

                <aside class="bg-muted/40 rounded-lg border p-4">
                        <h3 class="mb-2 text-sm font-semibold">Parsed result</h3>
                        {#if submitted}
                                <pre class="overflow-x-auto text-xs leading-relaxed">{JSON.stringify(submitted, null, 2)}</pre>
                        {:else}
                                <p class="text-muted-foreground text-xs">Submit the form to see the zod-parsed payload. Invalid fields highlight in red with inline messages.</p>
                        {/if}
                </aside>
        </div>
        <div class="mt-8">
                <CodeBlock title="schema + fields" code={code} />
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
