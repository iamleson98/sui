import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { z } from 'zod';
import {
	SuiAsyncSchemaError,
	groupSuiIssues,
	isIssueCarrying,
	resolveSuiMessages,
	suiErrors,
	suiIssuePath,
	suiIssues,
	suiIssuesFromError,
	suiParse,
	type SuiIn,
	type SuiOut,
	type StandardSchemaV1
} from '$lib/sui/form/schema.js';
import { createSuiForm } from '$lib/sui/form/index.js';
import { testSchema, type TestSchema } from './harness/form-schema.js';

/** Minimal Standard Schema v1 fake — the whole interop contract sui relies on. */
type FakeIssue = { message: string; path?: ReadonlyArray<PropertyKey | { key: PropertyKey }> };

function fakeStandardSchema(
	validate: (value: unknown) => { value: unknown; issues?: undefined } | { issues: FakeIssue[] }
): StandardSchemaV1 {
	return { '~standard': { version: 1, vendor: 'fake', validate } };
}

describe('suiParse — Standard Schema interop', () => {
	it('parses zod v4 schemas through the standard channel with dotted paths', () => {
		const schema = z.object({
			email: z.email('Enter a valid email'),
			nested: z.object({ city: z.string().min(1, 'City required') })
		});
		const bad = suiParse(schema, { email: 'nope', nested: { city: '' } });
		expect(bad.ok).toBe(false);
		if (bad.ok) return;
		expect(bad.issues.find((i) => i.path === 'email')?.message).toBe('Enter a valid email');
		expect(bad.issues.find((i) => i.path === 'nested.city')?.message).toBe('City required');

		const good = suiParse(schema, { email: 'a@b.co', nested: { city: 'Hanoi' } });
		expect(good.ok && good.data).toEqual({ email: 'a@b.co', nested: { city: 'Hanoi' } });
	});

	it('parses any Standard Schema vendor (plain key paths)', () => {
		const schema = fakeStandardSchema((value) =>
			typeof (value as { name?: string })?.name === 'string' &&
			(value as { name: string }).name.length >= 3
				? { value }
				: { issues: [{ message: 'Name must be at least 3 characters', path: ['name'] }] }
		);
		const bad = suiParse(schema, { name: 'ab' });
		expect(bad.ok).toBe(false);
		if (bad.ok) return;
		expect(bad.issues[0]).toEqual({ path: 'name', message: 'Name must be at least 3 characters' });
		expect(suiParse(schema, { name: 'abc' }).ok).toBe(true);
	});

	it('flattens boxed path segments (ArkType-style { key })', () => {
		expect(suiIssuePath([{ key: 'a' }, { key: 'b' }])).toBe('a.b');
		expect(suiIssuePath(['tags', 0])).toBe('tags.0');
		expect(suiIssuePath(undefined)).toBe('');
		expect(suiIssuePath([])).toBe('');
	});

	it('falls back to duck-typed safeParse schemas (zod v3 style)', () => {
		const schema = {
			safeParse: (value: unknown) =>
				value === 'ok'
					? { success: true, data: value }
					: { success: false, error: { issues: [{ message: 'not ok', path: ['x'] }] } }
		};
		const bad = suiParse(schema, 'nope');
		expect(bad.ok).toBe(false);
		if (bad.ok) return;
		expect(bad.issues[0].path).toBe('x');
	});

	it('rejects async schemas with a dedicated error', () => {
		const asyncSchema = z.object({ name: z.string().refine(async () => true, 'x') });
		expect(() => suiParse(asyncSchema, { name: 'a' })).toThrowError(SuiAsyncSchemaError);
		expect(() => suiParse(asyncSchema, { name: 'a' })).toThrowError(/asynchronous/);
	});

	it('rejects non-schema input with a clear message', () => {
		expect(() => suiParse({}, {})).toThrowError(/Standard Schema/);
		expect(() => suiParse(null, {})).toThrowError(/Standard Schema/);
	});

	it('deduplicates repeated messages while grouping', () => {
		expect(
			groupSuiIssues(
				suiIssues([
					{ message: 'a', path: ['x'] },
					{ message: 'a', path: ['x'] }
				])
			)
		).toEqual({ x: ['a'] });
	});
});

