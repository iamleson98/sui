import { tick, untrack } from 'svelte';
import type { SuiValidateOn } from '../zod.js';
import {
	suiIssuesFromError,
	suiParse,
	groupSuiIssues,
	resolveSuiMessages,
	schemaAt,
	type SuiFocusOnSubmit,
	type SuiIn,
	type SuiIssue,
	type SuiMessages,
	type SuiOut,
	type SuiSchemaLike
} from './schema.js';

export type { SuiFocusOnSubmit };

/**
 * Schema-driven form engine.
 *
 * One schema (zod v4 — or any Standard Schema v1 vendor) drives every field:
 * values, validation timing, error display and submit parsing. Application
 * code never calls `schema.safeParse` or maps `issue.path` to fields — pass a
 * field handle (`form.fields.email`) to any sui control and validation
 * happens by itself, following the researched "reward early, validate late"
 * pattern (Baymard / Adam Silver, react-hook-form `onTouched`, superforms
 * `auto`):
 *
 * - a pristine text field is never scolded mid-keystroke — the first blur
 *   validates, then every change re-validates ("auto");
 * - discrete controls (select, combobox, multi-select, checkbox, radio,
 *   switch) validate on every change — each interaction is a completed
 *   answer;
 * - the WHOLE schema runs on every validation trigger (a `refine` can
 *   attach an error to any field), but errors only DISPLAY on fields the
 *   user has visited (reveal gating) — so pristine fields stay quiet while
 *   cross-field rules stay fresh;
 * - a failed submit reveals every invalid field at once, and from then on
 *   any edit re-validates the form instantly (react-hook-form
 *   `isSubmitted` semantics);
 * - server errors set via `form.setErrors()` show immediately and are
 *   cleared the moment the user edits that field (superforms tainted
 *   fields);
 * - async validators (availability checks, strength meters) run after the
 *   sync schema passes, debounced and cancellable, with a `Checking…`
 *   state on the field and a submit-time flush;
 * - on success the `onsubmit` callback receives the parsed, typed and
 *   transformed output — no manual parsing anywhere.
 */

/**
 * How a control interacts with the field it is bound to.
 *
 * - `'text'` — free-text input; under `validateOn: 'auto'` the first blur
 *   validates, then every change (the field stays quiet mid-keystroke).
 * - `'discrete'` — pickers and toggles; every change is a completed
 *   answer, so under `'auto'` each change validates immediately.
 */
export type SuiFormFieldMode = 'text' | 'discrete';

/**
 * An async validator: resolve with a message (or list of messages) to fail,
 * or with anything else (`true`, `null`, `undefined`, `void`) to pass. A
 * rejected validator surfaces its error message on the field — visible
 * feedback beats silent failure.
 *
 * `context.signal` aborts when the run is superseded (newer input, reset,
 * submit flush of a newer value) — pass it to `fetch` so stale checks are
 * cancelled on the network too.
 */
export type SuiAsyncValidator = (
	value: unknown,
	values: Record<string, unknown>,
	context: { signal: AbortSignal }
) => Promise<string | string[] | true | null | undefined | void>;

/**
 * Structural protocol controls consume via their `field` prop. Method
 * syntax keeps the value parameter bivariant, so a
 * `SuiFormField<'admin' | 'editor'>` is assignable to a
 * `SuiFieldHandle<string | undefined>` prop — enum select handles slot
 * straight into `SuiSelect` without generic gymnastics.
 */
export type SuiFieldHandle<V = unknown> = {
	/** Dotted path of the field inside the form values (`'email'`, `'address.city'`). */
	readonly name: string;
	/** Live value of the field. Assigning marks the field dirty (no validation). */
	readonly value: V;
	/** Errors that should display right now (reveal-gated, deduplicated). */
	readonly errors: string[];
	readonly invalid: boolean;
	readonly touched: boolean;
	readonly dirty: boolean;
	/** The control's DOM id — registered by sui controls, used by error summaries. */
	readonly controlId: string | undefined;
	/** An async validator for this field is currently running. */
	readonly isValidating: boolean;
	/**
	 * Text the control shows while checking (the form's `checkingMessage`;
	 * `undefined` → the control's localized default, see `setSuiStrings`).
	 */
	readonly checkingMessage: string | undefined;
	/**
	 * The field has been revealed AND currently validates AND holds a
	 * meaningful value (`''`, `undefined`, `[]` and `false` don't count) —
	 * the "reward early" signal.
	 */
	readonly valid: boolean;
	/** `valid` gated on the form's `rewardValid` option — drives the success ring. */
	readonly rewardValid: boolean;
	/**
	 * User-driven value change: writes the value, marks dirty/edited and
	 * runs smart validation. Controls call this instead of assigning `value`.
	 */
	change(value: V, mode?: SuiFormFieldMode): void;
	/** User left the field: marks touched, reveals it and validates. */
	blur(): void;
	/** Force validation now (reveals the field). Returns the displayed errors. */
	validate(): string[];
	/** Attach external (server) errors to this field. */
	setErrors(errors: string[]): void;
	/** Hide and clear this field's errors. */
	clear(): void;
	/**
	 * Report the control's DOM id for summary links / focus management —
	 * and that a rendered control displays this path's errors. Returns an
	 * unregister function: call it when the control unmounts (return it
	 * from the `$effect` that registers).
	 */
	registerControl(id: string): (() => void) | void;
};

/** Per-field timing overrides, merged over the form-wide defaults. */
export type SuiFieldOptions = {
	/** When this field's schema runs (form-level `validateOn` by default). */
	validateOn?: SuiValidateOn;
	/** Debounce (ms) for this field's change validation (form `debounce` by default). */
	debounce?: number;
	/** Debounce (ms) for this field's async validator (form `asyncDebounce` by default). */
	asyncDebounce?: number;
};

/** Options accepted by {@link createSuiForm}. */
export type SuiFormOptions<Schema extends SuiSchemaLike> = {
	/**
	 * Seed values layered on top of the schema-derived defaults
	 * (strings → `''`, booleans → `false`, arrays → `[]`, `z.default()`
	 * → its value, everything else → `undefined`). Non-zod schemas derive
	 * no defaults — pass everything you need here.
	 */
	initialValues?: Partial<SuiIn<Schema>>;
	/**
	 * When validation runs for text fields. `'auto'` (default) = blur
	 * first, then every change; discrete controls always validate on
	 * change. Also accepts `'blur' | 'change' | 'both' | 'none'`.
	 */
	validateOn?: SuiValidateOn;
	/** Debounce (ms) applied to change-driven validation. Default `0`. */
	debounce?: number;
	/** Per-field overrides merged over the global timing config. */
	fields?: Record<string, SuiFieldOptions>;
	/**
	 * Centralised message overrides (copy / i18n rescue layer), keyed by
	 * field path — `''` / `'_form'` target form-level messages, `'*'`
	 * matches every field. Applied after issue grouping keys are known.
	 */
	messages?: SuiMessages;
	/**
	 * Async validators keyed by field path. They run once the sync schema
	 * passes for that (revealed) field, debounced, cancellable; their
	 * messages display exactly like server errors and clear on edit.
	 * Submit flushes any stale checks before calling `onsubmit`.
	 */
	asyncValidators?: Record<string, SuiAsyncValidator>;
	/** Debounce (ms) for async validators. Default `400`. */
	asyncDebounce?: number;
	/** Text controls show while an async validator runs. Default `'Checking…'` (see `setSuiStrings`). */
	checkingMessage?: string;
	/**
	 * Where focus lands after a failed submit: `'summary'` (default) —
	 * the error summary box (GOV.UK pattern) when one is rendered, else
	 * the form-error banner, else the first invalid field; `'field'` —
	 * always the first invalid field; `'none'` — no focus management.
	 */
	focusOnSubmit?: SuiFocusOnSubmit;
	/**
	 * Reward revealed, valid, non-empty fields with a subtle success ring
	 * (the "reward early" half of the Baymard pattern). Default `false`.
	 */
	rewardValid?: boolean;
	/**
	 * Server errors to show on first render — the `errors` a no-JS form
	 * action returned (`data.form?.errors`), so a failed progressive
	 * submit re-renders with its messages in place.
	 */
	initialErrors?: Record<string, string[] | string>;
	/**
	 * Called with the parsed output when a submit passes validation.
	 * Throw a `ZodError` (or any issue-carrying error) to map server-side
	 * issues back onto fields; any other thrown error becomes a
	 * form-level error. Server errors from the previous attempt are
	 * cleared before this runs — each server round-trip is the new verdict.
	 * Repeated submits while it runs (double clicks, Enter mashing) join
	 * the in-flight attempt instead of calling it again.
	 */
	onsubmit?: (data: SuiOut<Schema>, form: SuiFormInstance<Schema>) => void | Promise<void>;
};

