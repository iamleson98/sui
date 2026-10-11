import { describe, expect, it, vi } from 'vitest';
import { z, ZodError } from 'zod';
import { createSuiForm, SuiAsyncSchemaError, suiErrors, suiParse } from '$lib/sui/form/index.js';

/**
 * Production-hardening regressions for the schema-driven form engine:
 * value cloning, dirty tracking, re-baselining, submit dedupe, server-error
 * lifecycles, reveal gating of form-level refines, descendant/unmapped
 * error routing and async-validator cancellation.
 */

const accountSchema = z.object({
	name: z.string().min(2, 'Name must be at least 2 characters'),
	email: z.email('Enter a valid email')
});

function fillAccount(form: ReturnType<typeof createSuiForm<typeof accountSchema>>) {
	form.setValues({ name: 'Ada', email: 'ada@example.com' });
}

describe('createSuiForm — initial values are copied safely', () => {
	it('accepts reactive proxies (structuredClone would throw DataCloneError)', () => {
		// `initialValues: user` where `user` is `$state` — its nested
		// objects are proxies too
		const schema = z.object({ name: z.string(), address: z.object({ city: z.string() }) });
		const user = new Proxy({ name: 'Ada', address: new Proxy({ city: 'London' }, {}) }, {});
		const form = createSuiForm(schema, { initialValues: user });
		expect(form.values.address.city).toBe('London');
		form.reset(); // reset clones the baseline again — must not throw either
		expect(form.values.name).toBe('Ada');
	});

	it('keeps class instances (dates, money, CalendarDate…) with their prototype', () => {
		class Money {
			constructor(readonly cents: number) {}
			format() {
				return `$${(this.cents / 100).toFixed(2)}`;
			}
		}
		const schema = z.object({ price: z.instanceof(Money), due: z.date() });
		const due = new Date('2026-01-02T00:00:00Z');
		const form = createSuiForm(schema, { initialValues: { price: new Money(1250), due } });
		expect(form.values.price).toBeInstanceOf(Money);
		expect((form.values.price as Money).format()).toBe('$12.50');
		// dates are copied, never aliased: editing the form can't mutate the caller's object
		expect(form.values.due).toEqual(due);
		expect(form.values.due).not.toBe(due);
	});

	it('never aliases nested initial values', () => {
		const initial = { tags: ['a'] };
		const form = createSuiForm(z.object({ tags: z.array(z.string()) }), { initialValues: initial });
		(form.values.tags as string[]).push('b');
		expect(initial.tags).toEqual(['a']);
	});

	it('starts optional keys as undefined, so empty optional formats pass', async () => {
		const onsubmit = vi.fn();
		const form = createSuiForm(
			z.object({
				name: z.string().min(1),
				website: z.url().optional(),
				birthday: z.iso.date().optional(),
				meeting: z.iso.datetime({ local: true }).optional()
			}),
			{ onsubmit }
		);
		expect(form.values.website).toBeUndefined();
		form.fields.name.change('Ada', 'text');
		// '' would fail z.url() / z.iso.date() even though the keys are optional
		expect(await form.handleSubmit()).toBe(true);
		expect(onsubmit).toHaveBeenCalled();
	});

	it('starts transform pipes from their INPUT-side default', () => {
		const form = createSuiForm(
			z.object({
				count: z.string().transform((v) => v.length),
				fallback: z.string().catch('x'),
				primed: z.string().prefault('hello')
			})
		);
		expect(form.values.count).toBe('');
		expect(form.values.fallback).toBe('');
		expect(form.values.primed).toBe('hello');
	});
});

describe('createSuiForm — dirty tracking and re-baselining', () => {
	it('clears a field from `dirty` when it is edited back to its initial value', () => {
		const form = createSuiForm(accountSchema, { initialValues: { name: 'Ada' } });
		form.fields.name.change('Grace', 'text');
		expect(form.dirty).toEqual({ name: true });
		expect(form.isDirty).toBe(true);

		form.fields.name.change('Ada', 'text');
		expect(form.dirty).toEqual({});
		expect(form.isDirty).toBe(false);
	});

	it('tracks programmatic writes the same way', () => {
		const form = createSuiForm(accountSchema);
		form.fields.email.value = 'x@example.com';
		expect(form.isDirty).toBe(true);
		form.setValues({ email: '' });
		expect(form.isDirty).toBe(false);
	});

	it('reset(values) makes the loaded record the new pristine baseline', () => {
		const form = createSuiForm(accountSchema);
		form.fields.name.change('typing…', 'text');
		form.setErrors({ email: 'Taken' });

		form.reset({ name: 'Ada', email: 'ada@example.com' });
		expect(form.values).toEqual({ name: 'Ada', email: 'ada@example.com' });
		expect(form.isDirty).toBe(false);
		expect(form.fields.email.errors).toEqual([]);

		// dirty is now measured against the loaded record
		form.fields.name.change('Grace', 'text');
		expect(form.isDirty).toBe(true);
		form.fields.name.change('Ada', 'text');
		expect(form.isDirty).toBe(false);

		// a plain reset() returns to the NEW baseline
		form.fields.name.change('Grace', 'text');
		form.reset();
		expect(form.values.name).toBe('Ada');
	});
});

