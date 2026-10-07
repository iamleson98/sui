# Form validation — production guide

How to configure, extend and operate sui's validation in production: message authoring, async validation, server round-trips, timing configuration and the accessibility contract. For the research behind these defaults, see [validation-research.md](./validation-research.md).

---

## The three layers (pick one per form)

| Layer                                                      | When to use                                                                        |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `schema` prop on a control                                 | One-off, standalone fields                                                         |
| `createSuiSubmitter(schema, { onvalid })`                  | You own the values (`bind:value`), want submit orchestration                       |
| `createSuiForm(schema, options)` + `field={form.fields.x}` | The blessed path — the engine owns values, timing, errors, async checks and submit |

All three accept **zod v4** and any **Standard Schema v1** vendor (Valibot, ArkType, Effect). zod additionally gets smart defaults (`''` for strings, `z.default()` values…) and precise field typing; other vendors should pass `initialValues` and reach fields via `form.field('path')`.

---

## Writing error messages users can act on

Conventions (GOV.UK content style, Adam Silver's _Form Design Patterns_, NN/g):

1. **Say what to do, not what's wrong.** `Enter an address like name@example.com` — not `Invalid email`.
2. **Be specific.** `Passwords must include a number` — not `Invalid password`.
3. **Never blame.** Never "You failed to…".
4. **Match the label's words.** The field says _Email_, so the error says _email_, not _mail address_.
5. **Keep it under ~100 characters.** Screen readers read the whole thing.

Author them in the schema (preferred — one source of truth):

```ts
const schema = z.object({
	email: z.email('Enter an address like name@example.com'),
	password: z.string().min(8, 'Use at least 8 characters'),
	accept: z.literal(true, { error: 'Please accept the terms to continue' })
});
```

When the schema's copy isn't yours to change (or you localise), override centrally with the `messages` map — applied per field path, `''`/`'_form'` for form-level, `'*'` as wildcard, and resolvers receive the original issue:

```ts
const form = createSuiForm(schema, {
	messages: {
		email: 'Enter an address like name@example.com',
		password: (issue) =>
			issue.message.includes('8') ? 'Use at least 8 characters' : issue.message,
		'*': 'Check this answer and try again.', // i18n-ready fallback
		_form: 'Something went wrong — check your answers and try again.'
	}
});
```

Server-side messages are **never** re-resolved through the map — server copy is authoritative. Vendors' default messages ("Invalid input: expected string, received undefined") are the main thing this layer rescues.

---

## Async validation (availability checks, strength meters)

Async validators run **after the sync schema passes** for a revealed field, so users never wait on network checks for values that are already invalid. They are:

- **debounced** — default 400ms (`asyncDebounce`, or per-field `fields: { username: { asyncDebounce: 200 } }`);
- **cancellable** — new input supersedes pending checks; the latest value wins, stale results are discarded;
- **deduped** — an in-flight check for the same value is never re-run (no duplicate network calls), and completed results are memoised per value;
- **visible** — controls show a spinner + `checkingMessage` (`field.isValidating`);
- **taint-cleared** — like server errors, they vanish the moment the field is edited;
- **submit-flushed** — a submit awaits any stale/pending checks before `onsubmit` runs, so the form can never be "submitted valid" while a check is in flight.

```ts
const form = createSuiForm(schema, {
	asyncValidators: {
		username: async (value) => {
			const res = await fetch(`/api/available?u=${encodeURIComponent(String(value))}`);
			const { available } = await res.json();
			return available || 'That username is already taken.'; // a message fails; anything else passes
		}
	},
	checkingMessage: 'Checking availability…',
	asyncDebounce: 400
});
```

A rejected validator surfaces its error message on the field (visible feedback beats silent failure) — catch transport errors yourself if you'd rather retry silently.

---

## Server round-trips (fetch or SvelteKit actions)

`onsubmit`/`onvalid` receive the parsed, typed output. Throw to map failures back onto fields:

```ts
const form = createSuiForm(schema, {
	onsubmit: async (data) => {
		const res = await fetch('/signup', { method: 'POST', body: JSON.stringify(data) });
		if (!res.ok) {
			// ONE line: tolerant mapper for the shapes servers return —
			// { issues: [...] } (zod/Standard JSON), { errors: { field: msg } },
			// { message } / direct field maps
			form.setErrors(suiErrors.fromResponse(await res.json()));
			return;
		}
		// success path…
	}
});
```

Finer-grained helpers: `suiErrors.fromIssues(issues)`, `suiErrors.fromZodError(error)`. Or throw a `ZodError` (or any issue-carrying object) straight from the callback — fields map automatically, root issues land in `form.formErrors`, and any other thrown error becomes a form-level message rendered by `<SuiForm showFormErrors>`.

SvelteKit form actions (same pattern, server side):

```svelte
<!-- +page.svelte -->
<script lang="ts">
	import { createSuiForm, SuiForm, suiErrors } from '$lib/sui';

	const form = createSuiForm(schema, {
		onsubmit: async (data) => {
			const res = await fetch('?/signup', {
				method: 'POST',
				body: new FormData(event_target, JSON.stringify(data))
			});
			const body = await res.json();
			if (!res.ok) form.setErrors(suiErrors.fromIssues(body.issues));
		}
	});
</script>

<SuiForm {form} showFormErrors>…</SuiForm>
```

---

## Timing configuration

The default (`validateOn: 'auto'`) is the researched sweet spot: quiet during the first answer, validate on blur, eager afterwards; discrete controls (select/checkbox/radio/switch/combobox/multi-select) validate on every change. Override globally or per field:

```ts
const form = createSuiForm(schema, {
	validateOn: 'auto',
	fields: {
		username: { validateOn: 'change' }, // eager: live username feedback
		cardNumber: { debounce: 150 }, // heavy transform? debounce the sync parse
		bio: { validateOn: 'none' } // only validate on submit
	}
});
```

**Debounce guidance (measured, not guessed):** a whole-schema parse costs ~1.4 µs for a 9-field form (~700k parses/sec, zod 4.6.5) — ~0.02% of a frame budget per keystroke at 90 wpm. Start at `0` (default); add 150–300 ms only when schemas are very large or use expensive transforms (`z.coerce`, cross-field `refine`s with lookups). Async validators are a different budget — they hit the network, hence the 400 ms default.

**Focus after a failed submit** — `focusOnSubmit: 'summary'` (default) focuses the error summary box (GOV.UK pattern: the whole problem list is announced at once, links walk to each field); `'field'` always lands on the first invalid control; `'none'` disables focus management. On touch devices sui scrolls instead of focusing inputs (the on-screen keyboard would hide the message); the summary/banner are divs, so focusing them is touch-safe.

---

## Unsaved-changes guard

`form.dirty` tracks which paths changed from the initial value — one `beforeNavigate` is a complete guard:

```svelte
<script lang="ts">
	import { beforeNavigate } from '$app/navigation';

	beforeNavigate(({ cancel }) => {
		if (form.isSubmitted || Object.keys(form.dirty).length === 0) return;
		if (!confirm('You have unsaved changes. Leave anyway?')) cancel();
	});
</script>
```

---

## The accessibility contract

Every sui field ships, by construction:

- `aria-invalid` + a **persistent** `aria-live="polite"` message region — mounted empty _before_ any message exists, so the first announcement is never silently dropped (the classic created-with-content live-region failure);
- hint + error **coexistence** — `subText` keeps its own id and stays visible when errors appear; `aria-describedby` references `hint-id message-id` in reading order (WCAG 3.3.2 / GOV.UK);
- a **focusable error summary** (`tabindex="-1"`) that receives focus on failed submits;
- `aria-required` / required markers with `sr-only` text;
- mobile keyboards derived from `type` (`inputmode`, `autocapitalize`).

Phrasing rule of thumb for anything you render yourself: errors are instructions ("Enter…", "Choose…", "Select…"), hints are formats ("DD/MM/YYYY", "Up to 160 characters").
