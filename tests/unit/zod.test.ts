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
});

describe('SuiFieldState', () => {
	it('starts pristine with no errors', () => {
		const field = new SuiFieldState();
		expect(field.errors).toEqual([]);
		expect(field.touched).toBe(false);
	});

	it('validates on change events even before touch', () => {
		const field = new SuiFieldState();
		const schema = z.string().min(1, 'Required');
		expect(field.validate('', schema, 'change')).toEqual(['Required']);
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

		field.validate('a', schema, 'change');
		expect(field.errors).toEqual(['Too short']);

		field.validate('abc', schema, 'change');
		expect(field.errors).toEqual([]);
	});

	it('forceValidate ignores the touched gate', () => {
		const field = new SuiFieldState();
		const schema = z.literal(true, { error: 'Must accept' });
		expect(field.forceValidate(false, schema)).toEqual(['Must accept']);
		expect(field.touched).toBe(true);
	});

	it('setErrors replaces errors externally', () => {
		const field = new SuiFieldState();
		field.setErrors(['Server says no']);
		expect(field.errors).toEqual(['Server says no']);
	});

	it('clear and reset behave differently', () => {
		const field = new SuiFieldState();
		const schema = z.string().min(1, 'Required');
		field.validate('', schema, 'change');

		field.clear();
		expect(field.errors).toEqual([]);
		expect(field.touched).toBe(true);

		field.reset();
		expect(field.touched).toBe(false);
	});
});
