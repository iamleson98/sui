# sui

**s**imple **ui** — an opinionated, batteries-included component library for Svelte 5, built on top of [shadcn-svelte](https://shadcn-svelte.com), [bits-ui](https://bits-ui.com), Tailwind CSS v4 and [zod](https://zod.dev) v4.

sui exists to remove boilerplate. A typical form field needs a label, helper text, icons, validation wiring, error display, a size, and a skeleton for its loading state — that is eight concerns before any business logic. sui collapses them into props:

```svelte
<!-- everything a production form field needs, in one component -->
<SuiInput
  label="Email"
  placeholder="you@example.com"
  startIcon={MailIcon}
  schema={z.email('Enter a valid email')}
  bind:value={email}
/>
```

```svelte
<!-- an async, server-searchable select with infinite scroll -->
<SuiSelect
  label="Owner"
  source={cursorSource(fetchOwners)}
  bind:value={ownerId}
/>
```

```svelte
<!-- or wire the ENTIRE form from one zod schema — values, validation
     timing and error display all automatic -->
<SuiForm {form}>
  <SuiInput field={form.fields.email} label="Email" type="email" required />
  <SuiCheckbox field={form.fields.accept} label="I accept the terms" />
  <SuiButton type="submit">Create account</SuiButton>
</SuiForm>
```

No separate `<Label>`, no `<FormField>`, no validation framework glue, no scroll listener code, no manual `safeParse`/error mapping.

## What's inside

| Area | Components & exports |
| --- | --- |
| Form controls | `SuiInput`, `SuiTextarea`, `SuiSelect`, `SuiCombobox`, `SuiMultiSelect`, `SuiCheckbox`, `SuiRadioGroup`, `SuiSwitch` |
| Actions | `SuiButton`, `SuiIconButton` |
| Data | `SuiDataTable` (+ `suiColumn` helper, `renderComponent`), `SuiDataTableSkeleton`, CSV helpers (`suiDownloadCsv`, `suiRowsToCsv`, `suiCsvCell`) |
| Error handling | `SuiErrorSummary` (WCAG 3.3.1 error box), `focusFirstInvalid()` |
| Skeletons | `SuiInputSkeleton`, `SuiTextareaSkeleton`, `SuiSelectSkeleton`, `SuiComboboxSkeleton`, `SuiMultiSelectSkeleton`, `SuiCheckboxSkeleton`, `SuiRadioGroupSkeleton`, `SuiSwitchSkeleton`, `SuiButtonSkeleton`, `SuiSkeleton` |
| Infinite scroll | `SuiSource`, `offsetSource()`, `cursorSource()`, `SuiInfiniteList`, `observeSentinel()` |
| Mobile | `suiMobileQuery()` / `SUI_MOBILE_QUERY` — the breakpoint where the select family switches to bottom sheets |
| Validation | zod v4 helpers — `suiValidate()`, `SuiFieldState` — plus the `schema` prop on every form control |
| Schema-driven forms | `createSuiForm()`, `<SuiForm>`, `form.fields.*` handles (one zod schema wires values, timing, errors, submit parsing) |
| Design tokens | `SuiSize` scale + semantic variant maps (`SUI_CONTROL`, `SUI_FIELD_CONTROL`, …) shared by every component |

## Design principles

1. **One shared size scale.** `size="sm"` on an input, a button, a select trigger and a skeleton all produce exactly the same height. Mixed-size rows line up pixel-for-pixel.
2. **Semantic color variants.** `variant="info"` (blue, the normal state), `"success"` (green), `"warning"` (yellow) and `"error"` (red) style the **label, border, focus ring and helper text** together, consistently across all form controls. Validation errors always win and force the `error` appearance everywhere.
3. **zod v4 as the only validation language.** Pass any `ZodType` — a primitive (`z.email(...)`) or a slice of an object schema (`schema.shape.email`) — and the field validates as the user types, with ARIA wiring (`aria-invalid`, `aria-describedby`, `aria-live`) handled for you. For whole forms, `createSuiForm(schema)` drives every field from the one schema — no `safeParse`, no error mapping, no per-field refs.
4. **Labels are props.** `label`, `subText`, `startIcon`, `endIcon`, `action` (an interactive snippet in the field's end slot) exist on every control that can show them.
5. **Every component has a skeleton.** Same sizes, optional label row: `<SuiInputSkeleton size="sm" label={true} />`.
6. **REST-native infinite scroll.** Selects, comboboxes and multi-selects take a `source` — a typed async page loader over cursor *or* offset pagination — and load more pages as the user scrolls the option list. See the [pagination guide](#infinite-scroll--rest-pagination).

## Installation

sui is consumed as source (like shadcn-svelte itself) — copy `src/lib/sui` (and the `src/lib/components/ui` primitives it builds on) into your SvelteKit project:

```sh
# inside your SvelteKit project
npx sv add tailwindcss            # Tailwind v4
npx shadcn-svelte@latest init     # shadcn-svelte base
npm i zod @tanstack/svelte-table @tanstack/svelte-virtual @lucide/svelte vaul-svelte tailwind-variants

# vaul-svelte powers the mobile bottom sheets; also grab the drawer
# primitive: npx shadcn-svelte@latest add drawer   (see Mobile below)

# then copy from this repo:
#   src/lib/sui          → your src/lib/sui
#   src/app.css          → theme variables (merge into your app.css)
#   src/lib/utils.ts     → cn() helper (from shadcn-svelte init)
```

Import everything from the barrel:

```ts
import {
  SuiInput, SuiSelect, SuiButton, SuiDataTable, suiColumn,
  cursorSource, offsetSource, type SuiItem, type SuiSource
} from '$lib/sui';
```

## Schema-driven forms — createSuiForm

One zod object schema drives the whole form. `createSuiForm` returns a reactive form instance; pass its field handles to any sui control through the `field` prop and everything wires itself — values, validation timing, error display, submit parsing, even focus management:

> **Client-side first.** All validation runs in the browser — `handleSubmit` parses the schema before your `onsubmit` callback ever runs. There is deliberately no server-side validation integration (no form actions, no superforms-style server round-trip) yet; the `setErrors` API and the throw-a-`ZodError` pattern are generic escape hatches for merging errors that *your own* submit code produces (e.g. a backend rejection) back onto fields.

```svelte
<script lang="ts">
  import { createSuiForm, SuiForm } from '$lib/sui';
  import { z, ZodError } from 'zod';

  const schema = z.object({
    email: z.email('Enter a valid email'),
    password: z.string().min(8, 'Use at least 8 characters'),
    confirm: z.string(),
    accept: z.literal(true, { error: 'Please accept the terms' })
  }).refine((d) => d.password === d.confirm, {
    path: ['confirm'], error: "Passwords don't match"
  });

  const form = createSuiForm(schema, {
    onsubmit: async (data) => {
      // data is the zod-parsed, typed, transformed output
      await api.createAccount(data);
      // server-side validation failures map straight back onto fields:
      if (taken(data.email)) throw new ZodError([
        { code: 'custom', input: data.email, path: ['email'], message: 'Already registered' }
      ]);
    }
  });
</script>

<SuiForm {form}>
  {#if form.hasErrors}<SuiErrorSummary errors={form.errorSummary} id="errors" />{/if}
  <SuiInput field={form.fields.email} label="Email" type="email" required />
  <SuiInput field={form.fields.password} label="Password" type="password" required />
  <SuiInput field={form.fields.confirm} label="Confirm" type="password" required />
  <SuiCheckbox field={form.fields.accept} label="I accept the terms" required />
  <SuiButton type="submit" loading={form.isSubmitting}>Create account</SuiButton>
</SuiForm>
```

That's the whole feature — the application code never calls `safeParse`, never maps `issue.path`, never threads `errors` props or `bind:this` refs.

### Options

| Option | Default | Notes |
| --- | --- | --- |
| `initialValues` | schema-derived | Seed values layered over smart defaults: `''` for strings, `false` for booleans, `[]` for arrays, `{}` for nested objects, `z.default()` values, `undefined` for enums/literals/numbers |
| `validateOn` | `'auto'` | Form-wide timing — `auto` (blur first, then eager), `blur`, `change`, `both`, `none` |
| `debounce` | `0` | Debounce (ms) for change-driven validation |
| `onsubmit` | — | Receives the parsed output; throw a `ZodError` to map server issues back onto fields (any other error becomes `form.formErrors`) |

### Smart semantics (research-backed)

The timing follows the same research as the per-field mode (Baymard / react-hook-form `onTouched` / superforms `auto`), extended to the whole-schema level the way superforms and react-hook-form do it:

- **Pristine fields are never scolded.** Errors display only on *revealed* fields — a field reveals on its first blur, on a discrete change (select/combobox/multi-select/checkbox/radio/switch — every interaction is a completed answer), or after a failed submit.
- **The whole schema runs on every validation trigger**, not just the changed field — a `refine` can attach an error to *any* field, so cross-field rules (password ≠ confirm) stay fresh the moment the *other* field changes. Reveal gating keeps the noise invisible on fields the user hasn't earned errors for yet. One zod caveat to know: `.refine` callbacks only run when the object *shape* parses — while other fields are still invalid, cross-field errors wait quietly (standard zod behavior; same gotcha as superforms).
- **A failed submit reveals every invalid field at once** and, from then on, any edit re-validates instantly (react-hook-form `isSubmitted` semantics). `<SuiForm>` additionally moves focus to the first invalid control on desktop (WCAG 3.3.1) and only scroll-snaps to it on mobile, where focus would open the on-screen keyboard and hide the message.
- **Server errors taint-clear.** `form.setErrors({ email: 'Already registered' })` displays immediately and survives blurring — but the first edit of that field hands display back to the schema, so stale server messages never linger (superforms tainted-field behavior).

### Reactive form state

```ts
form.values                    // live, deeply reactive — edit directly
form.fields.email              // handle: .value, .errors, .invalid, .touched, .dirty
form.field('address.city')     // nested paths use dotted keys
form.isValid                   // silent full-schema check (no display changes)
form.formErrors                // root-level refine errors
form.errorSummary              // ready-made entries for <SuiErrorSummary>
form.isSubmitting / isSubmitted / submitCount

// programmatic control
form.validate()                // full validation, reveals everything
form.setErrors({ email: ['Taken'] })   // server errors ('' or '_form' = form-level)
form.setValues({ email: 'a@b.co' })    // silent merge
form.reset()                   // values → defaults, state forgotten
form.handleSubmit(event)       // manual submit handler for plain <form> elements
```

Nested object schemas work with dotted paths: `form.fields['address']` binds the whole sub-object, `form.field('address.city')` reaches one leaf. Schemas must be synchronous — move async checks (username availability, …) into `onsubmit`.

## Form controls

All form controls share this core API:

| Prop | Type | Notes |
| --- | --- | --- |
| `label` | `string \| Snippet` | Rendered above the field, associated for screen readers |
| `subText` | `string` | Muted helper text below the field |
| `size` | `'sm' \| 'md' \| 'lg'` | Shared height/typography scale (default `md`) |
| `variant` | `'info' \| 'success' \| 'warning' \| 'error'` | Semantic color state (default `info`) |
| `startIcon` / `endIcon` | lucide component | Icons inside the field |
| `action` | `Snippet` | Interactive content in the field's end slot (buttons, availability checks, …) |
| `schema` | `ZodType` | Validated per `validateOn` timing (see below). Ignored when `field` is set |
| `field` | `SuiFieldHandle` | **Schema-driven wiring** — a field handle from `createSuiForm` (`form.fields.email`). Takes over the value, validation timing and error display; `bind:value`/`schema`/`errors` become unnecessary (see [Schema-driven forms](#schema-driven-forms--createSuiform)) |
| `validateOn` | `'auto' \| 'change' \| 'blur' \| 'both' \| 'none'` | When the schema runs — `auto` for text fields, `both` for pickers/toggles (defaults) |
| `errors` | `string[]` | External errors (server-side validation) — shown until the user edits the field |
| `required` | `boolean` | Adds the `*` marker and `aria-required` |

Every control also exports `validate(): string[]` and `reset()` methods — useful when you wire fields **manually** (per-field `schema` props instead of `createSuiForm`):

```svelte
<script lang="ts">
  import { tick } from 'svelte';
  import { focusFirstInvalid } from '$lib/sui';

  let nameRef: SuiInput | undefined = $state();

  async function onSubmit(event: SubmitEvent) {
    event.preventDefault();
    const result = schema.safeParse({ name, email });
    if (!result.success) {
      nameRef?.validate(); // force the field to show its zod errors
      await tick(); // let data-invalid attributes paint
      focusFirstInvalid(event.currentTarget); // WCAG 3.3.1: focus the first problem
    }
  }
</script>

<form onsubmit={onSubmit} novalidate>
  <SuiErrorSummary id="form-errors" {errors} />
  <SuiInput bind:this={nameRef} label="Name" schema={schema.shape.name} bind:value={name} />
</form>
```

#### Validation timing

Inline-validation research (Baymard) and the major form libraries (react-hook-form's `onTouched`, superforms' `auto`) agree on the sweet spot, and sui encodes it as the default:

- **Text fields (`SuiInput`, `SuiTextarea`) default to `validateOn="auto"`** — quiet while the user types their first answer, validate on the first blur, then revalidate on every keystroke so errors clear the moment they are fixed.
- **Discrete controls (`SuiSelect`, `SuiCombobox`, `SuiMultiSelect`, `SuiCheckbox`, `SuiRadioGroup`, `SuiSwitch`) default to `validateOn="both"`** — every selection/toggle is a completed answer, so change and blur both validate.
- `change` / `blur` / `none` give you explicit control; a failed submit (`validate()`) marks fields touched, which turns on eager revalidation everywhere.

**External error lifecycle:** messages passed via `errors` (e.g. server-side results after a failed submit) display immediately and survive blurring — but the first edit of a field hands error display back to the local schema, so a stale "Name must be at least 2 characters" disappears as soon as the user fixes the value. A *new* `errors` array from the next submit takes the display back. No bookkeeping required.

### Text inputs

`SuiInput` adds `type`, `placeholder` (defaults to the label), `validateDebounce` (ms), `ref` (bindable). `SuiTextarea` mirrors it for multi-line text. Both accept `validateOn` (see [Validation timing](#validation-timing)).

### Selects

`SuiSelect` renders a trigger + listbox with keyboard navigation, descriptions, disabled options and an optional clear button (`clearable`). Every field renders **one root element** (`[data-sui-field]`) containing the label, control and message — parent grid/flex gaps can never pull them apart.

- **Static options:** `items: SuiItem[]` — see below
- **Async + infinite scroll:** `source: SuiSource<SuiItem>` — the first page is prefetched, and streaming the next page is automatic: as the user scrolls towards the bottom of the list the component pre-fetches the next page (256 px before the end) and appends its items, so scrolling just continues. A `Loading more…` row signals in-flight pages and fetch failures surface through `errorText` with a `role="alert"` message.
- **Clearable:** the ✕ is a real `<button type="button">` rendered *outside* the trigger (nested interactive elements are invalid HTML) — clicking it clears the selection without opening the menu and returns focus to the trigger. While it is visible the chevron is pinned to the trigger's end edge and the ✕ sits between the value and the chevron, so there is no dead gap before the border.
- **Focus behavior:** triggers style their focused look with `focus-visible` (not `focus-within`): the menu hands DOM focus back to the trigger on close, and only keyboard focus paints the focused border. Dismissing the menu with an outside click lets the focus follow the pointer out of the field; `Esc` and keyboard selection return focus to the trigger as keyboard users expect.
- **Scroll containment:** opening a menu (or selecting an item while it stays open) never scrolls the page. bits-ui's Command reveals the highlighted item with `scrollIntoView()`, which races floating-ui positioning — in the frames before the portal becomes `position: fixed` the item still sits at the top of the document flow, and the native call would scroll the *page* to "reveal" it. The vendored `ui/command` wrappers (`contained-scroll-into-view.ts`, applied in `command-item.svelte` + `command-group.svelte`) replace that call with a container-scoped implementation that only ever scrolls the command list. Keyboard navigation still reveals items inside the list — just without hijacking the document. Keep this local deviation when re-syncing the shadcn wrappers.

```ts
type SuiItem = { value: string; label: string; description?: string; disabled?: boolean };
```

`SuiCombobox` adds a search box: for static items it filters client-side; for async sources typing debounces a **server search** (250 ms by default — `searchDebounce`). The trigger announces proper combobox semantics (`aria-haspopup="listbox"`, `aria-controls` → the listbox) and shows a chevron that flips while open.

`SuiMultiSelect` binds `value: string[]` and renders the selection as chips with individual remove buttons. The trigger is a `role="combobox"` div (so the chip removes can be real buttons) and collapses the overflow smartly (`maxDisplay`):

- `maxDisplay="responsive"` (default) — Ant Design `maxTagCount="responsive"` behaviour: chips are measured and as many fit in the trigger as the width allows, the rest collapse into a **“+n” pill** (hover shows the hidden labels, click expands to show every chip with a “Show less” control)
- `maxDisplay={3}` — a fixed cap

### Mobile

Below `640px` (the `sm` breakpoint) every select-family control swaps its anchored popover for a **drag-to-dismiss bottom sheet** (vaul) — the platform-native picker pattern on phones. The branch is chosen live by an SSR-safe media query (`suiMobileQuery()`), so there is no hydration mismatch and no layout shift when the viewport crosses the breakpoint:

- full-width sheet rising from the bottom, capped at 85dvh, safe-area padded (`env(safe-area-inset-bottom)`)
- drag down or tap the overlay to dismiss; selecting in `SuiSelect` / `SuiCombobox` commits and closes, `SuiMultiSelect` stays open for multi-selection
- the trigger (label, variant, error styling, validation wiring) is the exact same component on both branches — only the host changes

On coarse pointers the demo `app.css` ships the ergonomics rules sui's data attributes are designed for (copy the block into your app):

- `touch-action: manipulation` on every trigger — kills the 300ms double-tap-zoom delay
- transparent `-webkit-tap-highlight-color` — no grey tap flash
- 16px text in inputs — iOS Safari refuses to zoom the viewport on focus
- 44px hit areas (via `::after` insets) on the small round affordances: clear buttons, chip removes, the "+n" pill
- `overscroll-behavior: contain` on open dropdowns — scroll chains never leak to the page behind
- `prefers-reduced-motion` disables entrance/exit animations

`SuiInput` also derives mobile keyboard niceties from `type`: `inputmode` (`email` / `tel` / `url` / `decimal`) plus `autocapitalize="none"` / `autocorrect="off"` on email fields. Pass your own `inputmode` to override.

## Infinite scroll & REST pagination

The `source` pattern is sui's answer to "load options from the API without writing scroll code":

```ts
import { offsetSource, cursorSource, type SuiSource } from '$lib/sui';

// ── offset pagination: ?page=1&size=25 ──────────────────────────────
type OffsetPage<T> = { items: T[]; total: number };
const users: SuiSource<SuiItem> = offsetSource(async ({ page, size, query, signal }) => {
  const res = await fetch(`/api/users?page=${page}&size=${size}&q=${query}`, { signal });
  const body: OffsetPage<SuiItem> = await res.json();
  return { items: body.items, total: body.total }; // hasMore inferred
});

// ── cursor pagination (recommended): ?cursor=…&size=25 ──────────────
type CursorPage<T> = { items: T[]; nextCursor: string | null };
const owners: SuiSource<SuiItem> = cursorSource(async ({ cursor, size, query, signal }) => {
  const params = new URLSearchParams({ size: String(size) });
  if (cursor) params.set('cursor', cursor);
  if (query) params.set('q', query);
  const res = await fetch(`/api/users?${params}`, { signal });
  const body: CursorPage<SuiItem> = await res.json();
  return { items: body.items, nextCursor: body.nextCursor };
});
```

Both adapters give the component everything it needs and nothing more: pages are deduplicated by `item.value`, stale responses are superseded, aborted requests reuse the `AbortSignal`, and `hasMore` flips off when the API says the list ended. `SuiInfiniteList` is the headless engine behind this — usable on its own for custom list UIs.

**REST best practices baked in:**

- cursor endpoints expose `nextCursor: string | null` — `null` ends the list (no "empty page means done" guessing)
- offset endpoints expose `total` so the component can stop exactly at the last page
- every request carries `signal` so superseded searches are cancelled server-side
- search resets to page one — never filters a partially loaded list client-side

## Data table

`SuiDataTable` wraps TanStack Table v9 + TanStack Virtual:

```svelte
<script lang="ts">
  import { SuiDataTable, suiColumn, renderComponent } from '$lib/sui';
  import type { SuiDataTableColumn } from '$lib/sui';

  type Person = { id: string; name: string; age: number };

  const col = suiColumn<Person>();
  const columns = [
    col.accessor('name', { header: 'Name' }),
    col.accessor('age', { header: 'Age', meta: { align: 'right' } }),
    col.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => renderComponent(RowActions, { person: row.original })
    })
  ] as SuiDataTableColumn<Person>[];
</script>

<SuiDataTable
  data={people}
  {columns}
  rowId={(p) => p.id}
  enableSelection
  searchable
  onSelectionChange={(rows, ids) => (chosen = rows)}
  onRowClick={(person) => open(person)}
/>
```

Features: sorting (none → asc → desc, `aria-sort` wired), global search, column visibility menu, row selection with a select-all and live footer count, pagination (client, server or none — `onPageChange` + `rowCount` for server mode), density sizes, loading/empty states, and virtual scrolling on by default (`virtual={true}` renders only the visible window of a 10,000-row list).

**Column pinning** — freeze columns to an edge while the rest scroll horizontally with `meta.pinned`:

```ts
const columns = [
  col.accessor('name', { header: 'Name', meta: { pinned: 'left', width: 120 } }),
  col.accessor('email', { header: 'Email', meta: { width: 220 } }),
  col.display({
    id: 'actions',
    header: '',
    meta: { pinned: 'right', width: 90 },
    cell: ({ row }) => renderComponent(RowActions, { person: row.original })
  })
] as SuiDataTableColumn<Person>[];
```

Pinned columns should declare an explicit `width` (or `size`) so the sticky offsets stay deterministic; with row selection enabled the checkbox column pins along with them. Freeze edges get a hairline + soft inner shadow so the scrolling content reads as passing *underneath*. Pinning composes with virtual scrolling.

**CSV export** — `exportable` adds a toolbar button that downloads the current filtered rows as RFC 4180 CSV (`exportFilename` to rename). Values are quoted/escaped correctly, dates serialize as ISO, leading `=` / `+` / `-` / `@` are prefixed to neutralize spreadsheet formula injection, display columns are skipped, and the file ships with a UTF-8 BOM so Excel opens it cleanly. The `suiDownloadCsv` / `suiRowsToCsv` / `suiCsvCell` helpers are exported for custom export flows.

Column `meta` options: `align`, `width`, `class`, `hiddenByDefault`, `pinned`.

## Skeletons

Every interactive component has a size-matched skeleton with the same public sizes, plus `label` / `labelSkeleton` props to reserve the label row:

```svelte
{#if loading}
  <SuiSelectSkeleton size="md" label={true} />
{:else}
  <SuiSelect label="Owner" {source} bind:value={owner} />
{/if}
```

`SuiButtonSkeleton` matches button sizes/widths; `SuiDataTableSkeleton` takes `rows` / `columns` counts; `SuiMultiSelectSkeleton` takes `badges` for a number of placeholder pills. `SuiSkeleton` is the raw primitive.

## Accessibility

- labels bound to controls (`for`/`id`), required markers with `sr-only` text
- `aria-invalid` + `aria-describedby` + `aria-live` on every field message
- combobox pattern with `role="combobox"` triggers, `listbox`/`option` roles, `aria-expanded`
- table headers are sortable buttons with `aria-sort`; selection uses real checkboxes with `aria-label`s
- loading indicators expose `role="status"`; fetch failures use `role="alert"`
- `SuiErrorSummary` + `focusFirstInvalid()` implement the WCAG 3.3.1 failed-submit pattern (one error box, focus the first invalid control)
- mobile sheets are vaul dialogs with `aria-modal`, labelled by the field label, keyboard-dismissable

## Testing

sui ships with the two-tier test setup the library itself uses:

```sh
npm run test              # vitest + @testing-library/svelte (235 unit tests)
npm run test:e2e          # Playwright: desktop + mobile projects (44 tests)
npm run test:e2e:update   # regenerate visual baselines
```

The unit suite covers props/ARIA/wiring in jsdom; the Playwright suite runs against the built demo app in a real browser — a desktop Chromium project (infinite scroll, floating positioning, focus management, full form flows, pinned-column geometry, CSV downloads, visual baselines) plus a **Pixel 7 mobile project** (bottom-sheet behavior, 16px inputs, coarse-pointer ergonomics).

## Demo app

The repo's routes are a live showcase of every component — run `npm run dev` and browse:

| Route | Shows |
| --- | --- |
| `/` | overview + philosophy |
| `/input` | labels, icons, actions, variants, zod-as-you-type, sizes, skeletons |
| `/button` | variants, icons, loading, shared size scale |
| `/selection` | static + infinite-scroll selects, searchable combobox, smart chip overflow, variant showcase, mobile bottom sheets |
| `/data-table` | sorting, search, selection, pagination, column visibility, pinned columns, CSV export, 10k virtual rows |
| `/toggles` | checkbox / radio / switch with zod |
| `/validation` | a schema-driven `createSuiForm` form (cross-field refinement, server-error mapping, error summary) + the manual per-field-schema form + timing-mode playground |
| `/pagination` | the infinite-scroll REST guide with live examples |
| `/skeletons` | every skeleton, every size |
| `/showcase` | **Nimbus** — a full mission-control app (sidebar shell, ⌘K command palette, charts, kanban board, virtualized deployments table + live logs, scheduling, settings, toasts) assembled from the entire toolkit |

The demo app itself doubles as the deployment reference: it prerenders every page to static HTML (adapter-node serves the pages statically and keeps the `/api` mock endpoints dynamic), ships per-route code splitting via rolldown `codeSplitting` groups (the table engine only downloads on `/data-table`; icons and the sui root helpers live in one cached chunk each), self-hosts the latin subset of Inter (48 KB woff2, preloaded — not the 232 KB all-subsets bundle), and wires the full SEO set per route: meta description, canonical, Open Graph/Twitter cards, `robots.txt` and a generated `sitemap.xml`. Copy any of it from `src/lib/demo/seo.svelte`, `src/lib/demo/site.ts` and `vite.config.ts`.

## Credits

Built on [shadcn-svelte](https://shadcn-svelte.com) (design system; the sui primitives wrap the 10 controls they need, and the `/showcase` app installs the rest of the registry — sidebar, charts, calendar, carousel, sonner, …), [bits-ui](https://bits-ui.com) (headless behaviors), [vaul-svelte](https://vaul-svelte.com) (mobile bottom sheets), [LayerChart](https://layerchart.com) (the chart primitives behind shadcn-svelte charts), [TanStack Table](https://tanstack.com/table) + [TanStack Virtual](https://tanstack.com/virtual), and [zod](https://zod.dev). Icons by [lucide](https://lucide.dev).

## License

Apache-2.0
