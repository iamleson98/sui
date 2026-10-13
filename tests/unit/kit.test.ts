import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
	createSuiForm,
	suiEnhance,
	suiFormDataToObject,
	suiParseFormData
} from '$lib/sui/form/index.js';

function formData(entries: [string, string][]): FormData {
	const data = new FormData();
	for (const [key, value] of entries) data.append(key, value);
	return data;
}

const schema = z.object({
	name: z.string().min(2, 'Enter a name'),
	age: z.number('Enter your age').min(18, 'Must be 18+').optional(),
	newsletter: z.boolean(),
	address: z.object({ city: z.string().min(1, 'Enter a city') }),
	tags: z.array(z.string()),
	lines: z.array(z.object({ sku: z.string(), qty: z.number() })),
	stay: z.object({ start: z.iso.date(), end: z.iso.date() })
});

describe('suiFormDataToObject', () => {
	it('builds nested objects and arrays from dotted / bracket keys', () => {
		const object = suiFormDataToObject(
			formData([
				['address.city', 'Hanoi'],
				['lines[0].sku', 'A'],
				['lines[0].qty', '2'],
				['lines.1.sku', 'B'],
				['tags', 'x'],
				['tags', 'y'],
				['stay.start', '2026-10-11']
			])
		);
		expect(object).toEqual({
			address: { city: 'Hanoi' },
			lines: [{ sku: 'A', qty: '2' }, { sku: 'B' }],
			tags: ['x', 'y'],
			stay: { start: '2026-10-11' }
		});
	});

	it('coerces to schema types: booleans, numbers, empty arrays, optional numbers', () => {
		const object = suiFormDataToObject(
			formData([
				['name', 'Ada'],
				['age', ''],
				['newsletter', 'on'],
				['lines.0.qty', '3']
			]),
			schema
		);
		expect(object.newsletter).toBe(true);
		expect(object.age).toBeUndefined();
		expect(object.tags).toEqual([]);
		expect((object.lines as { qty: number }[])[0]!.qty).toBe(3);
		// an unchecked checkbox posts nothing → false
		expect(suiFormDataToObject(formData([]), schema).newsletter).toBe(false);
	});

	it('coerces z.literal(true) ("I accept") from a checkbox post', () => {
		const accept = z.object({ accept: z.literal(true, { error: 'Please accept' }) });
		expect(suiParseFormData(accept, formData([['accept', 'on']])).ok).toBe(true);
		const missing = suiParseFormData(accept, formData([]));
		expect(missing.ok).toBe(false);
		if (!missing.ok) expect(missing.errors.accept).toEqual(['Please accept']);
	});

	it('ignores prototype-polluting keys', () => {
		const object = suiFormDataToObject(formData([['__proto__.polluted', 'yes']]));
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
		expect(Object.keys(object)).toEqual([]);
	});
});

describe('suiParseFormData', () => {
	const valid: [string, string][] = [
		['name', 'Ada'],
		['address.city', 'London'],
		['lines.0.sku', 'A'],
		['lines.0.qty', '1'],
		['stay.start', '2026-10-11'],
		['stay.end', '2026-10-14']
	];

	it('returns typed data for a valid post', () => {
		const result = suiParseFormData(schema, formData(valid));
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.newsletter).toBe(false);
			expect(result.data.lines).toEqual([{ sku: 'A', qty: 1 }]);
		}
	});

	it('returns field errors by dotted path + the coerced values for fail()', () => {
		const result = suiParseFormData(
			schema,
			formData([
				['name', 'A'],
				['age', '17'],
				['address.city', '']
			])
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.name).toEqual(['Enter a name']);
			expect(result.errors.age).toEqual(['Must be 18+']);
			expect(result.errors['address.city']).toEqual(['Enter a city']);
			expect(result.values.name).toBe('A');
		}
	});

	it('never echoes password fields', () => {
		const loose = z.object({ email: z.string().email('Bad email'), password: z.string().min(8) });
		const result = suiParseFormData(
			loose,
			formData([
				['email', 'nope'],
				['password', 'secret123']
			]),
			{ passwordFields: ['password'] }
		);
		expect(result.ok).toBe(false);
		expect(result.values.password).toBe('');
	});
});

describe('suiEnhance', () => {
	/** A fake SvelteKit `enhance`: captures the submit function and lets tests drive it. */
	function fakeKit() {
		let submit!: (input: { cancel: () => void }) => Promise<unknown>;
		const destroy = vi.fn();
		const enhance = vi.fn((_node: HTMLFormElement, fn: typeof submit) => {
			submit = fn;
			return { destroy };
		});
		return { enhance, destroy, run: (cancel = vi.fn()) => submit({ cancel }) };
	}

	const small = z.object({ email: z.email('Enter a valid email') });

	it('cancels the request while the client schema fails, and reveals the errors', async () => {
		const form = createSuiForm(small);
		const kit = fakeKit();
		const node = document.createElement('form');
		const detach = suiEnhance(form, kit.enhance as never)(node);
		expect(node).toHaveAttribute('data-sui-enhanced');

		const cancel = vi.fn();
		const after = await kit.run(cancel);
		expect(cancel).toHaveBeenCalled();
		expect(after).toBeUndefined();
		expect(form.fields.email.errors).toEqual(['Enter a valid email']);

		detach();
		expect(kit.destroy).toHaveBeenCalled();
		expect(node).not.toHaveAttribute('data-sui-enhanced');
	});

	it('lets a valid submit through and maps a failure payload back onto fields', async () => {
		const form = createSuiForm(small, { initialValues: { email: 'taken@example.com' } });
		const kit = fakeKit();
		suiEnhance(form, kit.enhance as never)(document.createElement('form'));

		const cancel = vi.fn();
		const after = (await kit.run(cancel)) as (input: {
			result: { type: string; data?: unknown };
			update: () => Promise<void>;
		}) => Promise<void>;
		expect(cancel).not.toHaveBeenCalled();
		expect(form.isSubmitting).toBe(true);

		const update = vi.fn(async () => {});
		await after({
			result: { type: 'failure', data: { errors: { email: ['Already registered'] } } },
			update
		});
		expect(form.isSubmitting).toBe(false);
		expect(form.fields.email.errors).toEqual(['Already registered']);
		expect(update).not.toHaveBeenCalled();
	});

	it('success applies the default update without resetting the controlled DOM', async () => {
		const form = createSuiForm(small, { initialValues: { email: 'ada@example.com' } });
		const kit = fakeKit();
		const onsuccess = vi.fn();
		suiEnhance(form, kit.enhance as never, { onsuccess })(document.createElement('form'));
		const after = (await kit.run()) as (input: unknown) => Promise<void>;
		const update = vi.fn(async () => {});
		await after({ result: { type: 'success', data: {} }, update });
		expect(update).toHaveBeenCalledWith({ reset: false, invalidateAll: undefined });
		expect(onsuccess).toHaveBeenCalled();
	});

	it('initialErrors seed a no-JS failed post back onto the fields', () => {
		const form = createSuiForm(small, {
			initialValues: { email: 'x' },
			initialErrors: { email: ['Enter a valid email'] }
		});
		expect(form.fields.email.errors).toEqual(['Enter a valid email']);
	});
});
