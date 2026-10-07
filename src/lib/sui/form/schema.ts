import { ZodError } from 'zod';

/**
 * Schema interop layer — one adapter, every vendor.
 *
 * sui's blessed path is zod v4 (smart defaults, precise `form.fields.<name>`
 * typing), but any [Standard Schema v1](https://standardschema.dev) vendor
 * works at every boundary (`createSuiForm`, `createSuiSubmitter`, the
 * per-control `schema` prop): zod, Valibot, ArkType, Effect — they all expose
 * `~standard.validate`, and their issues all normalise onto sui's
 * `path → messages` shape here.
 *
 * The spec types below are vendored (≈40 lines, no new dependency); the
 * interface is structural, so zod v4 schemas match it without any adapter
 * code on their side.
 */

/**
 * Standard Schema v1 — vendor-neutral validation interface.
 * Structural copy of the spec (standardschema.dev); `Input` is only a
 * phantom type parameter in the spec itself, so input-side inference for
 * non-zod vendors falls back to `unknown` (use `form.field('path')` there).
 */
export interface StandardSchemaV1Props<Input = unknown, Output = Input> {
	readonly version: 1;
	readonly vendor: string;
	readonly validate: (
		value: unknown
	) => StandardSchemaV1Result<Output> | Promise<StandardSchemaV1Result<Output>>;
}

/** A Standard Schema validation result: success carries a value, failure carries issues. */
export type StandardSchemaV1Result<Output = unknown> =
	| { readonly value: Output; readonly issues?: undefined }
	| { readonly value?: undefined; readonly issues: ReadonlyArray<StandardSchemaV1Issue> };

/** A single validation issue, standard-shape. */
export interface StandardSchemaV1Issue {
	readonly message: string;
	readonly path?: ReadonlyArray<PropertyKey | StandardSchemaV1PathSegment> | undefined;
}

/** Path segment box — used by vendors (e.g. ArkType) that wrap keys. */
export interface StandardSchemaV1PathSegment {
	readonly key: PropertyKey;
}

/** Anything implementing the Standard Schema v1 interface. */
export type StandardSchemaV1<Input = unknown, Output = Input> = {
	readonly '~standard': StandardSchemaV1Props<Input, Output>;
};

/**
 * Any schema sui can drive: zod v4 (implements `~standard` structurally, gets
 * precise input/output typing) or any other Standard Schema v1 vendor.
 */
export type SuiSchemaLike = StandardSchemaV1<any, any>;

/**
 * Edit-side (input) type of a schema — precise for zod v4 (reads the `_zod`
 * brand exactly like zod's own `z.input`), `unknown` for other vendors.
 */
export type SuiIn<S> = S extends { _zod: { input: any } } ? S['_zod']['input'] : unknown;

/**
 * Parsed (output) type of a schema — precise for zod v4, `unknown` for other
 * vendors.
 */
export type SuiOut<S> = S extends { _zod: { output: any } } ? S['_zod']['output'] : unknown;

// ---------------------------------------------------------------- issues

/** One normalised issue: dotted field path (`''` = form-level) + message. */
export interface SuiIssue {
	readonly path: string;
	readonly message: string;
}

/** True for thenables — guards against async schemas sneaking into sync paths. */
function isPromiseLike(value: unknown): value is Promise<unknown> {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { then?: unknown }).then === 'function'
	);
}

/**
 * Flattens any path shape onto a dotted string: `['a', 'b']` → `'a.b'`,
 * `[]`/`undefined` → `''` (form-level), `[{key: 'a'}]` → `'a'` (ArkType-style
 * boxed segments). Numeric indices join as-is (`'tags.0'`).
 */
export function suiIssuePath(path: unknown): string {
	if (!Array.isArray(path) || path.length === 0) return '';
	const keys = path.map((segment) =>
		segment !== null && typeof segment === 'object' && 'key' in (segment as object)
			? (segment as { key: PropertyKey }).key
			: segment
	);
	return keys.map(String).join('.');
}

/**
 * Normalises issue-ish objects (Standard Schema, zod, plain JSON) into
 * {@link SuiIssue}s. Tolerates missing messages and missing paths.
 */