describe('createSuiForm — submit lifecycle', () => {
	it('joins a submit fired while one is in flight (no double onsubmit)', async () => {
		let release!: () => void;
		const onsubmit = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
		const form = createSuiForm(accountSchema, { onsubmit });
		fillAccount(form);

		const first = form.handleSubmit();
		const second = form.handleSubmit(); // double click
		expect(second).toBe(first);
		release();
		expect(await first).toBe(true);
		expect(onsubmit).toHaveBeenCalledTimes(1);

		// once settled, the next submit runs again
		const third = form.handleSubmit();
		release();
		await third;
		expect(onsubmit).toHaveBeenCalledTimes(2);
	});

	it('clears a stale form-level server error once a retry succeeds', async () => {
		let fail = true;
		const form = createSuiForm(accountSchema, {
			onsubmit: async () => {
				if (fail) throw new Error('Network error — try again.');
			}
		});
		fillAccount(form);

		expect(await form.handleSubmit()).toBe(false);
		expect(form.formErrors).toEqual(['Network error — try again.']);

		fail = false;
		expect(await form.handleSubmit()).toBe(true);
		expect(form.formErrors).toEqual([]);
	});

	it('repeated failures do not stack duplicate form-level messages', async () => {
		const form = createSuiForm(accountSchema, {
			onsubmit: async () => {
				throw new Error('Down');
			}
		});
		fillAccount(form);
		await form.handleSubmit();
		await form.handleSubmit();
		expect(form.formErrors).toEqual(['Down']);
	});

	it('thrown server issues clear per field — editing one never wipes another', async () => {
		const form = createSuiForm(accountSchema, {
			onsubmit: () => {
				throw new ZodError([
					{ code: 'custom', input: '', path: ['name'], message: 'Name is reserved' },
					{ code: 'custom', input: '', path: ['email'], message: 'Already registered' }
				]);
			}
		});
		fillAccount(form);
		expect(await form.handleSubmit()).toBe(false);
		expect(form.fields.name.errors).toEqual(['Name is reserved']);
		expect(form.fields.email.errors).toEqual(['Already registered']);

		// the user fixes the name — the email's server verdict still stands
		form.fields.name.change('Grace', 'text');
		expect(form.fields.name.errors).toEqual([]);
		expect(form.fields.email.errors).toEqual(['Already registered']);
	});

	it('a fresh server round-trip replaces the previous field verdicts', async () => {
		let reject = true;
		const form = createSuiForm(accountSchema, {
			onsubmit: () => {
				if (reject) {
					throw { issues: [{ message: 'Already registered', path: ['email'] }] };
				}
			}
		});
		fillAccount(form);
		await form.handleSubmit();
		expect(form.fields.email.errors).toEqual(['Already registered']);

		reject = false; // e.g. the account was freed up server-side
		expect(await form.handleSubmit()).toBe(true);
		expect(form.fields.email.errors).toEqual([]);
	});
});

describe('createSuiForm — form-level refines are reveal-gated', () => {
	const schema = z
		.object({ phone: z.string(), email: z.string() })
		.refine((d) => d.phone !== '' || d.email !== '', { message: 'Give us a phone or an email' });

	it('stays quiet while the user is filling the form in', () => {
		const form = createSuiForm(schema);
		form.fields.phone.blur(); // a whole-schema parse runs — the root refine fails
		expect(form.formErrors).toEqual([]);
		expect(form.hasErrors).toBe(false);
	});

	it('shows after a failed submit, and keeps re-evaluating live', async () => {
		const form = createSuiForm(schema);
		expect(await form.handleSubmit()).toBe(false);
		expect(form.formErrors).toEqual(['Give us a phone or an email']);
		expect(form.hasErrors).toBe(true);

		form.fields.email.change('ada@example.com', 'text');
		expect(form.formErrors).toEqual([]);
	});

	it('validate() reveals it too', () => {
		const form = createSuiForm(schema);
		expect(form.validate()).toBe(false);
		expect(form.formErrors).toEqual(['Give us a phone or an email']);
	});
});