describe('suiParse — type-level interop', () => {
	it('keeps zod input/output inference precise', () => {
		expectTypeOf<SuiIn<TestSchema>>().toEqualTypeOf<z.input<TestSchema>>();
		expectTypeOf<SuiOut<TestSchema>>().toEqualTypeOf<z.output<TestSchema>>();
	});

	it('drives createSuiForm field handles with precise zod typing', () => {
		const form = createSuiForm(testSchema);
		expectTypeOf(form.values).toEqualTypeOf<z.output<TestSchema>>();
		expectTypeOf(form.fields.name.value).toEqualTypeOf<string>();
		expectTypeOf(form.fields.accept.value).toEqualTypeOf<true>();
	});
});

describe('createSuiForm — non-zod schemas end to end', () => {
	it('drives a whole form from a Standard Schema vendor schema', async () => {
		const schema = fakeStandardSchema((value) => {
			const name = (value as { name?: string })?.name;
			return name === 'ok'
				? { value }
				: { issues: [{ message: 'Name must be ok', path: ['name'] }] };
		});
		const onsubmit = vi.fn();
		const form = createSuiForm(schema, {
			initialValues: { name: 'nope' },
			onsubmit: onsubmit as never
		});

		expect(form.isValid).toBe(false);
		expect(await form.handleSubmit()).toBe(false);
		expect(form.field('name').errors).toEqual(['Name must be ok']);

		// non-zod schemas derive no smart defaults — initialValues seed instead
		form.setValues({ name: 'ok' } as never);
		expect(await form.handleSubmit()).toBe(true);
		expect(onsubmit).toHaveBeenCalledOnce();
	});

	it('accepts issue-carrying thrown errors from any vendor', () => {
		expect(isIssueCarrying({ issues: [{ message: 'x' }] })).toBe(true);
		expect(isIssueCarrying(new Error('plain'))).toBe(false);
		expect(suiIssuesFromError({ issues: [{ message: 'x', path: ['y'] }] })[0].path).toBe('y');
	});
});

describe('resolveSuiMessages — copy overrides', () => {
	const issues = [
		{ path: 'email', message: 'Invalid input' },
		{ path: '', message: 'root went wrong' },
		{ path: 'other', message: 'keep me' }
	] as const;

	it('applies exact-path strings, root aliases and wildcards', () => {
		const out = resolveSuiMessages(issues, {
			email: 'Enter a valid email address',
			_form: 'Check your answers and try again',
			'*': 'generic fallback'
		});
		expect(out.map((i) => i.message)).toEqual([
			'Enter a valid email address',
			'Check your answers and try again',
			'generic fallback'
		]);
	});

	it('resolves functions with the original issue', () => {
		const out = resolveSuiMessages([{ path: 'email', message: 'regex fail' }], {
			email: (issue) => `bad (${issue.message}) at ${issue.path}`
		});
		expect(out[0].message).toBe('bad (regex fail) at email');
	});

	it('passes issues through untouched without a map', () => {
		expect(resolveSuiMessages(issues, undefined)).toHaveLength(3);
		expect(resolveSuiMessages(issues, {})[2].message).toBe('keep me');
	});
});

describe('suiErrors — server payload mapping', () => {
	it('fromIssues: standard issues → path map', () => {
		expect(suiErrors.fromIssues([{ message: 'Taken', path: ['a', 'b'] }])).toEqual({
			'a.b': ['Taken']
		});
	});

	it('fromZodError: ZodError → path map', () => {
		const error = new z.ZodError([
			{ code: 'custom', input: undefined, path: ['email'], message: 'Taken' }
		]);
		expect(suiErrors.fromZodError(error)).toEqual({ email: ['Taken'] });
	});

	it('fromResponse: tolerates the shapes servers actually return', () => {
		expect(suiErrors.fromResponse({ issues: [{ message: 'Taken', path: ['email'] }] })).toEqual({
			email: ['Taken']
		});
		expect(suiErrors.fromResponse({ errors: { email: 'Taken', notes: ['a', 'b'] } })).toEqual({
			email: ['Taken'],
			notes: ['a', 'b']
		});
		expect(suiErrors.fromResponse({ message: 'Boom' })).toEqual({ '': ['Boom'] });
		expect(suiErrors.fromResponse({ email: 'Taken', _form: 'rate limited' })).toEqual({
			email: ['Taken'],
			'': ['rate limited']
		});
		expect(suiErrors.fromResponse(null)).toEqual({});
		expect(suiErrors.fromResponse('a string')).toEqual({});
	});
});
