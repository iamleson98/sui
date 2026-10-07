import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { suiValidate, shouldValidate } from '$lib/sui/zod';
import { SuiFieldState } from '$lib/sui/field.svelte';

describe('suiValidate', () => {
	it('returns no messages without a schema', () => {
		expect(suiValidate(undefined, 'anything')).toEqual([]);
	});

	it('returns no messages for valid values', () => {
		expect(suiValidate(z.string().min(2), 'ab')).toEqual([]);
	});

	it('returns deduplicated issue messages', () => {
		const schema = z
			.string()
			.min(8, 'Use at least 8 characters')
			.regex(/[A-Z]/, 'Use at least 8 characters');
		expect(suiValidate(schema, 'short')).toEqual(['Use at least 8 characters']);
	});

	it('supports zod v4 format APIs', () => {
		expect(suiValidate(z.email('Enter a valid email'), 'not-an-email')).toEqual([
			'Enter a valid email'
		]);
	});

	it('supports enum literals with custom messages', () => {
		const schema = z.enum(['a', 'b'], 'Pick one');
		expect(suiValidate(schema, 'c')).toEqual(['Pick one']);
	});

	it('validates arrays for multi-select', () => {
		const schema = z.array(z.string()).min(1, 'Select at least one');
		expect(suiValidate(schema, [])).toEqual(['Select at least one']);
		expect(suiValidate(schema, ['x'])).toEqual([]);
	});
});

describe('shouldValidate', () => {
	it('respects the mode matrix', () => {
		expect(shouldValidate('change', 'change')).toBe(true);
		expect(shouldValidate('change', 'blur')).toBe(false);
		expect(shouldValidate('blur', 'change')).toBe(false);
		expect(shouldValidate('blur', 'blur')).toBe(true);
		expect(shouldValidate('both', 'change')).toBe(true);
		expect(shouldValidate('both', 'blur')).toBe(true);
		expect(shouldValidate('none', 'change')).toBe(false);
		expect(shouldValidate('none', 'blur')).toBe(false);
	});

	it('auto: blur always validates, change only once touched', () => {
		expect(shouldValidate('auto', 'blur', false)).toBe(true);
		expect(shouldValidate('auto', 'change', false)).toBe(false);
		expect(shouldValidate('auto', 'change', true)).toBe(true);
		expect(shouldValidate('auto', 'blur', true)).toBe(true);
	});
});

describe('SuiFieldState', () => {
	it('starts pristine with no errors', () => {
		const field = new SuiFieldState();
		expect(field.errors).toEqual([]);
		expect(field.displayed).toEqual([]);
		expect(field.touched).toBe(false);
	});

	it('auto timing: change is quiet before touch, blur validates, then change goes eager', () => {
		const field = new SuiFieldState();
		const schema = z.string().min(2, 'Too short');

		// first typing pass — quiet, but the edit still taints display ownership
		expect(field.validate('a', schema, 'change')).toEqual([]);
		expect(field.touched).toBe(false);

		// blur validates
		expect(field.validate('a', schema, 'blur')).toEqual(['Too short']);
		expect(field.touched).toBe(true);

		// subsequent changes revalidate eagerly and clear when fixed
		expect(field.validate('abc', schema, 'change')).toEqual([]);
	});

	it('validates on change events even before touch with explicit both', () => {
		const field = new SuiFieldState();
		const schema = z.string().min(1, 'Required');
		expect(field.validate('', schema, 'change', 'both')).toEqual(['Required']);
		expect(field.touched).toBe(true);
	});

	it('skips events excluded by validateOn', () => {
		const field = new SuiFieldState();
		const schema = z.string().min(1, 'Required');

		expect(field.validate('', schema, 'change', 'blur')).toEqual([]);
		expect(field.touched).toBe(false);

		expect(field.validate('', schema, 'blur', 'blur')).toEqual(['Required']);
		expect(field.touched).toBe(true);
	});

	it('keeps revalidating after first touch', () => {
		const field = new SuiFieldState();
		const schema = z.string().min(2, 'Too short');

		field.validate('a', schema, 'change', 'both');
		expect(field.errors).toEqual(['Too short']);

		field.validate('abc', schema, 'change', 'both');
		expect(field.errors).toEqual([]);
	});

	it('external errors display until the user edits, then local takes over', () => {
		const field = new SuiFieldState();
		const schema = z.string().min(3, 'Min 3');

		field.syncExternal(['Name must be at least 2 characters']);
		expect(field.displayed).toEqual(['Name must be at least 2 characters']);

		// blur without editing keeps the server message
		field.validate('', schema, 'blur', 'auto');
		expect(field.displayed).toEqual(['Name must be at least 2 characters', 'Min 3']);

		// editing takes display rights from the external list
		field.validate('abc', schema, 'change', 'auto');
		expect(field.displayed).toEqual([]);
	});

	it('fresh external errors re-take the display; equivalent re-passes do not', () => {
		const field = new SuiFieldState();
		const first = ['Taken'];
		field.syncExternal(first);
		field.syncExternal(first); // same reference — no-op
		expect(field.displayed).toEqual(['Taken']);

		field.validate('abc', z.string().min(3), 'change', 'both'); // edited
		expect(field.displayed).toEqual([]);

		field.syncExternal(first); // stale re-pass — still suppressed
		expect(field.displayed).toEqual([]);

		field.syncExternal(['Still taken']); // new submit, new array
		expect(field.displayed).toEqual(['Still taken']);
	});

	it('syncExternal ignores equivalent empty lists', () => {
		const field = new SuiFieldState();
		field.syncExternal([]);
		field.syncExternal([]); // fresh [] each render — must not churn state
		expect(field.displayed).toEqual([]);
	});

	it('editing suppresses stale server errors even when validation is gated', () => {
		const field = new SuiFieldState();
		field.syncExternal(['Already registered']);
		// auto + untouched: schema does not run yet, but the edit still taints
		expect(field.validate('ada@example.com', undefined, 'change', 'auto')).toEqual([]);
		expect(field.displayed).toEqual([]);
	});

	it('forceValidate ignores the touched gate and keeps external visible', () => {
		const field = new SuiFieldState();
		const schema = z.literal(true, { error: 'Must accept' });
		field.syncExternal([]);
		expect(field.forceValidate(false, schema)).toEqual(['Must accept']);
		expect(field.touched).toBe(true);
		expect(field.displayed).toEqual(['Must accept']);
	});

	it('setErrors replaces errors externally', () => {
		const field = new SuiFieldState();
		field.setErrors(['Server says no']);
		expect(field.errors).toEqual(['Server says no']);
	});

	it('clear and reset behave differently', () => {
		const field = new SuiFieldState();
		const schema = z.string().min(1, 'Required');
		field.validate('', schema, 'change', 'both');

		field.clear();
		expect(field.errors).toEqual([]);
		expect(field.touched).toBe(true);

		field.reset();
		expect(field.touched).toBe(false);
		expect(field.edited).toBe(false);
		expect(field.external).toEqual([]);
	});
});