export function suiIssues(issues: ReadonlyArray<{ message?: string; path?: unknown }>): SuiIssue[] {
	const out: SuiIssue[] = [];
	for (const issue of issues) {
		out.push({ path: suiIssuePath(issue.path), message: issue.message || 'Invalid value' });
	}
	return out;
}

/** Normalises a caught `ZodError` into {@link SuiIssue}s. */
export function suiIssuesFromZodError(error: ZodError): SuiIssue[] {
	return suiIssues(error.issues as ReadonlyArray<{ message?: string; path?: unknown }>);
}

/**
 * Is this thrown value an issue-carrying error (`ZodError` or any standard
 * `{ issues: [...] }` shape)? Used to map server-side rejections onto fields
 * regardless of which vendor produced them.
 */
export function isIssueCarrying(
	error: unknown
): error is { issues: ReadonlyArray<{ message?: string; path?: unknown }> } {
	return (
		typeof error === 'object' &&
		error !== null &&
		Array.isArray((error as { issues?: unknown }).issues)
	);
}

/** Normalises a caught issue-carrying error into {@link SuiIssue}s. */
export function suiIssuesFromError(error: unknown): SuiIssue[] {
	if (error instanceof ZodError) return suiIssuesFromZodError(error);
	if (isIssueCarrying(error)) return suiIssues(error.issues);
	return [];
}

// ----------------------------------------------------------------- parse

export type SuiParseResult =
	| { readonly ok: true; readonly data: unknown }
	| { readonly ok: false; readonly issues: SuiIssue[] };

/**
 * Thrown when a schema is asynchronous where sui validates synchronously.
 * Async checks belong in `asyncValidators` (createSuiForm) or `onsubmit`.
 */
export class SuiAsyncSchemaError extends Error {
	constructor(component: string) {
		super(
			`${component}: the schema is asynchronous — use a synchronous schema, or move async checks into asyncValidators / onsubmit.`
		);
		this.name = 'SuiAsyncSchemaError';
	}
}

type SafeParseSchema = {
	safeParse: (value: unknown) => {
		success: boolean;
		data?: unknown;
		error?: { issues?: ReadonlyArray<{ message?: string; path?: unknown }> };
	};
};

/**
 * Parses `values` against any supported schema and normalises the result.
 * Prefers the Standard Schema `~standard.validate` channel (zod v4, Valibot,
 * ArkType, Effect); falls back to a duck-typed `safeParse` (zod v3 style).
 */
export function suiParse(schema: unknown, values: unknown, component = 'sui'): SuiParseResult {
	if (schema !== null && typeof schema === 'object' && '~standard' in schema) {
		let result: StandardSchemaV1Result<unknown> | Promise<StandardSchemaV1Result<unknown>>;
		try {
			result = (schema as StandardSchemaV1)['~standard'].validate(values);
		} catch (cause) {
			// zod v4 throws $ZodAsyncError when sync-parsing an async schema
			const error = new SuiAsyncSchemaError(component);
			(error as { cause?: unknown }).cause = cause;
			throw error;
		}
		if (isPromiseLike(result)) throw new SuiAsyncSchemaError(component);
		if ('issues' in result && result.issues) {
			return { ok: false, issues: suiIssues(result.issues) };
		}
		return { ok: true, data: result.value };
	}
	if (
		schema !== null &&
		typeof schema === 'object' &&
		typeof (schema as { safeParse?: unknown }).safeParse === 'function'
	) {
		const result = (schema as SafeParseSchema).safeParse(values);
		if (isPromiseLike(result)) throw new SuiAsyncSchemaError(component);
		if (result.success) return { ok: true, data: result.data };
		return { ok: false, issues: suiIssues(result.error?.issues ?? []) };
	}
	throw new Error(
		`${component}: the schema must be a zod schema or any Standard Schema v1 compatible schema.`
	);
}

// -------------------------------------------------------------- grouping

/** Where focus lands after a submit fails validation (form-level option). */
export type SuiFocusOnSubmit = 'summary' | 'field' | 'none';

