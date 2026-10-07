# sui Form Validation — Deep Research & Architecture Proposal

Research date: 2026-10-07 · Scope: make the sui form-validation feature **easy to configure and use, fast to execute, and best-in-class for UI/UX**.

> **Status: implemented.** P0 #1–3 (a11y correctness), P1 #4–9 (Standard Schema, messages, `suiErrors`, formErrors banner, per-field timing, docs) and P2 #10 (async validators) plus #12 (`rewardValid`) shipped — see [validation.md](./validation.md) for the user-facing guide. Remaining roadmap: #8 (schema-derived HTML constraints), #13 (field arrays). Unit suite: 310 tests; e2e: 50 tests.

---

## 1. Executive summary

sui's form validation is already built on a genuinely research-aligned foundation — its "auto" timing (quiet on first entry, blur-first, eager after touch), reveal gating, taint-clearing server errors, and WCAG 3.3.1 focus management match or exceed what react-hook-form, superforms and formisch ship by default. The measured execution cost of the whole-schema-parse-per-keystroke design is ~1.4µs/parse (≈700k parses/sec in a 9-field schema) — performance is a non-issue at typical form scale, and Svelte 5 runes give sui fine-grained re-render scope most React libraries have to fight for.

The remaining opportunities cluster in three areas:

1. **A11y correctness gaps (P0):** the `aria-live` message containers are created at the same moment their content appears (a known screen-reader silent-failure pattern), the hint text vanishes from the accessibility tree when errors appear, and the error summary is never focused (GOV.UK pattern) so its `role="alert"` may not announce. These are small, surgical fixes.
2. **Configuration ergonomics (P1):** schema lock-in to zod (the community has converged on Standard Schema v1 as the interop layer), no centralised message override map (copy/i18n), no helper to map server-side issues into `setErrors`, and no per-field timing override at the form level.
3. **Feature roadmap (P2):** async validation (username-taken, password-strength) with checking/debounce/cancellation UX, HTML constraint attributes derived from the schema (progressive enhancement + better mobile keyboards), field arrays, and optional success feedback ("reward early, validate late").

---

## 2. Codebase research findings

### 2.1 What exists — a three-layer architecture

The validation system is the deepest subsystem in the library (`src/lib/sui/`):

| Layer                      | Entry point                                                                                               | Owns                                                                                                                            | Use case                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Per-field standalone**   | `schema` prop on any control (`SuiInput`, `SuiTextarea`, …) backed by `SuiFieldState` (`field.svelte.ts`) | value stays in consumer state; per-control `validateOn`/`validateDebounce`; external `errors` prop with taint-clearing          | one-off fields, fully hand-wired pages         |
| **Submitter-orchestrated** | `createSuiSubmitter(schema, { onvalid })` (`submit.svelte.ts`) + `field-registry.ts`                      | collects live values from DOM-registered controls at submit; whole-schema parse; distributes issues; focus/scroll after failure | pages that keep their own `bind:value` state   |
| **Schema-driven engine**   | `createSuiForm(schema, { onsubmit })` (`create-form.svelte.ts`) + `<SuiForm>`                             | values, defaults, timing, reveal gating, submit parse, server-error mapping, error-summary entries                              | the blessed path — one schema wires everything |

All 8 control families (input, textarea, select, combobox, multi-select, checkbox, radio-group, switch) accept the same `field?: SuiFieldHandle` prop and correctly distinguish `text` vs `discrete` change modes. The `SuiFieldHandle` protocol is method-shaped for bivariance, so enum-typed field handles slot into generically-typed control props without casts — a deliberate, well-executed typing decision.

### 2.2 Decisions that already match the community consensus

These should be **kept and documented as sui differentiators** — they are the parts most libraries get wrong:

