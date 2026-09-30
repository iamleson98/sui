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

No separate `<Label>`, no `<FormField>`, no validation framework glue, no scroll listener code.

## What's inside

| Area | Components & exports |
| --- | --- |
| Form controls | `SuiInput`, `SuiTextarea`, `SuiSelect`, `SuiCombobox`, `SuiMultiSelect`, `SuiCheckbox`, `SuiRadioGroup`, `SuiSwitch` |
| Actions | `SuiButton`, `SuiIconButton` |
| Data | `SuiDataTable` (+ `suiColumn` helper, `renderComponent`), `SuiDataTableSkeleton` |
| Skeletons | `SuiInputSkeleton`, `SuiTextareaSkeleton`, `SuiSelectSkeleton`, `SuiComboboxSkeleton`, `SuiMultiSelectSkeleton`, `SuiCheckboxSkeleton`, `SuiRadioGroupSkeleton`, `SuiSwitchSkeleton`, `SuiButtonSkeleton`, `SuiSkeleton` |
| Infinite scroll | `SuiSource`, `offsetSource()`, `cursorSource()`, `SuiInfiniteList`, `observeSentinel()` |
| Validation | zod v4 helpers — `suiValidate()`, `SuiFieldState` — plus the `schema` prop on every form control |
| Design tokens | `SuiSize` scale + semantic variant maps (`SUI_CONTROL`, `SUI_FIELD_CONTROL`, …) shared by every component |

## Design principles

1. **One shared size scale.** `size="sm"` on an input, a button, a select trigger and a skeleton all produce exactly the same height. Mixed-size rows line up pixel-for-pixel.
2. **Semantic color variants.** `variant="info"` (blue, the normal state), `"success"` (green), `"warning"` (yellow) and `"error"` (red) style the **label, border, focus ring and helper text** together, consistently across all form controls. Validation errors always win and force the `error` appearance everywhere.
3. **zod v4 as the only validation language.** Pass any `ZodType` — a primitive (`z.email(...)`) or a slice of an object schema (`schema.shape.email`) — and the field validates as the user types, with ARIA wiring (`aria-invalid`, `aria-describedby`, `aria-live`) handled for you.
4. **Labels are props.** `label`, `subText`, `startIcon`, `endIcon`, `action` (an interactive snippet in the field's end slot) exist on every control that can show them.
5. **Every component has a skeleton.** Same sizes, optional label row: `<SuiInputSkeleton size="sm" label={true} />`.
6. **REST-native infinite scroll.** Selects, comboboxes and multi-selects take a `source` — a typed async page loader over cursor *or* offset pagination — and load more pages as the user scrolls the option list. See the [pagination guide](#infinite-scroll--rest-pagination).

## Installation

sui is consumed as source (like shadcn-svelte itself) — copy `src/lib/sui` (and the `src/lib/components/ui` primitives it builds on) into your SvelteKit project:

```sh
# inside your SvelteKit project
npx sv add tailwindcss            # Tailwind v4
npx shadcn-svelte@latest init     # shadcn-svelte base
npm i zod @tanstack/svelte-table @tanstack/svelte-virtual @lucide/svelte tailwind-variants

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
| `schema` | `ZodType` | Validated per `validateOn` timing (see below) |
| `validateOn` | `'auto' \| 'change' \| 'blur' \| 'both' \| 'none'` | When the schema runs — `auto` for text fields, `both` for pickers/toggles (defaults) |
| `errors` | `string[]` | External errors (server-side validation) — shown until the user edits the field |
| `required` | `boolean` | Adds the `*` marker and `aria-required` |

Every control also exports `validate(): string[]` and `reset()` methods for submit-time flows:

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

```ts
type SuiItem = { value: string; label: string; description?: string; disabled?: boolean };
```

`SuiCombobox` adds a search box: for static items it filters client-side; for async sources typing debounces a **server search** (250 ms by default — `searchDebounce`). The trigger announces proper combobox semantics (`aria-haspopup="listbox"`, `aria-controls` → the listbox) and shows a chevron that flips while open.

`SuiMultiSelect` binds `value: string[]` and renders the selection as chips with individual remove buttons. The trigger is a `role="combobox"` div (so the chip removes can be real buttons) and collapses the overflow smartly (`maxDisplay`):

- `maxDisplay="responsive"` (default) — Ant Design `maxTagCount="responsive"` behaviour: chips are measured and as many fit in the trigger as the width allows, the rest collapse into a **“+n” pill** (hover shows the hidden labels, click expands to show every chip with a “Show less” control)
- `maxDisplay={3}` — a fixed cap

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

Column `meta` options: `align`, `width`, `class`, `hiddenByDefault`.

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

## Testing

sui ships with the two-tier test setup the library itself uses:

```sh
npm run test              # vitest + @testing-library/svelte (127 unit tests)
npm run test:e2e          # Playwright: interaction + visual regression (real Chromium)
npm run test:e2e:update   # regenerate visual baselines
```

The unit suite covers props/ARIA/wiring in jsdom; the Playwright suite runs against the built demo app in a real browser (infinite scroll, floating positioning, focus management, full form flows) plus per-route visual baselines under `tests/e2e/__screenshots__`.

## Demo app

The repo's routes are a live showcase of every component — run `npm run dev` and browse:

| Route | Shows |
| --- | --- |
| `/` | overview + philosophy |
| `/input` | labels, icons, actions, variants, zod-as-you-type, sizes, skeletons |
| `/button` | variants, icons, loading, shared size scale |
| `/selection` | static + infinite-scroll selects, searchable combobox, smart chip overflow, variant showcase |
| `/data-table` | sorting, search, selection, pagination, column visibility, 10k virtual rows |
| `/toggles` | checkbox / radio / switch with zod |
| `/validation` | a complete form driven by one zod object schema + timing-mode playground |
| `/pagination` | the infinite-scroll REST guide with live examples |
| `/skeletons` | every skeleton, every size |

## Credits

Built on [shadcn-svelte](https://shadcn-svelte.com) (design system + 58 primitives), [bits-ui](https://bits-ui.com) (headless behaviors), [TanStack Table](https://tanstack.com/table) + [TanStack Virtual](https://tanstack.com/virtual), and [zod](https://zod.dev). Icons by [lucide](https://lucide.dev).

## License

Apache-2.0