describe('createSuiForm — error routing to the controls that can show it', () => {
	const schema = z.object({
		tags: z.array(z.email('Enter a valid email')).min(1, 'Add at least one'),
		address: z.object({ city: z.string().min(1, 'Enter a city') }),
		internalId: z.string().min(1, 'Missing id')
	});

	it('rolls array-item issues up onto the control bound to the array', () => {
		const form = createSuiForm(schema);
		form.fields.tags.registerControl('tags-control');
		form.fields.tags.change(['ok@example.com', 'nope'], 'discrete');
		expect(form.fields.tags.errors).toEqual(['Enter a valid email']);
		expect(form.errorSummary).toEqual([
			{ fieldId: 'tags-control', message: 'Enter a valid email' }
		]);
	});

	it('a child with its own control keeps its errors (no duplicate on the parent)', async () => {
		const form = createSuiForm(schema);
		form.field('address').registerControl('address-group');
		form.field('address.city').registerControl('city-input');
		await form.handleSubmit();
		expect(form.field('address.city').errors).toEqual(['Enter a city']);
		expect(form.field('address').errors).toEqual([]);
	});

	it('lists errors no rendered control can display as unmappedErrors', async () => {
		const form = createSuiForm(schema);
		form.fields.tags.registerControl('tags-control');
		form.field('address.city').registerControl('city-input');
		await form.handleSubmit();
		// internalId has no control anywhere — it must not fail silently
		expect(form.unmappedErrors).toEqual(['Missing id']);
		expect(form.hasErrors).toBe(true);
	});

	it('an unmounted control stops owning its field', async () => {
		const form = createSuiForm(schema);
		const unregister = form.fields.internalId.registerControl('id-input');
		await form.handleSubmit();
		expect(form.unmappedErrors).not.toContain('Missing id');
		unregister?.();
		expect(form.unmappedErrors).toContain('Missing id');
		expect(form.errorSummary.find((e) => e.fieldId === 'id-input')).toBeUndefined();
	});

	it('hasErrors ignores issues on fields the user has not reached yet', () => {
		const form = createSuiForm(accountSchema);
		form.fields.name.change('Ada', 'text');
		form.fields.name.blur(); // whole schema ran: email is invalid but pristine
		expect(form.isValid).toBe(false);
		expect(form.hasErrors).toBe(false);
	});
});

describe('createSuiForm — async validators get an AbortSignal', () => {
	it('aborts a superseded run so stale network checks are cancelled', async () => {
		const signals: AbortSignal[] = [];
		const form = createSuiForm(z.object({ username: z.string().min(1) }), {
			asyncDebounce: 0,
			asyncValidators: {
				username: (_value, _values, { signal }) => {
					signals.push(signal);
					return new Promise(() => {}); // never settles — like a slow request
				}
			}
		});
		form.fields.username.change('ad', 'discrete');
		form.fields.username.change('ada', 'discrete');
		await vi.waitFor(() => expect(signals).toHaveLength(2));
		expect(signals[0].aborted).toBe(true);
		expect(signals[1].aborted).toBe(false);

		form.reset();
		expect(signals[1].aborted).toBe(true);
	});
});

describe('suiParse — schema errors are never misreported', () => {
	it('lets a bug inside a refine surface as itself', () => {
		const buggy = z.object({ a: z.string() }).refine((d) => {
			return (d as unknown as { missing: { deep: string } }).missing.deep === 'x';
		});
		expect(() => suiParse(buggy, { a: 'x' })).toThrow(TypeError);
	});

	it('still flags genuinely async schemas', () => {
		const asyncSchema = z.string().refine(async () => true);
		expect(() => suiParse(asyncSchema, 'x')).toThrow(SuiAsyncSchemaError);
	});
});

describe('suiErrors.fromResponse — real-world error bodies', () => {
	it('flattens nested field maps (DRF nested serializers)', () => {
		expect(
			suiErrors.fromResponse({
				address: { city: ['This field is required.'] },
				tags: [{}, { name: ['Too long'] }],
				non_field_errors: ['Out of stock']
			})
		).toEqual({
			'address.city': ['This field is required.'],
			'tags.1.name': ['Too long'],
			'': ['Out of stock']
		});
	});

	it('maps error arrays (JSON:API pointers, express-validator, Rails full messages)', () => {
		expect(
			suiErrors.fromResponse({
				errors: [
					{ source: { pointer: '/data/attributes/email' }, detail: 'has already been taken' },
					{ path: 'name', msg: 'Invalid value' },
					{ field: 'address.city', message: 'Unknown city' },
					'Account is locked'
				]
			})
		).toEqual({
			email: ['has already been taken'],
			name: ['Invalid value'],
			'address.city': ['Unknown city'],
			'': ['Account is locked']
		});
	});

	it('ignores envelope metadata instead of inventing fields from it', () => {
		// Spring Boot's default error body
		expect(
			suiErrors.fromResponse({
				timestamp: '2026-10-11T10:00:00Z',
				status: 400,
				error: 'Bad Request',
				path: '/api/users'
			})
		).toEqual({ '': ['Bad Request'] });
		// RFC 7807 problem details
		expect(
			suiErrors.fromResponse({ type: 'about:blank', title: 'Conflict', status: 409, code: 'E1' })
		).toEqual({ '': ['Conflict'] });
	});

	it('drops a generic summary when field errors explain the failure (Laravel)', () => {
		expect(
			suiErrors.fromResponse({
				message: 'The given data was invalid.',
				errors: { email: ['The email has already been taken.'] }
			})
		).toEqual({ email: ['The email has already been taken.'] });
	});
});