- **`validateOn: 'auto'`** = never scold mid-keystroke on the first pass; first blur validates; every subsequent change re-validates. This is the Baymard Institute / react-hook-form `onTouched` / superforms `auto` consensus, encoded as the default.
- **Discrete controls validate on change** — select/combobox/multi-select/checkbox/radio/switch changes are completed answers (react-hook-form `onChange` for discrete controls; formisch same).
- **Reveal gating** — the whole schema runs on every trigger (so a `.refine` stays fresh), but errors _display_ only on fields the user has earned (visited / revealed / post-failed-submit). This is more sophisticated than react-hook-form's default display semantics and directly implements "reward early, validate late" without the usual cross-field noise.
- **Failed submit reveals everything at once + eager revalidation** (react-hook-form `isSubmitted` semantics) — including under `validateOn: 'blur'`.
- **Server errors taint-clear** — `form.setErrors({ email: ['Taken'] })` displays immediately and hands display back to the local schema on first edit (superforms "tainted fields" behaviour).
- **Focus management** — `focusFirstInvalid` on desktop, `scrollIntoView({ block: 'center' })` on touch (WCAG 3.3.1 / VA.gov / superforms `autoFocusOnError: 'detect'`).
- **Peek-vs-blur distinction** — pointer-dismissing a select/combobox popup or cancelling with Escape never triggers blur validation. Most libraries get this wrong (popup open moves focus internally → spurious "blur"). sui fixed it root-cause (see `popup-blur.ts`, verify scripts).
- **Mobile keyboards** — `inputmode`/`autocapitalize`/`autocorrect` derived from `type` (email → email keyboard, etc.).
- **Zero extra dependencies beyond zod (already a dependency)**; runes-native, so no store plumbing, no adapter layer.

### 2.3 Quality state (measured)

- 250/250 unit tests pass (Vitest + Testing Library, 19 files, ~37s), covering form, schema-form, submitter, zod, error-summary, popup-blur semantics.
- E2E (Playwright) covers the validation page: submit-time force validation, blur-first timing, schema-form client-side flow, plus visual snapshots.
- `scripts/verify-validation-still-works.mjs` / `verify-submitter.mjs` give manual probe harnesses.
- zod pinned at `^4.6.5` (current major; v4 top-level formats like `z.email()` already in use).

### 2.4 Performance evidence (measured, not assumed)

Micro-benchmark (local `bench-zod-parse` script, 9-field schema + nested object + top-level refine, zod 4.6.5, warm JIT):

| Input                   | Cost per `safeParse` | Throughput       |
| ----------------------- | -------------------- | ---------------- |
| valid data              | **1.44 µs**          | ~700k parses/sec |
| invalid data (7 issues) | **2.55 µs**          | ~390k parses/sec |

At 90 wpm typing (~7.5 keystrokes/sec), the whole-schema-parse-per-keystroke design consumes ~0.002ms CPU per keystroke — **~0.02% of a frame budget**. Conclusion: no architectural change needed for execution speed; the zod-v4 parser rewrite (community-reported ~100× faster than v3) plus Svelte 5 fine-grained updates already deliver "fast to execute". Performance work should focus on _perceived_ speed (async checking states, debounce guidance) rather than parse cost.

---

## 3. Community research findings

### 3.1 Validation timing — the settled consensus

