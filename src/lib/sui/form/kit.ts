/**
 * SvelteKit form-action integration — progressive enhancement, schema-first.
 *
 * The same zod schema validates on the client (live, field by field) and in
 * the action (authoritative), and both sides speak one error shape:
 *
 * ```ts
 * // +page.server.ts
 * export const actions = {
 *   signup: async ({ request }) => {
 *     const parsed = suiParseFormData(schema, await request.formData());
 *     if (!parsed.ok) return fail(400, { errors: parsed.errors, values: parsed.values });
 *     await createAccount(parsed.data);
 *   }
 * };
 * ```
 *
 * ```svelte
 * <!-- +page.svelte -->
 * <script lang="ts">
 *   import { enhance } from '$app/forms';
 *   const form = createSuiForm(schema, {
 *     initialValues: data.form?.values,   // no-JS failure re-renders with input kept…
 *     initialErrors: data.form?.errors    // …and messages in place
 *   });
 * </script>
 * <SuiForm {form} method="POST" action="?/signup" {@attach suiEnhance(form, enhance)}>
 *   …
 * </SuiForm>
 * ```
 *
 * Without JavaScript the form posts natively (every sui control renders its
 * field path as the input `name`); with JavaScript the client schema gates
 * the request and server failures map back onto fields.
 */
import { schemaAt, suiErrors, suiParse, unwrapSchema, groupSuiIssues } from './schema.js';
import type { SuiOut, SuiSchemaLike } from './schema.js';
import type { SuiFormInstance } from './create-form.svelte.js';
import { focusFailedSubmit } from './utils.js';

// ------------------------------------------------------------ FormData → object

type Container = Record<string, unknown> | unknown[];

/** `'a.b[0].c'` / `'tags[]'` → `['a', 'b', '0', 'c']` (`'tags[]'` → `['tags', '']`). */
function tokenize(key: string): string[] {
	return key
		.replace(/\[(\d*)\]/g, (_m, index: string) => `.${index}`)
		.split('.')
		.filter((_token, i, all) => !(all[i] === '' && i !== all.length - 1));
}

function assign(root: Record<string, unknown>, key: string, value: unknown): void {
	const tokens = tokenize(key);
	let cur: Container = root;
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i]!;
		const last = i === tokens.length - 1;
		const nextIsIndex = !last && /^\d*$/.test(tokens[i + 1]!);
		if (token === '__proto__' || token === 'constructor' || token === 'prototype') return;
		if (Array.isArray(cur)) {
			const index = token === '' ? cur.length : Number(token);
			if (last) {
				cur[index] = value;
				return;
			}
			cur = (cur[index] ??= nextIsIndex ? [] : {}) as Container;
		} else {
			if (last) {
				const existing = cur[token];
				// repeated keys collect into an array (checkbox groups, multi-selects)
				cur[token] =
					existing === undefined
						? value
						: Array.isArray(existing)
							? [...existing, value]
							: [existing, value];
				return;
			}
			cur = (cur[token] ??= nextIsIndex ? [] : {}) as Container;
		}
	}
}

/** Coerce posted strings to what the schema expects: booleans, numbers, arrays. */
function coerce(value: unknown, schema: SuiSchemaLike | undefined): unknown {
	const outer = schema as any;
	if (value === undefined && outer?.def?.type === 'optional') return undefined;
	const inner = unwrapSchema(schema);
	const def = inner?.def;
	switch (def?.type) {
		case 'object': {
			const source = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
			const out: Record<string, unknown> = { ...source };
			for (const [key, sub] of Object.entries(inner.shape ?? {})) {
				out[key] = coerce(source[key], sub as SuiSchemaLike);
			}
			return out;
		}
		case 'array': {
			const list =
				value === undefined || value === '' ? [] : Array.isArray(value) ? value : [value];
			return list.map((item) => coerce(item, def.element));
		}
		case 'boolean':
			return value === true || value === 'on' || value === 'true' || value === '1';
		case 'literal': {
			// `z.literal(true)` is the idiomatic "must accept" — posted as 'on'
			const literals: unknown[] = def.values ?? [];
			if (literals.includes(true) || literals.includes(false)) {
				return value === true || value === 'on' || value === 'true' || value === '1';
			}
			if (typeof literals[0] === 'number' && typeof value === 'string' && value !== '') {
				const n = Number(value);
				return Number.isNaN(n) ? value : n;
			}
			return value;
		}
		case 'number':
		case 'int': {
			if (value === undefined || value === null || value === '') return undefined;
			const n = Number(value);
			return Number.isNaN(n) ? value : n; // let the schema report NaN input
		}
		default:
			return value;
	}
}

/**
 * Turn posted form data into a nested object: `address.city`, `lines[0].sku`
 * and `tags[]` build objects and arrays; repeated keys collect into arrays.
 * With a zod `schema`, strings are coerced to what it expects — booleans
 * (`'on'` / absent → `true` / `false`), numbers (`''` → `undefined`) and
 * arrays (absent → `[]`).
 */
