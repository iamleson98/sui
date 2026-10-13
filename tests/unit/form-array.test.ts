import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { z } from 'zod';
import { createSuiForm } from '$lib/sui/form/index.js';

const schema = z.object({
	title: z.string().min(1, 'Add a title'),
	emails: z.array(z.email('Enter a valid email')).min(1, 'Add at least one email'),
	lines: z.array(z.object({ sku: z.string().min(1, 'Enter a SKU'), qty: z.number().min(1) }))
});

function make(initial: Partial<z.input<typeof schema>> = {}) {
	return createSuiForm(schema, { initialValues: { title: 'Order', ...initial } });
}

describe('form.array — structure', () => {
	it('push / insert / remove / move / swap / clear mutate values and keys together', () => {
		const form = make({ emails: ['a@x.co', 'b@x.co', 'c@x.co'] });
		const emails = form.array('emails');
		const [ka, kb, kc] = emails.keys;

		emails.move(0, 2);
		expect(emails.items).toEqual(['b@x.co', 'c@x.co', 'a@x.co']);
		expect(emails.keys).toEqual([kb, kc, ka]); // identity travels with the item

		emails.swap(0, 2);
		expect(emails.items).toEqual(['a@x.co', 'c@x.co', 'b@x.co']);

		emails.remove(1);
		expect(emails.items).toEqual(['a@x.co', 'b@x.co']);
		expect(emails.keys).toEqual([ka, kb]);

		emails.insert(1, 'new@x.co');
		expect(emails.items).toEqual(['a@x.co', 'new@x.co', 'b@x.co']);
		expect(emails.keys[0]).toBe(ka);
		expect(emails.keys[2]).toBe(kb);

		emails.clear();
		expect(emails.length).toBe(0);
	});

	it('push() without a value uses the element schema default (objects included)', () => {
		const form = make();
		form.array('lines').push();
		form.array('emails').push();
		expect(form.values.lines).toEqual([{ sku: '', qty: undefined }]);
		expect(form.values.emails).toEqual(['']);
	});

	it('entries expose stable keys, indexes and sub-field handles', () => {
		const form = make({
			lines: [
				{ sku: 'A', qty: 1 },
				{ sku: 'B', qty: 2 }
			]
		});
		const entries = form.array('lines').entries;
		expect(entries.map((e) => e.index)).toEqual([0, 1]);
		expect(entries[1]!.field('sku').name).toBe('lines.1.sku');
		expect(entries[1]!.field('sku').value).toBe('B');
	});
});

describe('form.array — per-item state follows the item', () => {
	it('errors, touched and revealed re-index when an earlier item is removed', async () => {
		const form = make({ emails: ['good@x.co', 'bad', 'worse'] });
		await form.handleSubmit(); // reveals every invalid item
		expect(form.field('emails.1').errors).toEqual(['Enter a valid email']);
		expect(form.field('emails.2').errors).toEqual(['Enter a valid email']);

		form.field('emails.2').blur(); // touched
		form.array('emails').remove(0);

		// the old items 1 and 2 are now 0 and 1 — and still invalid + revealed
		expect(form.array('emails').items).toEqual(['bad', 'worse']);
		expect(form.field('emails.0').errors).toEqual(['Enter a valid email']);
		expect(form.field('emails.1').errors).toEqual(['Enter a valid email']);
		expect(form.field('emails.1').touched).toBe(true);
		expect(form.field('emails.2').errors).toEqual([]); // no ghost left behind
	});

	it('an error stays with its item through a move', async () => {
		const form = make({ emails: ['bad', 'good@x.co'] });
		await form.handleSubmit();
		form.array('emails').move(0, 1);
		expect(form.field('emails.0').errors).toEqual([]);
		expect(form.field('emails.1').errors).toEqual(['Enter a valid email']);
	});

	it('server errors keep pointing at the item they described', () => {
		const form = make({ emails: ['a@x.co', 'b@x.co'] });
		form.setErrors({ 'emails.1': 'Already subscribed' });
		form.array('emails').insert(0, 'z@x.co');
		expect(form.field('emails.2').errors).toEqual(['Already subscribed']);
		expect(form.field('emails.1').errors).toEqual([]);
	});

	it('removing the last item reveals the list-level rule (min items)', () => {
		const form = make({ emails: ['a@x.co'] });
		form.array('emails').remove(0, { focus: false });
		expect(form.field('emails').errors).toEqual(['Add at least one email']);
	});

	it('dirty is tracked at list level and clears when edited back', () => {
		const form = make({ emails: ['a@x.co'] });
		form.array('emails').push('b@x.co');
		expect(form.isDirty).toBe(true);
		form.array('emails').remove(1, { focus: false });
		expect(form.isDirty).toBe(false);
	});

	it('cancels async checks of moved items instead of attributing them to new positions', async () => {
		const validator = vi.fn(async (value: unknown) => (value === 'taken@x.co' ? 'Taken' : true));
		const form = createSuiForm(schema, {
			initialValues: { title: 'T', emails: ['taken@x.co', 'free@x.co'] },
			asyncDebounce: 0,
			asyncValidators: { 'emails.0': validator, 'emails.1': validator }
		});
		form.field('emails.0').blur();
		await vi.waitFor(() => expect(form.field('emails.0').errors).toEqual(['Taken']));
		form.array('emails').swap(0, 1);
		// the stale verdict of position 0 is gone (not pinned to the other email)
		expect(form.field('emails.0').errors).not.toEqual(['Taken']);
	});
});

describe('typed paths', () => {
	it('infer value types from the schema', () => {
		const form = make();
		expectTypeOf(form.field('title').value).toEqualTypeOf<string>();
		expectTypeOf(form.field('emails').value).toEqualTypeOf<string[]>();
		expectTypeOf(form.field('lines.0.sku').value).toEqualTypeOf<string>();
		expectTypeOf(form.array('lines').items).toEqualTypeOf<{ sku: string; qty: number }[]>();
		// @ts-expect-error — not a path of this schema
		form.field('lines.0.nope');
		// computed paths still type-check through template literals
		const i = 2;
		expectTypeOf(form.field(`lines.${i}.qty`).value).toEqualTypeOf<number>();
	});
});