- **Smashing Magazine, "A Complete Guide To Live Validation UX":** the dominant live-validation pattern is **late validation (on blur)**, then eager on change; early (on-change) validation for discrete controls. Validating on every keystroke _before first blur_ measurably hurts completion (users feel scolded mid-answer).
- **Baymard Institute:** inline validation should confirm success (reward) as fast as possible and surface errors only after the user has committed an answer; avoid validating empty fields on focus loss _when the user never typed_ (sui's reveal gating handles this).
- **react-hook-form** `mode: 'onTouched'`, **superforms** `validationMethod: 'auto'`, **formisch** form-wide `validate`/`revalidate`, **TanStack Form** per-validator `validateOn` — all converge on the same default sui already ships.

### 3.2 Library landscape (Svelte, 2025/26)

| Dimension                      | **sui (this repo)**                                 | superforms                                | formisch                        | TanStack Form      |
| ------------------------------ | --------------------------------------------------- | ----------------------------------------- | ------------------------------- | ------------------ |
| Bundle cost                    | ~0 kB beyond zod                                    | ~20 kB                                    | ~2.5 kB (Valibot only)          | ~15 kB             |
| Schema libs                    | zod 4 (hard-coupled)                                | Zod/Valibot/Yup/ArkType (Standard Schema) | Valibot only                    | any, per-validator |
| Reactivity                     | Svelte 5 runes, fine-grained                        | stores/runes                              | runes, fine-grained             | framework adapters |
| Server integration             | client-first (escape hatch: `setErrors`/`ZodError`) | first-class SvelteKit form actions        | client-only (SvelteKit planned) | client-only        |
| Async field validation         | ✗ (must move to `onsubmit`)                         | ✓ (client+server)                         | ✓ via schema                    | ✓ + `isValidating` |
| Field arrays                   | ✗                                                   | ✓ (proxy arrays)                          | ✓                               | ✓ (first-class)    |
| Error summary                  | ✓ built-in entries                                  | ✓                                         | ✗                               | ✗                  |
| Focus mgmt after failed submit | ✓ field (desktop) / scroll (touch)                  | ✓ `autoFocusOnError`                      | ✓                               | ✓                  |

Positioning conclusion: sui occupies the "batteries-included, zero-dependency-beyond-zod, runes-native" niche. superforms' moat is SvelteKit server actions; formisch's is size; TanStack's is per-validator timing + async. sui's moat should be: **one prop wires a field** (`field={form.fields.x}`), **timing UX correct by default**, and **no schema-runtime lock-in** (next section).

### 3.3 Standard Schema v1 — the interop layer the community adopted

standardschema.dev is a vendor-neutral interface (backed by the zod, Valibot, ArkType and Effect maintainers; also consumed by TanStack Form, formisch, and many server frameworks). Any conforming schema exposes:

```ts
interface StandardSchemaV1<Input, Output> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    validate(value: unknown): { value: Output } | { issues: ReadonlyArray<{ message: string; path?: ReadonlyArray<PropertyKey | PathSegment> }> } | Promise<...>;
  };
}
```

zod v4, Valibot v1+ and ArkType schemas are all Standard-Schema-compatible **today** — `z.object(...)` already carries `~standard`. Accepting `StandardSchemaV1` at sui's API boundary (while keeping zod-powered defaults as an optional enhancement) would make sui schema-agnostic with roughly one adapter function, since `issue.path`/`issue.message` map 1:1 onto sui's existing `#applyIssues` grouping.

Trade-off to design around: Standard Schema has no `.shape` / `def` introspection, so sui's schema-derived smart defaults (`''` for strings, `false` for booleans, `z.default()` values) cannot be derived generically. Recommended split: defaults derivation stays a zod-aware optional feature; for other vendors, consumers pass `initialValues` (already supported) or sui derives only `undefined` defaults.

### 3.4 Accessibility — the details that separate good from great

- **WCAG 3.3.1 (Errors identified) / 3.3.2 (Labels or Instructions) / 3.3.3 (Error Suggestion):** errors must be _programmatically determinable_, associated with their field, and phrased as instructions.
- **WAI-ARIA ARIA21 technique:** `aria-invalid="true"` + `aria-describedby` → error message element. sui already does both.
- **GOV.UK Design System (error summary):** after a failed submit, the summary box itself receives focus (`tabindex="-1"` + `.focus()`), has `role="alert"`, and lists every error as an in-page link to its field; individual field messages sit immediately after the label. GOV.UK research shows focusing the summary announces _the whole problem list at once_ — critical for screen-reader users, who otherwise discover fields one error at a time.
- **Tetra Logical / Harvard HUIT (form error communication):** (a) a live region that is **inserted into the DOM together with its initial content is frequently not announced** — the region must pre-exist the content change; (b) keep the hint visible/associated when errors appear (`aria-describedby` should reference _both_ hint and error ids, comma-separated); (c) phrase messages as corrective instructions ("Enter your date of birth in the format…"), never "Invalid input".
- **Mobile a11y (superforms behaviour sui already mirrors):** never `.focus()` on touch after failed submit — the OSK hides the message; scroll instead.

### 3.5 Error-message microcopy conventions

GOV.UK content style + Adam Silver's _Form Design Patterns_ + Nielsen Norman guidance converge on: state what to do ("Enter an email address in the correct format, like name@example.com"), not what's wrong ("Invalid email"); never blame ("You failed to…"); be specific over generic ("Passwords must include a number" not "Invalid password"); match the field label's words; keep it under ~100 characters. sui surfaces schema messages verbatim — so the docs should ship a message-authoring guide (zod v4 `error:` per-rule examples already appear in the demo schema).

---

## 4. Gap analysis — sui vs community best practice

| #   | Gap                                                                                                                                                                | Evidence                                                        | Severity (UX/a11y)         | Effort       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | -------------------------- | ------------ |
| 1   | `aria-live` message container is created simultaneously with its content → announcements may be dropped by NVDA/JAWS/VoiceOver                                     | input.svelte `{#if invalid \|\| subText}` wraps the live region | **High (a11y)**            | Small        |
| 2   | Hint (`subText`) disappears (visually + from a11y tree) when field invalid; `aria-describedby` references one id, not "hint + error"                               | input.svelte `describedBy` derivation                           | Medium (a11y)              | Small        |
| 3   | Error summary is never focused on failed submit (field is focused instead); `role="alert"` on an unfocused, freshly-inserted node is unreliable                    | form.svelte + GOV.UK pattern                                    | **High (a11y)**            | Small        |
| 4   | Schema lock-in: public types are `ZodType`-based; Standard Schema would unlock valibot/arktype/effect                                                              | `SuiFormOptions<Schema extends ZodType>`                        | Medium (config ergonomics) | Medium       |
| 5   | No centralised message override map (copy/i18n/localisation of zod's default messages)                                                                             | —                                                               | Medium (config)            | Small        |
| 6   | No helper to map server-side error payloads (zod issues / `{ field, message }[]` / fetch `fail()` bodies) into `setErrors` shape                                   | consumers hand-roll `Record<string, string[]>`                  | Medium (ease of use)       | Small        |
| 7   | No async field validation (availability checks, strength meters) — forced into `onsubmit`                                                                          | README states the constraint                                    | Medium (UX)                | Medium-Large |
| 8   | No HTML constraint attributes derived from schema (`required`, `minlength`, `maxlength`, `pattern`, `min/max/step`) → loses no-JS fallback + some mobile IME hints | superforms `$constraints` store                                 | Low-Medium                 | Medium       |
| 9   | No field arrays (dynamic repeated fields: "add another email")                                                                                                     | all competitors have them                                       | Medium for complex forms   | Large        |
| 10  | No optional success feedback (green state / check icon on valid after reveal) — "reward early" half of the Baymard pattern                                         | Baymard                                                         | Low-Medium (UX)            | Small        |
| 11  | `form.formErrors` has no built-in rendering — every consumer hand-rolls a banner                                                                                   | demo doesn't render it either                                   | Low-Medium (ease of use)   | Small        |
| 12  | Debounce guidance absent from docs; `debounce: 0` default is fine (evidence §2.4) but heavy transforms (z.coerce, big schemas) users need a documented number      | benchmark                                                       | Low                        | Tiny (docs)  |
| 13  | `.refine` cross-field errors wait while shape-invalid (zod semantics) — documented, but no escape hatch (e.g. form-level validators that always run)               | README "one zod caveat"                                         | Low-Medium                 | Medium       |
| 14  | Per-field `validateOn` override not available from `createSuiForm` options (only global)                                                                           | TanStack/Formisch offer per-field config                        | Low                        | Small        |
| 15  | No unsaved-changes (`dirty`-based) guard recipe — state exists (`form.dirty`) but no documented pattern                                                            | superforms events                                               | Low                        | Tiny (docs)  |

---

## 5. Recommendations

### P0 — A11y correctness (small, surgical, high value)

1. **Persistent live regions.** Render each field's message container from mount (visually hidden when empty) so `aria-live="polite"` regions pre-exist their content. Two options:
   - a persistent `sr-only` announcer div (id kept in `describedBy` only when invalid), visible styling stays as-is; or
   - mount the message container whenever `touched` (before first validation the container exists empty).
     Option (a) is the most robust across NVDA/VoiceOver/JAWS.
2. **Hint + error coexistence.** Separate `subText` and error message into two ids; `aria-describedby` becomes `"${id}-hint ${id}-message"` when both exist (GOV.UK pattern). Optionally keep rendering the hint visually under the error (muted) instead of replacing it.
3. **Focus the error summary when present.** In `SuiForm`'s submit handler: if `form.errorSummary.length > 0` and a summary container `[data-sui-error-summary]` exists, focus it (`tabindex="-1"` added by the component) — announcing the full problem list — then the summary's links walk users to fields. Keep first-field focus when no summary is rendered, keep scroll-not-focus on touch. Add `focusOnSubmit: 'summary' | 'field' | 'none'` form option (default `'summary'` when a summary is present).

### P1 — Configuration ergonomics (ease of configure/use)

4. **Accept Standard Schema v1** at `createSuiForm`/`createSuiSubmitter`/`schema` prop boundaries: `type SuiSchema<In, Out> = StandardSchemaV1<In, Out> | ZodType<Out, In>`. Internally normalise via one adapter (`issue.path` → dotted key, already the shape of `#applyIssues`). Keep zod-specific default derivation as a capability check (`'shape' in schema`); document that non-zod schemas should pass `initialValues`. This removes the lock-in while changing nothing for zod users.
5. **`messages` override map** on `createSuiForm`: `messages?: Record<string, string | ((issue) => string)>` keyed by field path (and `'_form'`), applied after issue grouping — centralises copy, enables i18n, and rescues zod's default English messages ("Invalid input: expected string, received number" is not user copy).
6. **Server-error mapping helpers:** `suiErrors.fromIssues(issues)` (Standard-Shape), `suiErrors.fromZodError(error)`, `suiErrors.fromFetchFail(json)` — all returning the `Record<string, string[]>` `setErrors` shape. One-liner adoption of the existing escape hatch.
7. **Render `formErrors` in `<SuiForm>`** (opt-in prop `showFormErrors` or an exported `<SuiFormAlert>` styled banner) so root-level refine errors don't require hand-rolled markup; the demo currently doesn't render them at all.
8. **Per-field timing override** at the form level: `fields: { email: { validateOn: 'change' } }` merged over the global `validateOn` — TanStack/Formisch parity.
9. **Docs: message-authoring guide + recipes.** (a) microcopy conventions with zod `error:` examples; (b) debounce guidance ("start at 0; add 150–300ms only when schemas are heavy or transforms run"); (c) unsaved-changes guard using `form.dirty`; (d) SvelteKit action round-trip recipe ending in `form.setErrors(suiErrors.fromIssues(...))`.

### P2 — Feature roadmap (bigger, sequenced)

10. **Async validation** (`asyncValidators: { username: (value) => Promise<boolean | string> }`): run after sync validation passes for that field, debounced (default ~400ms), cancellable on new input, `isValidating` per field + `checkingText` slot in controls (spinner/“Checking availability…” subtext), errors taint-clear exactly like server errors. This is sui's biggest UX gap vs TanStack/superforms — and the one users ask for by name.
11. **Schema → HTML constraint attributes** (progressive enhancement): derive `required`, `minlength`/`maxlength`, `pattern`, `min`/`max`/`step` from the schema onto controls (zod-aware; superforms-parity). Keep `novalidate` so presentation stays sui-owned, but the attributes improve a11y-tree semantics, future no-JS fallback, and some mobile keyboards.
12. **Optional success feedback:** `rewardValid?: boolean` (form or per control) — subtle `variant="success"` ring + optional check icon once a _revealed_ field validates. Passwords/usernames are the canonical use (Baymard "reward early").
13. **Field arrays:** `form.fields.emails` as an array handle (`push/remove/move`), registry integration, focus management on remove. Largest item — schedule after 10–12.

### Explicitly out of scope (recommend NOT building)

- **Constraint Validation API display (native bubbles):** clashes with sui's styled per-field messages; keep `novalidate` + zod/Standard-ownership of logic.
- **Server form-action integration:** superforms owns that niche; sui's client-first + `setErrors` escape hatch is the right boundary for a component library. Document the recipe instead (P1 #9d).
- **Schema-builder DSL of sui's own:** the ecosystem has converged on Standard Schema; don't invent a fourth option.

---

## 6. Proposed API sketches

```ts
// 4 — schema-agnostic boundary (zod still the blessed path)
const form = createSuiForm(schema, {
	// schema: zod | valibot | arktype (anything ~standard)
	onsubmit: async (data) => {
		/* data: typed output */
	}
});

// 5 — central copy / i18n
const form = createSuiForm(schema, {
	messages: {
		email: (issue) =>
			issue.message.includes('regex') ? 'Enter a valid work email' : issue.message,
		_form: 'Something went wrong — check your answers and try again.'
	}
});

// 6 — server round-trip in one line
const res = await fetch('/signup', { method: 'POST', body: JSON.stringify(data) });
if (!res.ok) form.setErrors(suiErrors.fromFetchFail(await res.json()));

// 8 — per-field timing override
const form = createSuiForm(schema, { fields: { role: { validateOn: 'none' } } });

// 10 — async validation with checking state
const form = createSuiForm(schema, {
	asyncValidators: {
		username: async (v) => (await api.available(v)) || 'That username is taken'
	},
	asyncDebounce: 400 // username field shows "Checking…" via field.isValidating
});

// 3 — focus behaviour
const form = createSuiForm(schema, { focusOnSubmit: 'summary' }); // 'field' | 'none'
```

---

## 7. Implementation roadmap

| Phase                          | Items                                                                                                        | Est. size        | Test impact                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ | ---------------- | --------------------------------------------------------------------------------------------------------- |
| **Phase 1 — a11y correctness** | P0 #1–3 (live regions, hint+error describedby, summary focus + option)                                       | ~1 focused PR    | new a11y unit/e2e assertions (live region pre-existence, describedby composition, summary tabindex/focus) |
| **Phase 2 — ergonomics**       | P1 #4–9 (Standard Schema adapter, messages map, error helpers, formErrors rendering, per-field timing, docs) | ~2 PRs           | adapter unit tests per vendor; copy-override tests; docs snippets compile-checked                         |
| **Phase 3 — async validation** | P2 #10                                                                                                       | 1 substantial PR | timing/cancellation tests (fake timers), e2e "checking… → error → taint-clear" flow                       |
| **Phase 4 — polish**           | P2 #11–13 (+field arrays last, possibly its own phase)                                                       | 2–3 PRs          | constraint derivation tests; visual snapshot updates                                                      |

Each phase leaves the suite green — the 250-test baseline plus new assertions per feature.

---

## 8. Sources

- Codebase: `src/lib/sui/{form,field.svelte.ts,zod.ts,error-summary}`, `src/routes/validation/+page.svelte`, `tests/unit/*form*`, `tests/e2e/interactions.spec.ts`, README sections "Schema-driven forms" / "Form controls" / "Validation timing".
- Community: Smashing Magazine — _A Complete Guide To Live Validation UX_; Baymard Institute inline-validation research; GOV.UK Design System — Error summary / Error message components; W3C WAI-ARIA Authoring Practices ARIA21 (`aria-invalid` + `aria-describedby`); WCAG 2.x SC 3.3.1/3.3.2/3.3.3; Tetra Logical — _Foundations: form validation and error messages_; Harvard HUIT accessibility — _Form error communication_; superforms docs — client validation (`validationMethod: 'auto'`), constraints store, tainted fields; formisch — _Guides: Comparison (Svelte)_; Standard Schema v1 spec (standardschema.dev); Valibot v1 announcement (1 kB); Zod v4 announcements (parser rewrite, ~57% smaller core); TanStack Form docs (per-validator `validateOn`, async validation); Adam Silver — _Form Design Patterns_.
- Measurement: `bench-zod-parse` (2026-10-07, bun 1.3.14, zod 4.6.5).
