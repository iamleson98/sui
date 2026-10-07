import { ZodError, type ZodType, type z } from 'zod';
import type { SuiValidateOn } from '../zod.js';

/**
 * Schema-driven form engine.
 *
 * One zod schema drives every field: values, validation timing, error
 * display and submit parsing. Application code never calls
 * `schema.safeParse` or maps `issue.path` to fields — pass a field handle
 * (`form.fields.email`) to any sui control and validation happens by
 * itself, following the researched "reward early, validate late" pattern
 * (Baymard / Adam Silver, react-hook-form `onTouched`, superforms `auto`):
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
 * - on success the `onsubmit` callback receives the zod-parsed, typed and
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
	/** Report the control's DOM id for summary links / focus management. */
	registerControl(id: string): void;
};

/** Options accepted by {@link createSuiForm}. */
export type SuiFormOptions<Schema extends ZodType> = {
	/**
	 * Seed values layered on top of the schema-derived defaults
	 * (strings → `''`, booleans → `false`, arrays → `[]`, `z.default()`
	 * → its value, everything else → `undefined`).
	 */
	initialValues?: Partial<z.input<Schema>>;
	/**
	 * When validation runs for text fields. `'auto'` (default) = blur
	 * first, then every change; discrete controls always validate on
	 * change. Also accepts `'blur' | 'change' | 'both' | 'none'`.
	 */
	validateOn?: SuiValidateOn;
	/** Debounce (ms) applied to change-driven validation. Default `0`. */
	debounce?: number;
	/**
	 * Called with the zod-parsed output when a submit passes validation.
	 * Throw a `ZodError` to map server-side issues back onto fields; any
	 * other thrown error becomes a form-level error.
	 */
	onsubmit?: (data: z.output<Schema>, form: SuiFormInstance<Schema>) => void | Promise<void>;
};

/**
 * Per-key field handles, typed on the **edit side** (`z.input`) — the
 * shape controls bind while the user is typing. Top-level schema keys map
 * straight through; nested paths via `form.field('a.b')`.
 */
export type SuiFieldsFor<Schema extends ZodType> = {
	[K in keyof z.input<Schema> & string]-?: SuiFormField<z.input<Schema>[K]>;
};

/** True for thenables — guards against async zod schemas sneaking in. */
function isPromiseLike(value: unknown): value is Promise<unknown> {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { then?: unknown }).then === 'function'
	);
}

/**
 * Smart per-type default: `''` for strings, `false` for booleans, `[]` for
 * arrays/sets, `{}` for nested objects, `z.default()` values, `undefined`
 * for enums/literals/numbers/dates (nothing chosen yet).
 */
function schemaDefault(schema: ZodType): unknown {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const def = (schema as any)?.def as
		| {
				type: string;
				innerType?: ZodType;
				in?: ZodType;
				items?: ZodType[];
				defaultValue?: unknown;
		  }
		| undefined;
	if (!def) return undefined;
	switch (def.type) {
		case 'default':
			return typeof def.defaultValue === 'function' ? def.defaultValue() : def.defaultValue;
		case 'optional':
		case 'nullable':
		case 'readonly':
			return def.innerType ? schemaDefault(def.innerType) : undefined;
		case 'pipe':
			// pipes (z.coerce…) transform on parse — start from the safe neutral value
			return undefined;
		case 'lazy':
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
function schemaDefaults(schema: ZodType): Record<string, unknown> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const shape = (schema as any)?.shape as Record<string, ZodType> | undefined;
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
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		cur = cur[key] as any;
	}
	cur[keys[keys.length - 1]] = value;
}

/**
 * A single field's handle: what sui controls consume through the `field`
 * prop. Thin — all state lives on the owning {@link SuiFormInstance}.
 */
export class SuiFormField<V = unknown> {
	#form: SuiFormInstance<ZodType>;
	#path: string;
	#controlId = $state<string | undefined>(undefined);

	constructor(form: SuiFormInstance<ZodType>, path: string) {
		this.#form = form;
		this.#path = path;
	}

	get name(): string {
		return this.#path;
	}