/** Depth guard for the recursive path types below. */
type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Every dotted path into `T`: `'address'`, `'address.city'`, `'tags.0'`,
 * `` `items.${number}.name` `` — the strings `form.field()` / `form.array()`
 * accept. Resolves to `never` for schemas without introspectable types
 * (non-zod vendors), where paths stay plain strings.
 */
export type SuiPath<T, D extends number = 6> = [D] extends [never]
	? never
	: T extends readonly (infer U)[]
		? `${number}` | `${number}.${SuiPath<NonNullable<U>, Prev[D]>}`
		: T extends Date | File | ((...args: never[]) => unknown)
			? never
			: T extends object
				? {
						[K in keyof T & string]-?:
							| K
							| (NonNullable<T[K]> extends object
									? `${K}.${SuiPath<NonNullable<T[K]>, Prev[D]>}`
									: never);
					}[keyof T & string]
				: never;

/**
 * What `form.field()` / `form.array()` accept for input type `In`: the
 * schema's own {@link SuiPath}s when they can be derived (zod), otherwise
 * any string (other vendors, `any`).
 */
export type SuiPathArg<In> = 0 extends 1 & In
	? string
	: [SuiPath<In>] extends [never]
		? string
		: SuiPath<In>;

/** The value type at a dotted {@link SuiPath}. */
export type SuiPathValue<T, P extends string> = P extends `${infer H}.${infer R}`
	? H extends keyof T
		? SuiPathValue<NonNullable<T[H]>, R>
		: T extends readonly (infer U)[]
			? SuiPathValue<NonNullable<U>, R>
			: unknown
	: P extends keyof T
		? T[P]
		: T extends readonly (infer U)[]
			? U
			: unknown;

/** The item type of the array at `P` (`unknown` when `P` is not an array). */
export type SuiArrayItem<T, P extends string> =
	NonNullable<SuiPathValue<T, P>> extends readonly (infer U)[] ? U : unknown;

/**
 * Per-key field handles, typed on the **edit side** (input) — the
 * shape controls bind while the user is typing. Top-level schema keys map
 * straight through (zod schemas; other vendors resolve to `unknown` — use
 * `form.field('path')` there); nested paths via `form.field('a.b')`.
 */
export type SuiFieldsFor<Schema extends SuiSchemaLike> = {
	[K in keyof SuiIn<Schema> & string]-?: SuiFormField<SuiIn<Schema>[K]>;
};

/**
 * Smart per-type default: `''` for strings, `false` for booleans, `[]` for
 * arrays/sets, `{}` for nested objects, `z.default()` values, `undefined`
 * for enums/literals/numbers/dates (nothing chosen yet) and for anything
 * `.optional()` (not provided). Only meaningful for zod schemas — other
 * vendors pass `initialValues` instead.
 */
function schemaDefault(schema: SuiSchemaLike): unknown {
	const def = (schema as any)?.def as
		| {
				type: string;
				innerType?: SuiSchemaLike;
				in?: SuiSchemaLike;
				items?: SuiSchemaLike[];
				defaultValue?: unknown;
		  }
		| undefined;
	if (!def) return undefined;
	switch (def.type) {
		case 'default':
		case 'prefault':
			return typeof def.defaultValue === 'function' ? def.defaultValue() : def.defaultValue;
		case 'optional':
			// "not provided" — an optional `z.email()` / `z.iso.date()` must not
			// start as '' (which fails the format it is allowed to skip)
			return undefined;
		case 'nullable':
		case 'readonly':
		case 'catch':
		case 'nonoptional':
			return def.innerType ? schemaDefault(def.innerType) : undefined;
		case 'pipe':
			// form values hold the INPUT side of a pipe: `z.string().transform(…)`
			// edits a string, so it starts from the string default
			return def.in ? schemaDefault(def.in) : undefined;
		case 'lazy':
			return schemaDefault((schema as any).schema ?? def.innerType);
		case 'string':
			return '';
		case 'boolean':
			return false;
		case 'array':
		case 'set':
			return [];
		case 'object':
		case 'record':
			return schemaDefaults(schema);
		case 'tuple':
			return def.items?.map(schemaDefault) ?? [];
		default:
			// enum, literal, number, int, date, union, intersection, … — unchosen
			return undefined;
	}
}

/** Defaults for every key of a `z.object` shape (refinements keep `.shape`). */
function schemaDefaults(schema: SuiSchemaLike): Record<string, unknown> {
	const shape = (schema as any)?.shape as Record<string, SuiSchemaLike> | undefined;
	if (!shape) return {};
	const out: Record<string, unknown> = {};
	for (const [key, sub] of Object.entries(shape)) {
		out[key] = schemaDefault(sub);
	}
	return out;
}

/** Read a dotted path (`'address.city'`) out of a (reactive) object. */
function getByPath(obj: unknown, path: string): unknown {
	let cur: unknown = obj;
	for (const key of path.split('.')) {
		if (cur === null || cur === undefined) return undefined;

		cur = (cur as any)[key];
	}
	return cur;
}

/** Write a dotted path, creating missing intermediate objects. */
function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
	const keys = path.split('.');
	let cur: Record<string, unknown> = obj;
	for (let i = 0; i < keys.length - 1; i++) {
		const key = keys[i];
		const next = cur[key];
		if (typeof next !== 'object' || next === null) cur[key] = {};

		cur = cur[key] as any;
	}
	cur[keys[keys.length - 1]] = value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object') return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

/**
 * Deep copy for form values: plain objects and arrays (including Svelte
 * `$state` proxies) are copied, Dates are re-created, and every other
 * object — `File`, `@internationalized/date` values, class instances — is
 * shared by reference. `structuredClone` would throw on proxies and
 * functions and strip class prototypes (a `CalendarDate` would lose its
 * methods).
 */
function cloneValue<T>(value: T): T {
	if (Array.isArray(value)) return value.map(cloneValue) as T;
	if (value instanceof Date) return new Date(value.getTime()) as T;
	if (isPlainObject(value)) {
		const out: Record<string, unknown> = {};
		for (const [key, nested] of Object.entries(value)) out[key] = cloneValue(nested);
		return out as T;
	}
	return value;
}

