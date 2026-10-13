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
 * zod's "you parsed an async schema synchronously" errors (v4
 * `$ZodAsyncError`, v3's async refinement/transform message). Matched by
 * message so duplicated zod copies in a bundle still match.
 */
const ASYNC_PARSE_ERROR =
	/Encountered Promise during synchronous parse|Asynchronous (refinement|transform) encountered during synchronous parse/i;

function asyncSchemaError(component: string, cause?: unknown): SuiAsyncSchemaError {
	const error = new SuiAsyncSchemaError(component);
	if (cause !== undefined) (error as { cause?: unknown }).cause = cause;
	return error;
}

/**
 * Parses `values` against any supported schema and normalises the result.
 *
 * zod schemas go through their own `safeParse`: zod's Standard Schema
 * `validate` swallows ANY synchronous throw and retries asynchronously, so
 * a plain bug inside a `refine`/`transform` (a `TypeError`, say) would
 * surface as a misleading "the schema is asynchronous" error. `safeParse`
 * lets genuine errors propagate untouched and throws a recognisable error
 * only for real async schemas. Every other vendor (Valibot, ArkType,
 * Effect, zod/mini) uses the Standard Schema `~standard.validate` channel.
 */
export function suiParse(schema: unknown, values: unknown, component = 'sui'): SuiParseResult {
	if (
		schema !== null &&
		typeof schema === 'object' &&
		typeof (schema as { safeParse?: unknown }).safeParse === 'function'
	) {
		let result: ReturnType<SafeParseSchema['safeParse']>;
		try {
			result = (schema as SafeParseSchema).safeParse(values);
		} catch (cause) {
			if (cause instanceof Error && ASYNC_PARSE_ERROR.test(cause.message)) {
				throw asyncSchemaError(component, cause);
			}
			// a bug inside the schema (refine / transform callback) — keep
			// the real error and stack trace
			throw cause;
		}
		if (isPromiseLike(result)) throw asyncSchemaError(component);
		if (result.success) return { ok: true, data: result.data };
		return { ok: false, issues: suiIssues(result.error?.issues ?? []) };
	}
	if (schema !== null && typeof schema === 'object' && '~standard' in schema) {
		const result = (schema as StandardSchemaV1)['~standard'].validate(values);
		if (isPromiseLike(result)) throw asyncSchemaError(component);
		if ('issues' in result && result.issues) {
			return { ok: false, issues: suiIssues(result.issues) };
		}
		return { ok: true, data: result.value };
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

/** Keys whose messages are form-level (not tied to one field). */
const FORM_LEVEL_KEYS = new Set([
	'',
	'_form',
	'form',
	'message',
	'error',
	'detail',
	'non_field_errors', // Django REST Framework
	'__all__' // Django forms
]);

/**
 * Envelope metadata that is never a field error: HTTP status / error codes,
 * RFC 7807 `type`/`instance`/`title`, Spring's request `path`, tracing ids…
 * (only consulted for top-level direct field maps).
 */
const METADATA_KEYS = new Set([
	'status',
	'statusCode',
	'code',
	'errorCode',
	'type',
	'title',
	'instance',
	'timestamp',
	'path',
	'method',
	'stack',
	'trace',
	'traceId',
	'requestId',
	'success',
	'ok'
]);

type ErrorMap = Record<string, string[]>;

function pushMessages(out: ErrorMap, path: string, messages: string[]): void {
	if (messages.length === 0) return;
	const key = FORM_LEVEL_KEYS.has(path) ? '' : path;
	const list = out[key] ?? (out[key] = []);
	for (const message of messages) if (message && !list.includes(message)) list.push(message);
}

/** JSON:API `source.pointer` (`/data/attributes/email`) → dotted path (`email`). */
function pointerToPath(pointer: string): string {
	return pointer
		.replace(/^\/data\/(attributes|relationships)\/?/, '')
		.replace(/^\//, '')
		.split('/')
		.filter(Boolean)
		.join('.');
}

/**
 * One error-ish entry of an errors ARRAY: a plain string (form-level), or
 * an object carrying a message (`message` / `detail` / `title`) and a
 * location (`path` array or dotted string, `field`, `name`, `param`,
 * `property`, or JSON:API `source.pointer`).
 */
function collectErrorEntry(out: ErrorMap, entry: unknown): void {
	if (typeof entry === 'string') {
		pushMessages(out, '', [entry]);
		return;
	}
	if (entry === null || typeof entry !== 'object') return;
	const record = entry as Record<string, unknown>;
	const message = [record.message, record.detail, record.msg, record.title].find(
		(m): m is string => typeof m === 'string' && m.length > 0
	);
	if (!message) return;
	const source = record.source as { pointer?: unknown; parameter?: unknown } | undefined;
	const location =
		record.path ??
		record.field ??
		record.name ??
		record.param ??
		record.property ??
		record.loc ??
		(typeof source?.pointer === 'string' ? pointerToPath(source.pointer) : source?.parameter);
	const path = Array.isArray(location)
		? suiIssuePath(location)
		: typeof location === 'string'
			? location
			: '';
	pushMessages(out, path, [message]);
}

/**
 * Flattens a (possibly nested) field → messages map onto dotted paths:
 * `{ address: { city: ['Required'] } }` → `address.city`, and arrays of
 * objects index in (`{ tags: [{}, { name: 'Bad' }] }` → `tags.1.name`).
 */
function collectFieldMap(out: ErrorMap, value: unknown, prefix: string): void {
	if (typeof value === 'string') {
		pushMessages(out, prefix, [value]);
		return;
	}
	if (Array.isArray(value)) {
		const strings = value.filter((item): item is string => typeof item === 'string');
		pushMessages(out, prefix, strings);
		value.forEach((item, index) => {
			if (item !== null && typeof item === 'object') {
				collectFieldMap(out, item, prefix ? `${prefix}.${index}` : String(index));
			}
		});
		return;
	}
	if (value === null || typeof value !== 'object') return;
	for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
		const path = FORM_LEVEL_KEYS.has(key) ? '' : prefix ? `${prefix}.${key}` : key;
		collectFieldMap(out, nested, path);
	}
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
	 * Tolerant mapper for the JSON error bodies real backends return —
	 * every shape lands on `Record<dotted path, messages>` (`''` =
	 * form-level):
	 *
	 * - `{ issues: [{ message, path }] }` — zod / Standard Schema JSON
	 * - `{ errors: { email: 'Taken' | ['Taken'] } }` — field map (Laravel,
	 *   Rails, ASP.NET `ValidationProblemDetails`); nested objects flatten
	 *   to dotted paths (`address.city`, DRF nested serializers)
	 * - `{ errors: [{ message|detail, path|field|source.pointer }] }` —
	 *   error arrays (JSON:API, express-validator, GraphQL-ish); plain
	 *   strings in the array are form-level (Rails `full_messages`)
	 * - `{ email: ['Taken'], non_field_errors: ['…'] }` — direct field
	 *   maps (Django REST Framework); envelope metadata (`status`, `code`,
	 *   `type`, `path`, `timestamp`, …) is ignored
	 * - `message` / `error` / `detail` / `form` / `_form` /
	 *   `non_field_errors` / `__all__` → form-level, when no field
	 *   errors explain the failure better
	 * - a bare array body → an error array; anything else that is not an
	 *   object (a string, `null`) maps to nothing
	 */
	fromResponse(body: unknown): Record<string, string[]> {
		const out: ErrorMap = {};
		if (Array.isArray(body)) {
			for (const entry of body) collectErrorEntry(out, entry);
			return out;
		}
		if (body === null || typeof body !== 'object') return out;
		const record = body as Record<string, unknown>;
		if (Array.isArray(record.issues)) {
			for (const [path, messages] of Object.entries(suiErrors.fromIssues(record.issues))) {
				pushMessages(out, path, messages);
			}
		}
		if (Array.isArray(record.errors)) {
			for (const entry of record.errors) collectErrorEntry(out, entry);
		} else if (record.errors !== null && typeof record.errors === 'object') {
			collectFieldMap(out, record.errors, '');
		} else if (!Array.isArray(record.issues)) {
			// direct field map — skip envelope metadata and summary keys
			for (const [key, value] of Object.entries(record)) {
				if (METADATA_KEYS.has(key) || key === 'errors' || FORM_LEVEL_KEYS.has(key)) continue;
				collectFieldMap(out, value, key);
			}
		}
		// summary messages (`message`, `error`, `detail`, …) are form-level —
		// but only as a fallback: Laravel/ASP.NET put a generic "The given
		// data was invalid." next to the field errors that explain it
		const hasFieldErrors = Object.keys(out).some((key) => key !== '');
		if (!hasFieldErrors) {
			for (const key of [
				'_form',
				'form',
				'non_field_errors',
				'__all__',
				'detail',
				'message',
				'error'
			]) {
				const value = record[key];
				if (typeof value === 'string') pushMessages(out, '', [value]);
				else if (Array.isArray(value)) {
					pushMessages(
						out,
						'',
						value.filter((item): item is string => typeof item === 'string')
					);
				}
			}
			if (Object.keys(out).length === 0 && typeof record.title === 'string') {
				pushMessages(out, '', [record.title]); // RFC 7807 problem details
			}
		} else {
			// explicit form-level keys still apply alongside field errors
			for (const key of ['_form', 'form', 'non_field_errors', '__all__']) {
				const value = record[key];
				if (typeof value === 'string') pushMessages(out, '', [value]);
				else if (Array.isArray(value)) {
					pushMessages(
						out,
						'',
						value.filter((item): item is string => typeof item === 'string')
					);
				}
			}
		}
		return out;
	}
};

// ------------------------------------------------------ introspection

/**
 * The sub-schema at a dotted path (`'items.0.name'`), unwrapping
 * optional/nullable/default/pipe wrappers; `undefined` when it cannot be
 * resolved (non-zod vendors) — callers fall back to `undefined` defaults.
 */
export function schemaAt(schema: SuiSchemaLike, path: string): SuiSchemaLike | undefined {
	let cur: any = schema;
	for (const segment of path.split('.')) {
		cur = unwrapSchema(cur);
		if (!cur?.def) return undefined;
		if (cur.def.type === 'array') cur = cur.def.element;
		else if (cur.def.type === 'object' || cur.shape) cur = cur.shape?.[segment];
		else if (cur.def.type === 'tuple') cur = cur.def.items?.[Number(segment)];
		else if (cur.def.type === 'record') cur = cur.def.valueType;
		else return undefined;
	}
	return cur;
}

export function unwrapSchema(schema: any): any {
	let cur = schema;
	for (let depth = 0; depth < 8 && cur?.def; depth++) {
		const type = cur.def.type;
		if (
			['optional', 'nullable', 'default', 'prefault', 'readonly', 'catch', 'nonoptional'].includes(
				type
			)
		) {
			cur = cur.def.innerType;
		} else if (type === 'pipe') cur = cur.def.in;
		else if (type === 'lazy') cur = cur.def.getter?.() ?? cur.schema;
		else break;
	}
	return cur;
}