	get value(): V {
		return getByPath(this.#form.values, this.#path) as V;
	}

	/** Programmatic set — marks dirty, does NOT trigger validation. */
	set value(next: V) {
		setByPath(this.#form.values as Record<string, unknown>, this.#path, next);
		this.#form.dirty[this.#path] = true;
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

	registerControl(id: string): void {
		this.#controlId = id;
	}
}

/**
 * The form instance returned by {@link createSuiForm}. Hand it to
 * `<SuiForm {form}>`, pass `form.fields.<name>` to any sui control's
 * `field` prop, and read reactive state (`values`, `formErrors`,
 * `isSubmitting`, …) anywhere in the template.
 */
export class SuiFormInstance<Schema extends ZodType> {
	#schema: Schema;
	#options: SuiFormOptions<Schema> &
		Required<Pick<SuiFormOptions<Schema>, 'validateOn' | 'debounce'>>;
	#defaults: Record<string, unknown>;
	#handles = new Map<string, SuiFormField<never>>();
	#fieldsProxy: SuiFieldsFor<Schema> | undefined;
	#timers = new Map<string, ReturnType<typeof setTimeout>>();

	/**
	 * Live form values — a deeply reactive proxy. Edit directly for
	 * programmatic changes (`form.values.email = '…'`); reads are
	 * reactive anywhere in a template or effect.
	 */
	values = $state<Record<string, unknown>>({}) as z.output<Schema>;
	/** Schema issues from the last validation run, by dotted path (`''` = form-level). */
	issues = $state<Record<string, string[]>>({});
	/** External (server) errors by dotted path — cleared when the field is edited. */
	external = $state<Record<string, string[]>>({});
	/** Reveal gate per path: errors display only on fields the user has earned. */
	revealed = $state<Record<string, boolean>>({});
	/** Blurred at least once. */
	touched = $state<Record<string, boolean>>({});
	/** Edited since the last external-errors update. */
	edited = $state<Record<string, boolean>>({});
	/** Changed from the initial value. */
	dirty = $state<Record<string, boolean>>({});
	/** Completed submit attempts (success or failure). */
	submitCount = $state(0);
	/** An `onsubmit` callback is currently running. */
	isSubmitting = $state(false);
	#submittedInvalid = $state(false);

	constructor(schema: Schema, options: SuiFormOptions<Schema> = {}) {
		this.#schema = schema;
		this.#options = { validateOn: 'auto', debounce: 0, ...options };
		this.#defaults = {
			...schemaDefaults(schema),
			...(options.initialValues as Record<string, unknown> | undefined)
		};
		// Object.assign THROUGH the $state proxy: nested defaults become
		// deeply reactive without ever reassigning `values`.
		Object.assign(this.values as Record<string, unknown>, structuredClone(this.#defaults));
	}

	// ------------------------------------------------------------ reactive

	/** Silent validity check — never mutates display state. */
	get isValid(): boolean {
		return this.#parseNow().success;
	}

	/** True after at least one completed submit attempt. */
	get isSubmitted(): boolean {
		return this.submitCount > 0;
	}

	/** Form-level (root / `refine` without path) errors, local + external. */
	get formErrors(): string[] {
		return [...new Set([...(this.issues[''] ?? []), ...(this.external[''] ?? [])])];
	}

	get hasErrors(): boolean {
		return (
			this.formErrors.length > 0 ||
			Object.values(this.issues).some((list) => list.length > 0) ||
			Object.values(this.external).some((list) => list.length > 0)
		);
	}

	/**
	 * Entries for `<SuiErrorSummary>`: one per invalid, revealed field with
	 * a registered control — ready-made `{ fieldId, message }` links.
	 */
	get errorSummary(): { fieldId: string; message: string }[] {
		const paths = [...new Set([...Object.keys(this.issues), ...Object.keys(this.external)])].filter(
			(p) => p !== ''
		);
		const order = Object.keys(this.values as Record<string, unknown>);
		paths.sort((a, b) => {
			const ia = order.indexOf(a.split('.')[0]);
			const ib = order.indexOf(b.split('.')[0]);
			return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
		});
		const out: { fieldId: string; message: string }[] = [];
		for (const path of paths) {
			const handle = this.field(path);
			if (handle.errors.length === 0) continue;
			if (!handle.controlId) continue;
			out.push({ fieldId: handle.controlId, message: handle.errors.join(' ') });
		}
		return out;
	}

	/** Per-key field handles (`form.fields.email`) — created lazily, cached. */
	get fields(): SuiFieldsFor<Schema> {
		this.#fieldsProxy ??= new Proxy({} as SuiFieldsFor<Schema>, {
			get: (_target, key) => (typeof key === 'string' ? (this.field(key) as never) : undefined),
			has: (_target, key) => typeof key === 'string'
		});
		return this.#fieldsProxy;
	}

	/** Field handle for an explicit (possibly dotted) path. */
	field<V = unknown>(path: string): SuiFormField<V> {
		let handle = this.#handles.get(path);
		if (!handle) {
			handle = new SuiFormField(this as never, path) as SuiFormField<never>;
			this.#handles.set(path, handle);
		}
		return handle as SuiFormField<V>;
	}

	// ------------------------------------------------------------ engine

	/**
	 * The errors a field should display right now: nothing until the field
	 * is revealed; afterwards the deduplicated union of external (server)
	 * and local (schema) messages — server errors drop out once the field
	 * has been edited, because they describe a previous value.
	 */
	displayedErrors(path: string): string[] {
		if (!this.revealed[path]) return [];
		const ext = this.edited[path] ? [] : (this.external[path] ?? []);
		return [...new Set([...ext, ...(this.issues[path] ?? [])])];
	}

	/**
	 * Control reported a user-driven change.
	 * @internal — called by {@link SuiFormField.change}
	 */
	fieldChange(path: string, value: unknown, mode: SuiFormFieldMode): void {
		setByPath(this.values as Record<string, unknown>, path, value);
		this.dirty[path] = true;
		this.edited[path] = true;
		if (this.#options.validateOn === 'none') return;
		if (!this.#shouldValidateChange(path, mode)) return;
		// the user acted on this field — its own result may now display
		this.revealed[path] = true;
		const run = () => this.#runValidation(path);
		if (this.#options.debounce > 0) {
			clearTimeout(this.#timers.get(path));
			this.#timers.set(path, setTimeout(run, this.#options.debounce));
		} else {
			run();
		}
	}

	/** Control reported blur: touch, reveal, validate. @internal */
	fieldBlur(path: string): void {
		this.touched[path] = true;
		clearTimeout(this.#timers.get(path));
		this.#timers.delete(path);
		const mode = this.#options.validateOn;
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
		if (errors.length === 0) {
			const next = { ...this.external };
			delete next[path];
			this.external = next;
			return;
		}
		this.external = { ...this.external, [path]: errors };
		this.edited[path] = false;
		this.revealed[path] = true;
	}

	/** Clear one field's local + external errors. @internal */
	clearField(path: string): void {
		const ext = { ...this.external };
		delete ext[path];
		this.external = ext;
		if (this.issues[path]) {
			const next = { ...this.issues };
			delete next[path];
			this.issues = next;
		}
		this.revealed[path] = false;
	}

	#shouldValidateChange(path: string, mode: SuiFormFieldMode): boolean {
		const m = this.#options.validateOn;
		if (m === 'change' || m === 'both') return true;
		if (m === 'auto') {
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
		if (result.success) {
			this.issues = {};
			return;
		}
		this.#applyIssues(result.error);
	}

	#parseNow(): { success: true; data: z.output<Schema> } | { success: false; error: ZodError } {
		let result: ReturnType<ZodType['safeParse']>;
		try {
			result = this.#schema.safeParse(this.values);
		} catch (cause) {
			// zod v4 throws $ZodAsyncError during sync parse of async schemas
			throw new Error(
				'createSuiForm: the schema is asynchronous — use a synchronous zod schema (or move async checks into onsubmit).',
				{ cause }
			);
		}
		if (isPromiseLike(result)) {
			throw new Error(
				'createSuiForm: the schema is asynchronous — use a synchronous zod schema (or move async checks into onsubmit).'
			);
		}
		return result as
			{ success: true; data: z.output<Schema> } | { success: false; error: ZodError };
	}

	/** Group zod issues under full dotted paths (zod's flattenError only keys by the first segment). */
	#applyIssues(error: ZodError): void {
		const map: Record<string, string[]> = {};
		for (const issue of error.issues) {
			const key = issue.path.join('.');
			const message = issue.message || 'Invalid value';
			const list = map[key] ?? (map[key] = []);
			if (!list.includes(message)) list.push(message);
		}
		this.issues = map;
	}

	// ------------------------------------------------------------ public API

	/**
	 * Validate the whole form. Every invalid field is revealed at once.
	 * Returns overall validity.
	 */
	validate(): boolean {
		const result = this.#parseNow();
		if (result.success) {
			this.issues = {};
			return true;
		}
		this.#applyIssues(result.error);
		for (const path of Object.keys(this.issues)) this.revealed[path] = true;
		return false;
	}

	/**
	 * Merge server-side errors into the display. Keys are dotted field
	 * paths; `''` or `'_form'` target form-level errors. Values may be a
	 * single message or a list. Cleared per-field as soon as it is edited.
	 */
	setErrors(errors: Record<string, string[] | string>): void {
		const next: Record<string, string[]> = { ...this.external };
		for (const [rawKey, raw] of Object.entries(errors)) {
			const key = rawKey === '_form' ? '' : rawKey;
			const list = Array.isArray(raw) ? raw : [raw];
			if (list.length === 0) delete next[key];
			else next[key] = list;
			this.edited[key] = false;
			if (list.length > 0) this.revealed[key] = true;
		}
		this.external = next;
	}

	/** Clear every error (local + external), keeping values and touched state. */
	clearErrors(): void {
		this.issues = {};
		this.external = {};
	}

	/** Shallow-merge values programmatically (no validation, marks dirty). */
	setValues(patch: Partial<z.output<Schema>>): void {
		for (const [key, value] of Object.entries(patch)) {
			(this.values as Record<string, unknown>)[key] = value;
			this.dirty[key] = true;
		}
	}

	/** Values back to defaults; all validation state forgotten. */
	reset(): void {
		this.issues = {};
		this.external = {};
		this.revealed = {};
		this.touched = {};
		this.edited = {};
		this.dirty = {};
		this.submitCount = 0;
		this.isSubmitting = false;
		this.#submittedInvalid = false;
		for (const timer of this.#timers.values()) clearTimeout(timer);
		this.#timers.clear();
		const values = this.values as Record<string, unknown>;
		for (const key of Object.keys(values)) delete values[key];
		Object.assign(values, structuredClone(this.#defaults));
	}

	/**
	 * Submit handler for `<form onsubmit={form.handleSubmit}>` (or use the
	 * `<SuiForm>` component). Validates the whole schema; on success the
	 * `onsubmit` callback receives the parsed output. A thrown `ZodError`
	 * maps back onto fields; other errors become form-level messages.
	 * Returns whether the submit passed validation.
	 */
	handleSubmit = async (event?: { preventDefault(): void }): Promise<boolean> => {
		event?.preventDefault();
		this.submitCount += 1;
		const result = this.#parseNow();
		if (!result.success) {
			this.#applyIssues(result.error);
			// a failed attempt reveals every invalid field and puts the
			// form into always-revalidate-on-change mode
			for (const path of Object.keys(this.issues)) this.revealed[path] = true;
			this.#submittedInvalid = true;
			return false;
		}
		this.issues = {};
		this.#submittedInvalid = false;
		const { onsubmit } = this.#options;
		if (!onsubmit) return true;
		this.isSubmitting = true;
		try {
			await onsubmit(result.data, this);
			return true;
		} catch (error) {
			if (error instanceof ZodError) {
				this.#applyIssues(error);
				for (const path of Object.keys(this.issues)) this.revealed[path] = true;
				this.#submittedInvalid = true;
				return false;
			}
			const message = error instanceof Error ? error.message : String(error);
			this.external = { ...this.external, '': [...(this.external[''] ?? []), message] };
			return false;
		} finally {
			this.isSubmitting = false;
		}
	};
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
export function createSuiForm<Schema extends ZodType>(
	schema: Schema,
	options: SuiFormOptions<Schema> = {}
): SuiFormInstance<Schema> {
	return new SuiFormInstance(schema, options);
}