/** Structural equality for form values (dirty tracking). */
function valuesEqual(a: unknown, b: unknown): boolean {
	if (Object.is(a, b)) return true;
	if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
	if (Array.isArray(a) && Array.isArray(b)) {
		return a.length === b.length && a.every((item, index) => valuesEqual(item, b[index]));
	}
	if (isPlainObject(a) && isPlainObject(b)) {
		const keys = Object.keys(a);
		if (keys.length !== Object.keys(b).length) return false;
		return keys.every((key) => Object.hasOwn(b, key) && valuesEqual(a[key], b[key]));
	}
	return false;
}

/** `'a.b.c'` → `['a.b', 'a']` — every ancestor path, nearest first. */
function ancestorsOf(path: string): string[] {
	const out: string[] = [];
	let index = path.lastIndexOf('.');
	while (index > 0) {
		path = path.slice(0, index);
		out.push(path);
		index = path.lastIndexOf('.');
	}
	return out;
}

/** Does a value count as "answered"? (drives the reward ring) */
function hasMeaningfulValue(value: unknown): boolean {
	if (value === undefined || value === null || value === '' || value === false) return false;
	if (Array.isArray(value) && value.length === 0) return false;
	return true;
}

/** Normalises an async validator's resolution into displayable errors. */
function asyncOutcomeToErrors(outcome: unknown): string[] {
	if (typeof outcome === 'string') return outcome ? [outcome] : [];
	if (Array.isArray(outcome)) {
		return outcome.filter((m): m is string => typeof m === 'string' && m.length > 0);
	}
	// true / null / undefined / void / false → valid (booleans are ignored:
	// return a message to fail)
	return [];
}

/**
 * A single field's handle: what sui controls consume through the `field`
 * prop. Thin — all state lives on the owning {@link SuiFormInstance}.
 */
export class SuiFormField<V = unknown> {
	#form: SuiFormInstance<SuiSchemaLike>;
	#path: string;
	#controlId = $state<string | undefined>(undefined);

	constructor(form: SuiFormInstance<SuiSchemaLike>, path: string) {
		this.#form = form;
		this.#path = path;
	}

	get name(): string {
		return this.#path;
	}

	get value(): V {
		return getByPath(this.#form.values, this.#path) as V;
	}

	/** Programmatic set — updates dirty tracking, does NOT trigger validation. */
	set value(next: V) {
		this.#form.writeValue(this.#path, next);
	}

	get errors(): string[] {
		return this.#form.displayedErrors(this.#path);
	}

	get invalid(): boolean {
		return this.errors.length > 0;
	}

	get touched(): boolean {
		return !!this.#form.touched[this.#path];
	}

	get dirty(): boolean {
		return !!this.#form.dirty[this.#path];
	}

	get controlId(): string | undefined {
		return this.#controlId;
	}

	get isValidating(): boolean {
		return !!this.#form.isValidating[this.#path];
	}

	get checkingMessage(): string | undefined {
		return this.#form.checkingMessage;
	}

	get valid(): boolean {
		if (!this.#form.revealed[this.#path]) return false;
		if (this.errors.length > 0) return false;
		return hasMeaningfulValue(this.value);
	}

	get rewardValid(): boolean {
		return this.#form.rewardValid && this.valid;
	}

	/** User-driven change — the control's event path. */
	change(value: V, mode: SuiFormFieldMode = 'text'): void {
		this.#form.fieldChange(this.#path, value, mode);
	}

	/** User left the field. */
	blur(): void {
		this.#form.fieldBlur(this.#path);
	}

	/** Force validation (reveals the field). */
	validate(): string[] {
		this.#form.fieldValidate(this.#path);
		return this.errors;
	}

	/** Attach external (server) errors to this field. */
	setErrors(errors: string[]): void {
		this.#form.setFieldExternal(this.#path, errors);
	}

	/** Hide and clear this field's errors (local + external). */
	clear(): void {
		this.#form.clearField(this.#path);
	}

	registerControl(id: string): () => void {
		this.#controlId = id;
		this.#form.noteControl(+1);
		return () => {
			this.#form.noteControl(-1);
			// a newer control (re-render with a new id) may own the field now
			if (this.#controlId === id) this.#controlId = undefined;
		};
	}
}

/**
 * Re-key a path-indexed record after the array at `path` changed:
 * `items.2.name` → `items.1.name` per `remap` (`null` drops the entry).
 */
function remapRecord<T>(
	record: Record<string, T>,
	path: string,
	remap: (index: number) => number | null
): Record<string, T> {
	const prefix = `${path}.`;
	const out: Record<string, T> = {};
	for (const [key, value] of Object.entries(record)) {
		if (!key.startsWith(prefix)) {
			out[key] = value;
			continue;
		}
		const rest = key.slice(prefix.length);
		const dot = rest.indexOf('.');
		const segment = dot < 0 ? rest : rest.slice(0, dot);
		if (!/^\d+$/.test(segment)) {
			out[key] = value;
			continue;
		}
		const next = remap(Number(segment));
		if (next === null) continue;
		out[`${prefix}${next}${dot < 0 ? '' : rest.slice(dot)}`] = value;
	}
	return out;
}

/** One rendered item of a {@link SuiFormArray}. */
export type SuiFormArrayEntry<Item> = {
	/** Stable identity — use as the `{#each}` key. */
	readonly key: string;
	readonly index: number;
	/** Dotted path of this item (`'emails.1'`). */
	readonly path: string;
	/** Field handle of the item (or of a sub-field: `item.field('name')`). */
	field<V = Item>(sub?: string): SuiFormField<V>;
};

/**
 * A dynamic list of fields — see {@link SuiFormInstance.array}. Mutations
 * keep errors, touched, dirty and async state attached to the item they
 * describe, and keys stable so Svelte moves DOM instead of re-creating it.
 */
export class SuiFormArray<Item = unknown> {
	#form: SuiFormInstance<SuiSchemaLike>;
	#path: string;

	constructor(form: SuiFormInstance<SuiSchemaLike>, path: string) {
		this.#form = form;
		this.#path = path;
	}

	/** Dotted path of the array. */
	get path(): string {
		return this.#path;
	}

	/** Live item values (reactive). */
	get items(): Item[] {
		const value = getByPath(this.#form.values, this.#path);
		return (Array.isArray(value) ? value : []) as Item[];
	}

	get length(): number {
		return this.items.length;
	}

	/** Stable keys, one per item. */
	get keys(): string[] {
		return this.#form.arrayKeys(this.#path);
	}

	/** Render list: `{#each arr.entries as item (item.key)}`. */
	get entries(): SuiFormArrayEntry<Item>[] {
		return this.keys.map((key, index) => ({
			key,
			index,
			path: `${this.#path}.${index}`,
			field: <V = Item>(sub?: string) =>
				this.#form.fieldAt<V>(sub ? `${this.#path}.${index}.${sub}` : `${this.#path}.${index}`)
		}));
	}

	/** Field handle of item `index` (or its sub-field). */
	field<V = Item>(index: number, sub?: string): SuiFormField<V> {
		return this.#form.fieldAt<V>(sub ? `${this.#path}.${index}.${sub}` : `${this.#path}.${index}`);
	}

	#item(value?: Item): Item {
		return (value !== undefined ? value : this.#form.newArrayItem(this.#path)) as Item;
	}

	/** Append an item (default: the element schema's default). */
	push(value?: Item): void {
		this.insert(this.length, value);
	}

	/** Insert at `index` (clamped); later items shift up. */
	insert(index: number, value?: Item): void {
		const item = this.#item(value);
		this.#form.arrayMutate(this.#path, (items, keys) => {
			const at = Math.max(0, Math.min(index, items.length));
			items.splice(at, 0, item);
			keys.splice(at, 0, `k${Math.random().toString(36).slice(2, 10)}`);
			return (i) => (i >= at ? i + 1 : i);
		});
	}

	/**
	 * Remove the item at `index`; its state goes with it. Focus moves to the
	 * neighbouring item (WCAG 2.4.3 — it would otherwise fall to `<body>`);
	 * pass `{ focus: false }` to opt out.
	 */
	remove(index: number, options: { focus?: boolean } = {}): void {
		if (index < 0 || index >= this.length) return;
		this.#form.arrayMutate(this.#path, (items, keys) => {
			items.splice(index, 1);
			keys.splice(index, 1);
			return (i) => (i === index ? null : i > index ? i - 1 : i);
		});
		// the user acted on the list: its own rule (min items) may now speak
		this.#form.revealed[this.#path] = true;
		if (options.focus !== false && this.length > 0) {
			void this.#form.focusControlUnder(`${this.#path}.${Math.min(index, this.length - 1)}`);
		}
	}