/**
 * Groups issues under their dotted paths, deduplicating repeated messages
 * and preserving order (`''` collects form-level messages).
 */
export function groupSuiIssues(issues: readonly SuiIssue[]): Record<string, string[]> {
	const map: Record<string, string[]> = {};
	for (const issue of issues) {
		const list = map[issue.path] ?? (map[issue.path] = []);
		if (!list.includes(issue.message)) list.push(issue.message);
	}
	return map;
}

// -------------------------------------------------------------- messages

/**
 * A message override: replacement text, or a resolver receiving the issue
 * (path + original message) and returning the copy to display.
 */
export type SuiMessageResolver = string | ((issue: SuiIssue) => string);

/**
 * Centralised message overrides for a form, keyed by field path. `''` and
 * `'_form'` target form-level messages; `'*'` matches every field.
 */
export type SuiMessages = Record<string, SuiMessageResolver>;

/**
 * Applies a {@link SuiMessages} map to parsed issues — the copy/i18n layer
 * that rescues vendors' default messages ("Invalid input: expected string…"
 * is not user copy). Lookup order: exact path → root aliases (`''`,
 * `'_form'`) for form-level issues → `'*'` fallback.
 */
export function resolveSuiMessages(
	issues: readonly SuiIssue[],
	messages: SuiMessages | undefined
): SuiIssue[] {
	if (!messages) return [...issues];
	const out: SuiIssue[] = [];
	for (const issue of issues) {
		const entry =
			messages[issue.path] ??
			(issue.path === '' ? (messages['_form'] ?? messages['']) : undefined) ??
			messages['*'];
		if (entry === undefined) {
			out.push(issue);
			continue;
		}
		const message = typeof entry === 'function' ? entry(issue) : entry;
		out.push({ ...issue, message: message || 'Invalid value' });
	}
	return out;
}

// ------------------------------------------------------ server error maps

function asMessageList(value: unknown): string[] {
	if (typeof value === 'string') return value ? [value] : [];
	if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
	return [];
}

/**
 * Server-error mapping helpers — everything the `setErrors` escape hatch
 * eats, produced from the shapes servers actually return.
 */
export const suiErrors = {
	/**
	 * Standard-shape issues (zod `error.issues`, Valibot, ArkType, plain JSON)
	 * → `Record<path, messages>`. Root issues land under `''`.
	 */
	fromIssues(
		issues: ReadonlyArray<{ message?: string; path?: unknown }>
	): Record<string, string[]> {
		return groupSuiIssues(suiIssues(issues));
	},
	/** A caught `ZodError` → `Record<path, messages>`. */
	fromZodError(error: ZodError): Record<string, string[]> {
		return groupSuiIssues(suiIssuesFromZodError(error));
	},
	/**
	 * Tolerant mapper for JSON error bodies:
	 * - `{ issues: [{ message, path }] }` — zod / Standard Schema JSON
	 * - `{ errors: { email: 'Taken' | ['Taken'] } }` — nested field map
	 * - `{ email: 'Taken', message: '…' }` — direct field map; the reserved
	 *   keys `message`, `error`, `detail` and `form` map to form-level (`''`)
	 * - `'_form'` keys always map to form-level
	 */
	fromResponse(body: unknown): Record<string, string[]> {
		const out: Record<string, string[]> = {};
		if (body === null || typeof body !== 'object') return out;
		const record = body as Record<string, unknown>;
		if (Array.isArray(record.issues)) {
			Object.assign(out, suiErrors.fromIssues(record.issues));
		}
		const source =
			record.errors !== null && typeof record.errors === 'object'
				? (record.errors as Record<string, unknown>)
				: record;
		for (const [key, value] of Object.entries(source)) {
			if (key === 'issues') continue; // handled above
			const list = asMessageList(value);
			if (list.length === 0) continue;
			if (
				key === 'message' ||
				key === 'error' ||
				key === 'detail' ||
				key === 'form' ||
				key === '_form'
			) {
				out[''] = [...(out[''] ?? []), ...list];
				continue;
			}
			out[key] = [...(out[key] ?? []), ...list];
		}
		return out;
	}
};