export function suiFormDataToObject(
	data: FormData | URLSearchParams,
	schema?: SuiSchemaLike
): Record<string, unknown> {
	const root: Record<string, unknown> = {};
	for (const [key, value] of data.entries()) assign(root, key, value);
	return schema ? (coerce(root, schema) as Record<string, unknown>) : root;
}

/** The result of {@link suiParseFormData}. */
export type SuiFormDataResult<Schema extends SuiSchemaLike> =
	| {
			ok: true;
			/** Parsed, typed, transformed output. */
			data: SuiOut<Schema>;
			/** The coerced input (before the schema's transforms). */
			values: Record<string, unknown>;
	  }
	| {
			ok: false;
			/** Messages by dotted field path (`''` = form-level) — return it from `fail()`. */
			errors: Record<string, string[]>;
			/** The coerced input — send it back so the form re-renders with it. */
			values: Record<string, unknown>;
	  };

/**
 * Server-side counterpart of `createSuiForm`: parse a posted `FormData`
 * against the SAME schema the client used and get either typed data or a
 * `{ errors, values }` payload for `fail(400, …)`.
 *
 * Files and passwords are never echoed: `File` entries are dropped from
 * `values`, and `passwordFields` lists keys to blank.
 */
export function suiParseFormData<Schema extends SuiSchemaLike>(
	schema: Schema,
	data: FormData | URLSearchParams,
	options: { passwordFields?: string[] } = {}
): SuiFormDataResult<Schema> {
	const values = suiFormDataToObject(data, schema);
	const echo = JSON.parse(
		JSON.stringify(values, (key, value) =>
			typeof File !== 'undefined' && value instanceof File
				? undefined
				: options.passwordFields?.includes(key)
					? ''
					: value
		)
	) as Record<string, unknown>;
	const result = suiParse(schema, values, 'suiParseFormData');
	if (result.ok) return { ok: true, data: result.data as SuiOut<Schema>, values: echo };
	return { ok: false, errors: groupSuiIssues(result.issues), values: echo };
}

/** Is `path` addressable in `schema`? (exposed for tests) @internal */
export function suiHasPath(schema: SuiSchemaLike, path: string): boolean {
	return schemaAt(schema, path) !== undefined;
}

// ------------------------------------------------------------------ enhance

type EnhanceResult = {
	type: 'success' | 'failure' | 'redirect' | 'error';
	data?: unknown;
	error?: unknown;
	status?: number;
};

/** Structural subset of SvelteKit's `enhance` (from `$app/forms`). */
type KitEnhance = (
	node: HTMLFormElement,
	submit: (input: {
		cancel: () => void;
	}) => Promise<
		| void
		| ((input: {
				result: EnhanceResult;
				update: (options?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
		  }) => Promise<void>)
	>
) => { destroy: () => void };

export type SuiEnhanceOptions = {
	/** Reset values + state after a successful action. Default `false`. */
	reset?: boolean;
	/** Passed to SvelteKit's `update()`. Default `true`. */
	invalidateAll?: boolean;
	/** Called after a successful action. */
	onsuccess?: (result: EnhanceResult) => void | Promise<void>;
};

/**
 * An attachment that progressively enhances a `<SuiForm>` posting to a
 * SvelteKit action: the client schema (and async validators) gate the
 * request, then the action's `fail()` payload maps back onto fields.
 *
 * ```svelte
 * <SuiForm {form} method="POST" action="?/signup" {@attach suiEnhance(form, enhance)} />
 * ```
 */
export function suiEnhance<Schema extends SuiSchemaLike>(
	form: SuiFormInstance<Schema>,
	enhance: KitEnhance,
	options: SuiEnhanceOptions = {}
): (node: HTMLFormElement) => () => void {
	return (node) => {
		// <SuiForm> stands down: SvelteKit owns this submit
		node.setAttribute('data-sui-enhanced', '');
		const action = enhance(node, async ({ cancel }) => {
			const ok = await form.prepareSubmit();
			if (!ok) {
				cancel();
				await focusFailedSubmit(node, form);
				return;
			}
			form.isSubmitting = true;
			return async ({ result, update }) => {
				form.isSubmitting = false;
				if (result.type === 'failure') {
					const errors = suiErrors.fromResponse(result.data);
					form.setErrors(
						Object.keys(errors).length > 0 ? errors : { '': ['The request was rejected.'] }
					);
					await focusFailedSubmit(node, form);
					return;
				}
				if (result.type === 'error') {
					const message =
						(result.error as { message?: string } | undefined)?.message ?? 'Something went wrong.';
					form.setErrors({ '': [message] });
					return;
				}
				// the DOM reset would fight the controlled controls: sui owns values
				await update({ reset: false, invalidateAll: options.invalidateAll });
				if (options.reset) form.reset();
				await options.onsuccess?.(result);
			};
		});
		return () => {
			node.removeAttribute('data-sui-enhanced');
			action.destroy();
		};
	};
}