	/** Move an item; the ones between shift. */
	move(from: number, to: number): void {
		const length = this.length;
		if (from === to || from < 0 || from >= length || to < 0 || to >= length) return;
		this.#form.arrayMutate(this.#path, (items, keys) => {
			const [item] = items.splice(from, 1);
			const [key] = keys.splice(from, 1);
			items.splice(to, 0, item);
			keys.splice(to, 0, key!);
			return (i) => {
				if (i === from) return to;
				if (from < to && i > from && i <= to) return i - 1;
				if (from > to && i >= to && i < from) return i + 1;
				return i;
			};
		});
	}

	/** Swap two items. */
	swap(a: number, b: number): void {
		const length = this.length;
		if (a === b || a < 0 || b < 0 || a >= length || b >= length) return;
		this.#form.arrayMutate(this.#path, (items, keys) => {
			[items[a], items[b]] = [items[b], items[a]];
			[keys[a], keys[b]] = [keys[b]!, keys[a]!];
			return (i) => (i === a ? b : i === b ? a : i);
		});
	}

	/** Remove every item. */
	clear(): void {
		this.#form.arrayMutate(this.#path, (items, keys) => {
			items.length = 0;
			keys.length = 0;
			return () => null;
		});
	}

	/** Replace the whole list (all per-item state is dropped). */
	replace(next: Item[]): void {
		this.#form.arrayMutate(this.#path, (items, keys) => {
			items.splice(0, items.length, ...next);
			keys.length = 0;
			return () => null;
		});
	}
}

/**
 * The form instance returned by {@link createSuiForm}. Hand it to
 * `<SuiForm {form}>`, pass `form.fields.<name>` to any sui control's
 * `field` prop, and read reactive state (`values`, `formErrors`,
 * `isSubmitting`, …) anywhere in the template.
 */
export class SuiFormInstance<Schema extends SuiSchemaLike> {
	#schema: Schema;
	#options: SuiFormOptions<Schema>;
	/** The baseline values: schema defaults + `initialValues` (or the last `reset(values)`). */
	#defaults: Record<string, unknown>;
	#handles = new Map<string, SuiFormField<never>>();
	#arrays = new Map<string, SuiFormArray<unknown>>();
	/** Stable item keys per array path (kept in lockstep by `arrayMutate`). */
	#arrayKeys = new Map<string, string[]>();
	#arrayVersion = $state(0);
	#keySeq = 0;
	/** Mounted controls bound to this form (effects only — never counted on the server). */
	#controlCount = $state(0);
	#fieldsProxy: SuiFieldsFor<Schema> | undefined;
	#timers = new Map<string, ReturnType<typeof setTimeout>>();
	/** The submit attempt in progress — repeated submits join it. */
	#inflightSubmit: Promise<boolean> | null = null;

	/**
	 * Live form values — a deeply reactive proxy holding the EDIT side of
	 * the schema (its input type: a `z.string().transform(Number)` field
	 * holds the string). Edit directly for programmatic changes
	 * (`form.values.email = '…'`); reads are reactive anywhere in a
	 * template or effect. `onsubmit` receives the parsed output.
	 */
	values = $state<Record<string, unknown>>({}) as SuiIn<Schema>;
	/** Schema issues from the last validation run, by dotted path (`''` = form-level). */
	issues = $state<Record<string, string[]>>({});
	/** External (server) errors by dotted path — cleared when the field is edited. */
	external = $state<Record<string, string[]>>({});
	/** Async validator results by dotted path — cleared when the field is edited. */
	asyncIssues = $state<Record<string, string[]>>({});
	/** Async validators currently running, by dotted path. */
	isValidating = $state<Record<string, boolean>>({});
	/** Reveal gate per path: errors display only on fields the user has earned. */
	revealed = $state<Record<string, boolean>>({});
	/** Blurred at least once. */
	touched = $state<Record<string, boolean>>({});
	/** Edited since the last external-errors update. */
	edited = $state<Record<string, boolean>>({});
	/**
	 * Paths whose value differs from the baseline (initial values, or the
	 * last `reset(values)`). Editing a field back to its initial value
	 * removes its entry — `Object.keys(form.dirty)` lists exactly the
	 * unsaved changes (see also {@link isDirty}).
	 */
	dirty = $state<Record<string, boolean>>({});
	/** Completed submit attempts (success or failure). */
	submitCount = $state(0);
	/** An async flush or `onsubmit` callback is currently running. */
	isSubmitting = $state(false);
	#submittedInvalid = $state(false);
	// async validator bookkeeping: debounce timers, run ids (cancellation),
	// abort controllers, in-flight runs (same-value dedup) and last-checked
	// value memos
	#asyncTimers = new Map<string, ReturnType<typeof setTimeout>>();
	#asyncRuns = new Map<string, number>();
	#asyncAborts = new Map<string, AbortController>();
	#asyncInflight = new Map<string, { value: unknown; promise: Promise<void> }>();
	#asyncMemo = new Map<string, { value: unknown; errors: string[] }>();

	constructor(schema: Schema, options: SuiFormOptions<Schema> = {}) {
		this.#schema = schema;
		this.#options = options;
		this.#defaults = this.#baseline(options.initialValues);
		// Object.assign THROUGH the $state proxy: nested defaults become
		// deeply reactive without ever reassigning `values`.
		Object.assign(this.values as Record<string, unknown>, cloneValue(this.#defaults));
		if (options.initialErrors) this.setErrors(options.initialErrors);
	}

	/** Schema-derived defaults with `initial` layered on top (deep-copied, never aliased). */
	#baseline(initial: unknown): Record<string, unknown> {
		return {
			...schemaDefaults(this.#schema),
			...cloneValue((initial ?? {}) as Record<string, unknown>)
		};
	}

	// ------------------------------------------------------------ reactive

	/** Silent validity check — never mutates display state (sync schema only). */
	get isValid(): boolean {
		return this.#parseNow().ok;
	}

	/** True after at least one completed submit attempt. */
	get isSubmitted(): boolean {
		return this.submitCount > 0;
	}

	/**
	 * Form-level errors: root `refine`s without a path (shown once a
	 * submit or `validate()` revealed them — never while the user is
	 * still filling the form in), plus server-level messages.
	 */
	get formErrors(): string[] {
		return [
			...new Set([
				...(this.revealed[''] ? (this.issues[''] ?? []) : []),
				...(this.external[''] ?? []),
				...(this.asyncIssues[''] ?? [])
			])
		];
	}

	/**
	 * Revealed field errors that no rendered control can display — the
	 * path has no registered control and neither has any ancestor (a
	 * schema key without a field, a typo'd path, a field that is not
	 * mounted). `<SuiForm>` shows them in its banner so a failed submit is
	 * never silent. Descendant issues of a controlled field (`tags.1` under
	 * a multi-select bound to `tags`) display on that field instead.
	 */
	get unmappedErrors(): string[] {
		// controls register in effects: on the server and during hydration
		// none have yet, and "no control can show it" would be a false alarm
		if (this.#controlCount === 0) return [];
		const out = new Set<string>();
		for (const path of this.#issuePaths()) {
			if (path === '' || !this.revealed[path] || this.#ownerOf(path) !== null) continue;
			for (const message of this.#messagesAt(path, path)) out.add(message);
		}
		return [...out];
	}

	/** Some error is displayed right now (field, form-level or unmapped). */
	get hasErrors(): boolean {
		if (this.formErrors.length > 0 || this.unmappedErrors.length > 0) return true;
		for (const path of this.#issuePaths()) {
			if (path === '') continue;
			if (this.displayedErrors(this.#ownerOf(path) ?? path).length > 0) return true;
		}
		return false;
	}

	/** Some value differs from its initial value (unsaved changes). */
	get isDirty(): boolean {
		return Object.keys(this.dirty).length > 0;
	}

	/**
	 * Text controls show while an async validator runs (`checkingMessage`
	 * option); `undefined` lets each control use its localized default
	 * (`'Checking…'`, see `setSuiStrings`).
	 */
	get checkingMessage(): string | undefined {
		return this.#options.checkingMessage;
	}

	/** Where focus lands after a failed submit (`focusOnSubmit` option, default `'summary'`). */
	get focusOnSubmit(): SuiFocusOnSubmit {
		return this.#options.focusOnSubmit ?? 'summary';
	}

	/** Whether revealed valid fields get the success ring (`rewardValid` option). */
	get rewardValid(): boolean {
		return this.#options.rewardValid === true;
	}

	/**
	 * Entries for `<SuiErrorSummary>`: one per invalid, revealed field with
	 * a registered control — ready-made `{ fieldId, message }` links.
	 */
	get errorSummary(): { fieldId: string; message: string }[] {
		// one entry per CONTROL: descendant issues (array items, nested
		// keys) collapse onto the controlled field that displays them
		const paths = [
			...new Set(
				this.#issuePaths()
					.filter((path) => path !== '')
					.map((path) => this.#ownerOf(path))
					.filter((path): path is string => path !== null)
			)
		];
		const order = Object.keys(this.values as Record<string, unknown>);
		paths.sort((a, b) => {
			const ia = order.indexOf(a.split('.')[0]);
			const ib = order.indexOf(b.split('.')[0]);
			return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
		});
		const out: { fieldId: string; message: string }[] = [];
		for (const path of paths) {
			const handle = this.fieldAt(path);
			if (handle.errors.length === 0 || !handle.controlId) continue;
			out.push({ fieldId: handle.controlId, message: handle.errors.join(' ') });
		}
		return out;
	}

	/** Per-key field handles (`form.fields.email`) — created lazily, cached. */
	get fields(): SuiFieldsFor<Schema> {
		this.#fieldsProxy ??= new Proxy({} as SuiFieldsFor<Schema>, {
			get: (_target, key) => (typeof key === 'string' ? (this.fieldAt(key) as never) : undefined),
			has: (_target, key) => typeof key === 'string'
		});
		return this.#fieldsProxy;
	}

	/**
	 * Field handle for a dotted path. Paths are type-checked against the
	 * schema (`form.field('address.city')`, `` form.field(`items.${i}.name`) ``)
	 * and the handle carries the value's type; plain strings still work for
	 * other vendors and computed paths.
	 */
	field<P extends SuiPathArg<SuiIn<Schema>>>(path: P): SuiFormField<SuiPathValue<SuiIn<Schema>, P>>;
	field(path: string): SuiFormField<unknown> {
		return this.fieldAt(path);
	}

	/** Untyped field handle for a computed path (internal helpers, adapters). @internal */
	fieldAt<V = unknown>(path: string): SuiFormField<V> {
		let handle = this.#handles.get(path);
		if (!handle) {
			handle = new SuiFormField(this as never, path) as SuiFormField<never>;
			this.#handles.set(path, handle);
		}
		return handle as SuiFormField<V>;
	}

	/**
	 * A dynamic list of fields — "add another email", invoice line items.
	 * Keys are stable across inserts, removals and moves, and every piece
	 * of per-item state (errors, touched, dirty, async checks) follows the
	 * item it belongs to:
	 *
	 * ```svelte
	 * {#each emails.entries as item (item.key)}
	 *   <SuiInput field={item.field()} label="Email {item.index + 1}" />
	 *   <SuiButton onclick={() => emails.remove(item.index)}>Remove</SuiButton>
	 * {/each}
	 * <SuiButton onclick={() => emails.push()}>Add another</SuiButton>
	 * ```
	 */
	array<P extends SuiPathArg<SuiIn<Schema>>>(path: P): SuiFormArray<SuiArrayItem<SuiIn<Schema>, P>>;
	array(path: string): SuiFormArray<unknown> {
		let handle = this.#arrays.get(path);
		if (!handle) {
			handle = new SuiFormArray(this as never, path);
			this.#arrays.set(path, handle);
		}
		return handle;
	}

	/** A control (un)registered. @internal */
	noteControl(delta: 1 | -1): void {
		// untracked read: this runs inside the controls' registration
		// effects, which must not subscribe to (and re-trigger on) the count
		untrack(() => {
			this.#controlCount += delta;
		});
	}

	/** The default value of a new array item at `path`'s element schema. @internal */
	newArrayItem(path: string): unknown {
		const element = schemaAt(this.#schema, `${path}.0`);
		return cloneValue(element ? schemaDefault(element) : undefined);
	}

	/** Stable keys of the array at `path`, reconciled with its length. @internal */
	arrayKeys(path: string): string[] {
		void this.#arrayVersion; // re-read after every structural change
		const value = getByPath(this.values, path);
		const length = Array.isArray(value) ? value.length : 0;
		let keys = this.#arrayKeys.get(path);
		if (!keys) this.#arrayKeys.set(path, (keys = []));
		while (keys.length < length) keys.push(`k${++this.#keySeq}`);
		if (keys.length > length) keys.length = length;
		return [...keys];
	}

	/**
	 * Structural change of the array at `path`: `op` mutates the live array
	 * and its keys in lockstep and returns the old → new index map (`null` =
	 * removed). Per-item state is re-indexed accordingly. @internal
	 */
	arrayMutate(
		path: string,
		op: (items: unknown[], keys: string[]) => (index: number) => number | null
	): void {
		this.arrayKeys(path); // reconcile first
		let items = getByPath(this.values, path);
		if (!Array.isArray(items)) {
			setByPath(this.values as Record<string, unknown>, path, []);
			items = getByPath(this.values, path);
		}
		const keys = this.#arrayKeys.get(path)!;
		const remap = op(items as unknown[], keys);
		const prefix = `${path}.`;

		// in-flight/debounced work and memos describe positions that moved
		for (const key of new Set([
			...this.#asyncTimers.keys(),
			...this.#asyncInflight.keys(),
			...this.#asyncMemo.keys(),
			...this.#asyncAborts.keys()
		])) {
			if (!key.startsWith(prefix)) continue;
			this.#cancelAsync(key);
			this.#asyncMemo.delete(key);
		}
		for (const [key, timer] of this.#timers) {
			if (!key.startsWith(prefix)) continue;
			clearTimeout(timer);
			this.#timers.delete(key);
		}

		this.issues = remapRecord(this.issues, path, remap);
		this.external = remapRecord(this.external, path, remap);
		this.asyncIssues = remapRecord(this.asyncIssues, path, remap);
		this.isValidating = remapRecord(this.isValidating, path, remap);
		this.revealed = remapRecord(this.revealed, path, remap);
		this.touched = remapRecord(this.touched, path, remap);
		this.edited = remapRecord(this.edited, path, remap);
		// dirty is value-vs-baseline: the list as a whole is the unit
		for (const key of Object.keys(this.dirty)) {
			if (key.startsWith(prefix)) delete this.dirty[key];
		}
		this.edited[path] = true;
		this.#syncDirty(path);

		// issues describe the old positions — refresh them silently (display
		// is still reveal-gated)
		const result = this.#parseNow();
		if (result.ok) this.issues = {};
		else this.#applyIssues(result.issues);
		this.#arrayVersion += 1;
	}

	/** Focus the first control rendered under `prefix` (after the DOM settled). @internal */
	async focusControlUnder(prefix: string): Promise<void> {
		await tick();
		for (const [path, handle] of this.#handles) {
			if (path !== prefix && !path.startsWith(`${prefix}.`)) continue;
			const id = handle.controlId;
			const el = id ? document.getElementById(id) : null;
			if (!el) continue;
			const target = el.matches('input, textarea, select, button, [tabindex], [contenteditable]')
				? el
				: el.querySelector<HTMLElement>(
						'input, textarea, select, button, [tabindex], [contenteditable]'
					);
			if (target) {
				target.focus();
				return;
			}
		}
	}

	// ------------------------------------------------------------ engine

	/**
	 * The errors a field should display right now: nothing until the field
	 * is revealed; afterwards the deduplicated union of external (server),
	 * async and local (schema) messages — server/async errors drop out
	 * once the field has been edited, because they describe a previous
	 * value.
	 */
	displayedErrors(path: string): string[] {
		const messages: string[] = [];
		if (this.revealed[path]) messages.push(...this.#messagesAt(path, path));
		// descendant issues (array items, nested keys) whose nearest
		// controlled ancestor is this field: a multi-select bound to `tags`
		// shows the `tags.1` "Enter a valid email" too
		const prefix = `${path}.`;
		for (const child of this.#issuePaths()) {
			if (!child.startsWith(prefix) || this.#ownerOf(child) !== path) continue;
			if (!this.revealed[path] && !this.revealed[child]) continue;
			messages.push(...this.#messagesAt(child, path));
		}
		return [...new Set(messages)];
	}

	/**
	 * Messages recorded at exactly `path`. External (server) messages hide
	 * once `path` — or the controlled field `gate` displaying it — was
	 * edited: they describe a previous value.
	 */
	#messagesAt(path: string, gate: string): string[] {
		const external = this.edited[path] || this.edited[gate] ? [] : (this.external[path] ?? []);
		return [...external, ...(this.asyncIssues[path] ?? []), ...(this.issues[path] ?? [])];
	}

	/** Every path that currently carries a local, external or async issue. */
	#issuePaths(): string[] {
		return [
			...new Set([
				...Object.keys(this.issues),
				...Object.keys(this.external),
				...Object.keys(this.asyncIssues)
			])
		];
	}

	/**
	 * The nearest path — `path` itself or an ancestor — with a registered
	 * control, i.e. the field that displays `path`'s errors; `null` when
	 * nothing rendered can show them.
	 */
	#ownerOf(path: string): string | null {
		for (const candidate of [path, ...ancestorsOf(path)]) {
			if (this.#handles.get(candidate)?.controlId) return candidate;
		}
		return null;
	}

	/** Track `path` in `dirty` iff its value differs from the baseline. */
	#syncDirty(path: string): void {
		const changed = !valuesEqual(getByPath(this.values, path), getByPath(this.#defaults, path));
		if (changed) {
			if (!this.dirty[path]) this.dirty[path] = true;
		} else if (path in this.dirty) {
			delete this.dirty[path];
		}
	}

	/**
	 * Programmatic write — updates dirty tracking, never validates.
	 * @internal — the field handle's `value` setter
	 */
	writeValue(path: string, value: unknown): void {
		setByPath(this.values as Record<string, unknown>, path, value);
		this.#syncDirty(path);
	}

	/**
	 * Control reported a user-driven change.
	 * @internal — called by {@link SuiFormField.change}
	 */
	fieldChange(path: string, value: unknown, mode: SuiFormFieldMode): void {
		setByPath(this.values as Record<string, unknown>, path, value);
		this.#syncDirty(path);
		this.edited[path] = true;
		// async (and server) errors describe the PREVIOUS value — drop them
		// the moment the user edits; a fresh check is scheduled below
		if (this.asyncIssues[path]) {
			const next = { ...this.asyncIssues };
			delete next[path];
			this.asyncIssues = next;
		}
		const validateOn = this.#validateOnFor(path);
		if (validateOn === 'none') return;
		if (!this.#shouldValidateChange(path, mode, validateOn)) return;
		// the user acted on this field — its own result may now display
		this.revealed[path] = true;
		const run = () => this.#runValidation(path);
		const debounce = this.#debounceFor(path);
		if (debounce > 0) {
			clearTimeout(this.#timers.get(path));
			this.#timers.set(path, setTimeout(run, debounce));
		} else {
			run();
		}
	}

	/** Control reported blur: touch, reveal, validate. @internal */
	fieldBlur(path: string): void {
		this.touched[path] = true;
		clearTimeout(this.#timers.get(path));
		this.#timers.delete(path);
		const mode = this.#validateOnFor(path);
		if (mode === 'none' || mode === 'change') return;
		this.revealed[path] = true;
		this.#runValidation(path);
	}

	/** Force a single field's validation (reveals it). @internal */
	fieldValidate(path: string): void {
		this.touched[path] = true;
		this.revealed[path] = true;
		clearTimeout(this.#timers.get(path));
		this.#timers.delete(path);
		this.#runValidation(path);
	}

	/** External (server) errors for one field. @internal */
	setFieldExternal(path: string, errors: string[]): void {
		this.#mergeExternal({ [path]: errors });
	}

	/**
	 * Merge server-side messages by path (`''` = form-level): a non-empty
	 * list displays immediately (revealed, display rights taken back from
	 * any earlier edit); an empty list removes that path's messages.
	 */
	#mergeExternal(errors: Record<string, string[]>): void {
		const next: Record<string, string[]> = { ...this.external };
		for (const [path, list] of Object.entries(errors)) {
			if (list.length === 0) {
				delete next[path];
				continue;
			}
			next[path] = list;
			this.edited[path] = false;
			this.revealed[path] = true;
		}
		this.external = next;
	}

	/** Clear one field's local + external + async errors. @internal */
	clearField(path: string): void {
		const ext = { ...this.external };
		delete ext[path];
		this.external = ext;
		const asyncNext = { ...this.asyncIssues };
		delete asyncNext[path];
		this.asyncIssues = asyncNext;
		if (this.issues[path]) {
			const next = { ...this.issues };
			delete next[path];
			this.issues = next;
		}
		this.revealed[path] = false;
	}

	/** Form-level `validateOn`, overridable per field via `fields` option. */
	#validateOnFor(path: string): SuiValidateOn {
		return this.#options.fields?.[path]?.validateOn ?? this.#options.validateOn ?? 'auto';
	}

	/** Form-level sync debounce, overridable per field. */
	#debounceFor(path: string): number {
		return this.#options.fields?.[path]?.debounce ?? this.#options.debounce ?? 0;
	}

	/** Async validator debounce, overridable per field. Default 400ms. */
	#asyncDebounceFor(path: string): number {
		return this.#options.fields?.[path]?.asyncDebounce ?? this.#options.asyncDebounce ?? 400;
	}

	#shouldValidateChange(path: string, mode: SuiFormFieldMode, validateOn: SuiValidateOn): boolean {
		if (validateOn === 'change' || validateOn === 'both') return true;
		if (validateOn === 'auto') {
			return (
				mode === 'discrete' ||
				!!this.touched[path] ||
				!!this.revealed[path] ||
				this.#submittedInvalid
			);
		}
		// 'blur' (and anything else): after a failed submit, edits still
		// re-validate instantly — react-hook-form `isSubmitted` semantics
		return this.#submittedInvalid;
	}

	/** Whole-schema parse → issue map → reveal-gated display everywhere. */
	#runValidation(revealPath?: string): void {
		if (revealPath) this.revealed[revealPath] = true;
		const result = this.#parseNow();
		if (result.ok) {
			this.issues = {};
		} else {
			this.#applyIssues(result.issues);
		}
		this.#scheduleAsync(revealPath);
	}

	#parseNow(): ReturnType<typeof suiParse> {
		return suiParse(this.#schema, this.values, 'createSuiForm');
	}

	/** Normalised + copy-overridden issues → grouped by dotted path. */
	#applyIssues(issues: readonly SuiIssue[]): void {
		this.issues = groupSuiIssues(resolveSuiMessages(issues, this.#options.messages));
	}

	// -------------------------------------------------------- async engine

	/**
	 * Schedules the async validator for a path — only when the field has
	 * earned display rights, the sync schema is clean for it, and its
	 * current value hasn't already been checked. Cancels anything pending
	 * for the path first (newest input wins).
	 */
	#scheduleAsync(path?: string): void {
		if (!path) return;
		const validator = this.#options.asyncValidators?.[path];
		if (!validator) return;
		if (!this.revealed[path]) return;
		if ((this.issues[path] ?? []).length > 0) {
			// sync errors own the display — no point checking an invalid value
			this.#cancelAsync(path);
			this.#setAsyncIssues(path, []);
			return;
		}
		const value = getByPath(this.values, path);
		const inflight = this.#asyncInflight.get(path);
		if (inflight && inflight.value === value) return; // this exact value is being checked
		const memo = this.#asyncMemo.get(path);
		if (memo && memo.value === value) return; // this exact value was checked
		this.#cancelAsync(path);
		const runId = (this.#asyncRuns.get(path) ?? 0) + 1;
		this.#asyncRuns.set(path, runId);
		const wait = this.#asyncDebounceFor(path);
		if (wait <= 0) {
			void this.#runAsync(path, runId);
			return;
		}
		const timer = setTimeout(() => {
			this.#asyncTimers.delete(path);
			void this.#runAsync(path, runId);
		}, wait);
		this.#asyncTimers.set(path, timer);
	}

	async #runAsync(path: string, runId: number): Promise<void> {
		const validator = this.#options.asyncValidators?.[path];
		if (!validator) return;
		if (runId !== this.#asyncRuns.get(path)) return; // superseded meanwhile
		const value = getByPath(this.values, path);
		if ((this.issues[path] ?? []).length > 0) {
			// sync errors appeared during the debounce — stand down (no memo:
			// once sync clears, the same value still needs its async check)
			this.#setValidating(path, false);
			this.#setAsyncIssues(path, []);
			return;
		}
		this.#setValidating(path, true);
		this.#asyncAborts.get(path)?.abort();
		const controller = new AbortController();
		this.#asyncAborts.set(path, controller);
		const promise = this.#executeAsync(path, value, validator, runId, controller.signal);
		this.#asyncInflight.set(path, { value, promise });
		try {
			await promise;
		} finally {
			// only drop our own entries — a newer run may have replaced them
			if (this.#asyncInflight.get(path)?.promise === promise) this.#asyncInflight.delete(path);
			if (this.#asyncAborts.get(path) === controller) this.#asyncAborts.delete(path);
		}
	}

	/** Runs the validator and applies its result (unless superseded). */
	async #executeAsync(
		path: string,
		value: unknown,
		validator: SuiAsyncValidator,
		runId: number,
		signal: AbortSignal
	): Promise<void> {
		let errors: string[];
		try {
			const outcome = await validator(value, this.values as Record<string, unknown>, { signal });
			errors = asyncOutcomeToErrors(outcome);
		} catch (error) {
			// a rejected validator surfaces as a field error — visible
			// feedback beats silent failure (an abort is no failure: the run
			// was superseded and its result is discarded below)
			errors = [error instanceof Error ? error.message : String(error)];
		}
		if (signal.aborted || runId !== this.#asyncRuns.get(path)) return; // superseded
		this.#setValidating(path, false);
		this.#asyncMemo.set(path, { value, errors });
		this.#setAsyncIssues(path, errors);
	}

	/** Cancels pending + in-flight async work for a path. */
	#cancelAsync(path: string): void {
		const timer = this.#asyncTimers.get(path);
		if (timer) {
			clearTimeout(timer);
			this.#asyncTimers.delete(path);
		}
		this.#asyncAborts.get(path)?.abort();
		this.#asyncAborts.delete(path);
		this.#asyncInflight.delete(path);
		// bump the run id so any in-flight promise is ignored when it resolves
		this.#asyncRuns.set(path, (this.#asyncRuns.get(path) ?? 0) + 1);
		this.#setValidating(path, false);
	}

	#setAsyncIssues(path: string, errors: string[]): void {
		if (errors.length === 0) {
			if (this.asyncIssues[path]) {
				const next = { ...this.asyncIssues };
				delete next[path];
				this.asyncIssues = next;
			}
			return;
		}
		this.asyncIssues = { ...this.asyncIssues, [path]: errors };
		this.revealed[path] = true; // an async failure must display
	}

	#setValidating(path: string, on: boolean): void {
		if (!!this.isValidating[path] === on) return;
		const next = { ...this.isValidating, [path]: on };
		if (!on) delete next[path];
		this.isValidating = next;
	}

	/**
	 * Submit-time async gate: every configured async validator whose value
	 * has not been checked runs NOW (un-debounced) and is awaited. Returns
	 * false when any async error surfaced.
	 */
	async #flushAsync(): Promise<boolean> {
		const validators = this.#options.asyncValidators;
		if (!validators) return true;
		const runs: Promise<void>[] = [];
		for (const path of Object.keys(validators)) {
			const value = getByPath(this.values, path);
			const memo = this.#asyncMemo.get(path);
			if (memo && memo.value === value) continue; // already checked
			const inflight = this.#asyncInflight.get(path);
			if (inflight && inflight.value === value) {
				runs.push(inflight.promise); // being checked right now — await it
				continue;
			}
			this.#cancelAsync(path);
			const runId = (this.#asyncRuns.get(path) ?? 0) + 1;
			this.#asyncRuns.set(path, runId);
			runs.push(this.#runAsync(path, runId));
		}
		if (runs.length > 0) await Promise.all(runs);
		return Object.values(this.asyncIssues).every((list) => list.length === 0);
	}

	// ------------------------------------------------------------ public API

	/**
	 * Validate the whole form. Every invalid field is revealed at once.
	 * Returns overall validity (sync schema only — async validators run on
	 * edit/blur/submit, not here).
	 */
	validate(): boolean {
		const result = this.#parseNow();
		if (result.ok) {
			this.issues = {};
			return true;
		}
		this.#applyIssues(result.issues);
		for (const path of Object.keys(this.issues)) this.revealed[path] = true;
		return false;
	}

	/**
	 * Merge server-side errors into the display. Keys are dotted field
	 * paths; `''` or `'_form'` target form-level errors. Values may be a
	 * single message or a list. Cleared per-field as soon as it is edited.
	 */
	setErrors(errors: Record<string, string[] | string>): void {
		const normalised: Record<string, string[]> = {};
		for (const [rawKey, raw] of Object.entries(errors)) {
			const key = rawKey === '_form' ? '' : rawKey;
			normalised[key] = [...(normalised[key] ?? []), ...(Array.isArray(raw) ? raw : [raw])];
		}
		this.#mergeExternal(normalised);
	}

	/** Clear every error (local + external + async), keeping values and touched state. */
	clearErrors(): void {
		this.issues = {};
		this.external = {};
		this.asyncIssues = {};
	}

	/** Shallow-merge values programmatically (no validation; updates dirty tracking). */
	setValues(patch: Partial<SuiIn<Schema>>): void {
		for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
			this.writeValue(key, value);
		}
	}

	/**
	 * Values back to the baseline; all validation, dirty and submit state
	 * forgotten. Pass `values` to make them the NEW baseline — layered over
	 * the schema defaults exactly like `initialValues` — e.g. once an edit
	 * form's record has loaded, or after a successful save:
	 *
	 * ```ts
	 * const user = await api.getUser(id);
	 * form.reset(user); // pristine form showing the loaded record
	 * ```
	 */
	reset(values?: Partial<SuiIn<Schema>>): void {
		if (values !== undefined) this.#defaults = this.#baseline(values);
		this.issues = {};
		this.external = {};
		this.asyncIssues = {};
		this.isValidating = {};
		this.revealed = {};
		this.touched = {};
		this.edited = {};
		this.dirty = {};
		this.submitCount = 0;
		this.isSubmitting = false;
		this.#submittedInvalid = false;
		for (const timer of this.#timers.values()) clearTimeout(timer);
		this.#timers.clear();
		for (const timer of this.#asyncTimers.values()) clearTimeout(timer);
		this.#asyncTimers.clear();
		for (const controller of this.#asyncAborts.values()) controller.abort();
		this.#asyncAborts.clear();
		this.#asyncRuns.clear();
		this.#asyncInflight.clear();
		this.#asyncMemo.clear();
		this.#arrayKeys.clear();
		this.#arrayVersion += 1;
		const current = this.values as Record<string, unknown>;
		for (const key of Object.keys(current)) delete current[key];
		Object.assign(current, cloneValue(this.#defaults));
	}

	/**
	 * Submit handler for `<form onsubmit={form.handleSubmit}>` (or use the
	 * `<SuiForm>` component). Validates the whole schema, flushes stale
	 * async validators, and on success the `onsubmit` callback receives
	 * the parsed output. A thrown `ZodError` (or any issue-carrying error)
	 * maps back onto fields; other errors become form-level messages.
	 * Returns whether the submit passed validation. A submit fired while
	 * one is still running joins it (same promise, no second `onsubmit`).
	 */
	handleSubmit = (event?: { preventDefault(): void }): Promise<boolean> => {
		event?.preventDefault();
		if (this.#inflightSubmit) return this.#inflightSubmit;
		const attempt = this.#submit().finally(() => {
			this.#inflightSubmit = null;
		});
		this.#inflightSubmit = attempt;
		return attempt;
	};

	/**
	 * Everything a submit does BEFORE the server round-trip: whole-schema
	 * parse (reveals every invalid field), async-validator flush and the
	 * failed-submit bookkeeping — without calling `onsubmit`. This is the
	 * client-side gate for SvelteKit form actions (see `suiEnhance`):
	 * resolves `true` when the browser may go on to post the form.
	 */
	prepareSubmit(): Promise<boolean> {
		return this.#submit(false);
	}

	async #submit(callback = true): Promise<boolean> {
		this.submitCount += 1;
		const result = this.#parseNow();
		if (!result.ok) {
			this.#applyIssues(result.issues);
			// a failed attempt reveals every invalid field (and form-level
			// refines) and puts the form into always-revalidate-on-change mode
			for (const path of Object.keys(this.issues)) this.revealed[path] = true;
			this.#submittedInvalid = true;
			return false;
		}
		this.issues = {};
		this.#submittedInvalid = false;
		const onsubmit = callback ? this.#options.onsubmit : undefined;
		const hasAsync = !!this.#options.asyncValidators;
		if (!onsubmit && !hasAsync) return true;
		// the async flush is real work (network) — the button should show it
		this.isSubmitting = true;
		try {
			if (hasAsync) {
				const asyncOk = await this.#flushAsync();
				if (!asyncOk) {
					// async failures surface exactly like failed parses:
					// revealed, focusable, eagerly revalidated
					for (const path of Object.keys(this.asyncIssues)) this.revealed[path] = true;
					this.#submittedInvalid = true;
					return false;
				}
			}
			if (!onsubmit) return true;
			// this round-trip's verdict replaces the previous one: stale
			// server messages ("Network error", "Already registered") must
			// not outlive a fresh attempt — the server re-reports what still
			// applies
			this.external = {};
			await onsubmit(result.data as SuiOut<Schema>, this);
			return true;
		} catch (error) {
			// ZodError and any issue-carrying error (Standard Schema vendors)
			// map back onto fields AS SERVER ERRORS: per-field taint-clearing
			// (editing one field never wipes another's message) and server
			// copy is authoritative — the messages map does NOT re-resolve it.
			const issues = suiIssuesFromError(error);
			if (issues.length > 0) {
				this.#mergeExternal(groupSuiIssues(issues));
				this.#submittedInvalid = true;
				return false;
			}
			const message = error instanceof Error ? error.message : String(error);
			this.#mergeExternal({ '': [message] });
			return false;
		} finally {
			this.isSubmitting = false;
		}
	}
}

/**
 * Create a schema-driven form. See {@link SuiFormInstance}.
 *
 * ```svelte
 * <script lang="ts">
 *   const form = createSuiForm(schema, {
 *     onsubmit: async (data) => await api.createAccount(data)
 *   });
 * </script>
 *
 * <SuiForm {form}>
 *   <SuiInput field={form.fields.email} label="Email" type="email" required />
 *   <SuiCheckbox field={form.fields.accept} label="I accept the terms" />
 *   <SuiButton type="submit">Create account</SuiButton>
 * </SuiForm>
 * ```
 */
export function createSuiForm<Schema extends SuiSchemaLike>(
	schema: Schema,
	options: SuiFormOptions<Schema> = {}
): SuiFormInstance<Schema> {
	return new SuiFormInstance(schema, options);
}
