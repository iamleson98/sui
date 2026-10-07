import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { createSuiForm } from '$lib/sui/form/index.js';
import type { SuiFormInstance } from '$lib/sui/form/create-form.svelte.js';
import { z, ZodError } from 'zod';
import FormHarness from './harness/form-harness.svelte';
import { testSchema, type TestSchema } from './harness/form-schema.js';

function makeForm(options: Parameters<typeof createSuiForm<TestSchema>>[1] = {}) {
	return createSuiForm(testSchema, options);
}

describe('createSuiForm — smart defaults & values', () => {
	it('derives defaults from the schema types', () => {
		const form = makeForm();
		expect(form.values).toMatchObject({
			name: '',
			email: '',
			role: undefined,
			topics: [],
			accept: undefined,
			newsletter: true, // z.boolean().default(true)
			address: { city: '' }
		});
	});

	it('layers initialValues over the schema defaults', () => {
		const form = makeForm({ initialValues: { name: 'Ada', role: 'admin' } });
		expect(form.values.name).toBe('Ada');
		expect(form.values.role).toBe('admin');
		expect(form.values.email).toBe('');
	});

	it('caches field handles — form.fields.x is a stable identity', () => {
		const form = makeForm();
		expect(form.fields.name).toBe(form.fields.name);
		expect(form.field('address.city')).toBe(form.field('address.city'));
	});

	it('binds nested paths through the handle value', () => {
		const form = makeForm();
		const city = form.field('address.city');
		city.value = 'Hanoi';
		expect(form.values.address.city).toBe('Hanoi');
		expect(city.dirty).toBe(true);
	});
});

describe('createSuiForm — smart validation timing', () => {
	it('keeps a pristine text field quiet on change, validates on first blur', () => {
		const form = makeForm();
		const name = form.fields.name;
		name.change('a', 'text');
		expect(name.errors).toEqual([]); // never scold mid-keystroke
		expect(name.touched).toBe(false);

		name.blur();
		expect(name.touched).toBe(true);
		expect(name.errors).toEqual(['Name must be at least 2 characters']);
		expect(name.invalid).toBe(true);
	});

	it('re-validates on every change once the field is touched', () => {
		const form = makeForm();
		const name = form.fields.name;
		name.blur();
		expect(name.errors).not.toEqual([]);

		name.change('ab', 'text');
		expect(name.errors).toEqual([]);
	});

	it('validates discrete controls immediately, even when pristine', () => {
		const form = makeForm();
		const topics = form.fields.topics;
		topics.change([], 'discrete'); // a completed answer: validate now
		expect(topics.errors).toEqual(['Select at least one topic']);
	});

	it('hides errors on fields the user has not visited (reveal gating)', () => {
		const form = makeForm();
		const name = form.fields.name;
		name.blur(); // reveals name only; every other field is invalid too
		expect(name.errors.length).toBeGreaterThan(0);

		expect(form.fields.role.errors).toEqual([]); // issue exists, display gated
		expect(form.issues.role).toEqual(['Pick a role']); // raw map still fresh
		expect(form.fields.email.errors).toEqual([]);
	});

	it('revalidates on change after a failed submit (isSubmitted semantics)', () => {
		const form = makeForm({ validateOn: 'blur' }); // even with blur-only timing
		void form.handleSubmit();
		expect(form.fields.email.errors).toEqual(['Enter a valid email']);

		form.fields.email.change('ada@example.com', 'text');
		expect(form.fields.email.errors).toEqual([]); // instantly fresh
	});
});

describe('createSuiForm — cross-field refinements', () => {
	const passwordSchema = z
		.object({
			password: z.string().min(8, 'Use at least 8 characters'),
			confirm: z.string()
		})
		.refine((d) => d.password === d.confirm, {
			path: ['confirm'],
			error: "Passwords don't match"
		});

	it('clears the refinement error when the OTHER field changes', async () => {
		const form = createSuiForm(passwordSchema);
		form.fields.password.value = 'xyz'; // too short
		form.fields.confirm.value = 'abcdefgh'; // doesn't match
		expect(await form.handleSubmit()).toBe(false); // reveals everything
		expect(form.fields.password.errors).toEqual(['Use at least 8 characters']);
		expect(form.fields.confirm.errors).toEqual(["Passwords don't match"]);

		// fixing `password` to match confirm must refresh the cross-field
		// error on `confirm` — even though confirm itself never changed
		form.fields.password.change('abcdefgh', 'text');
		expect(form.fields.password.errors).toEqual([]);
		expect(form.fields.confirm.errors).toEqual([]);
	});

	it('keeps refinement errors hidden on pristine fields', () => {
		const form = createSuiForm(passwordSchema);
		form.fields.password.blur(); // only password revealed
		expect(form.fields.password.errors).toEqual(['Use at least 8 characters']);
		expect(form.fields.confirm.errors).toEqual([]); // gated: confirm never visited
	});
});

describe('createSuiForm — submit flow', () => {
	it('reveals every invalid field and reports failure', async () => {
		const form = makeForm();
		const prevented = vi.fn();
		const ok = await form.handleSubmit({ preventDefault: prevented });

		expect(ok).toBe(false);
		expect(prevented).toHaveBeenCalled();
		expect(form.submitCount).toBe(1);
		expect(form.isSubmitted).toBe(true);
		expect(form.fields.role.errors).toEqual(['Pick a role']);
		expect(form.fields.accept.errors).toEqual(['Please accept the terms']);
		expect(form.formErrors).toEqual([]);
	});

	it('passes the zod-parsed output to onsubmit (transforms applied)', async () => {
		const transformSchema = z.object({
			count: z.string().transform((v) => v.length)
		});
		const onsubmit = vi.fn();
		const form = createSuiForm(transformSchema, { onsubmit });
		form.fields.count.change('abc', 'text');

		const ok = await form.handleSubmit();
		expect(ok).toBe(true);
		expect(onsubmit).toHaveBeenCalledWith(
			expect.objectContaining({ count: 3 }), // parsed output, not the raw string
			form
		);
	});

	it('tracks isSubmitting across the onsubmit round-trip', async () => {
		let resolve: () => void;
		const gate = new Promise<void>((r) => (resolve = r));
		const form = makeForm({
			onsubmit: async () => {
				await gate;
			}
		});
		form.setValues({
			name: 'Ada',
			email: 'ada@example.com',
			role: 'admin',
			topics: ['svelte'],
			accept: true
		});

		const pending = form.handleSubmit();
		await waitFor(() => expect(form.isSubmitting).toBe(true));
		resolve!();
		expect(await pending).toBe(true);
		expect(form.isSubmitting).toBe(false);
	});

	it('maps a thrown ZodError back onto the fields (server-side validation)', async () => {
		const form = makeForm({
			onsubmit: () => {
				throw new ZodError([
					{
						code: 'custom' as const,
						input: undefined,
						path: ['email'],
						message: 'That email is already registered.'
					}
				]);
			}
		});
		form.setValues({
			name: 'Ada',
			email: 'taken@example.com',
			role: 'admin',
			topics: ['svelte'],
			accept: true
		});

		expect(await form.handleSubmit()).toBe(false);
		expect(form.fields.email.errors).toEqual(['That email is already registered.']);
	});

	it('turns other thrown errors into form-level errors', async () => {
		const form = makeForm({
			onsubmit: () => {
				throw new Error('Something went wrong on the server.');
			}
		});
		form.setValues({
			name: 'Ada',
			email: 'ada@example.com',
			role: 'admin',
			topics: ['svelte'],
			accept: true
		});

		expect(await form.handleSubmit()).toBe(false);
		expect(form.formErrors).toContain('Something went wrong on the server.');
	});
});

describe('createSuiForm — server errors (setErrors)', () => {
	it('shows server errors immediately and clears them on edit', () => {
		const form = makeForm();
		form.setErrors({ email: 'That email is already registered.' });
		expect(form.fields.email.errors).toEqual(['That email is already registered.']);

		form.fields.email.change('other@example.com', 'text');
		expect(form.fields.email.errors).toEqual([]);
	});

	it('supports the _form key for form-level messages', () => {
		const form = makeForm();
		form.setErrors({ _form: 'Rate limited — try again later.' });
		expect(form.formErrors).toEqual(['Rate limited — try again later.']);
	});
});

describe('createSuiForm — programmatic control', () => {
	it('validate() reveals every invalid field and reports validity', () => {
		const form = makeForm();
		expect(form.validate()).toBe(false);
		expect(form.fields.name.errors).toEqual(['Name must be at least 2 characters']);

		form.fields.name.value = 'Ada';
		form.fields.email.value = 'ada@example.com';
		form.fields.role.value = 'admin';
		form.fields.topics.value = ['svelte'];
		form.fields.accept.value = true;
		expect(form.validate()).toBe(true);
		expect(form.fields.name.errors).toEqual([]);
	});

	it('isValid silently tracks validity without revealing anything', () => {
		const form = makeForm();
		expect(form.isValid).toBe(false);
		expect(form.issues).toEqual({}); // display state untouched
		expect(form.fields.name.errors).toEqual([]);

		form.fields.name.value = 'Ada';
		expect(form.isValid).toBe(false); // other fields still invalid
	});

	it('reset() restores defaults and forgets all validation state', async () => {
		const form = makeForm();
		form.fields.name.change('Ada', 'text');
		await form.handleSubmit();
		expect(form.isSubmitted).toBe(true);

		form.reset();
		expect(form.values.name).toBe('');
		expect(form.fields.name.errors).toEqual([]);
		expect(form.fields.name.touched).toBe(false);
		expect(form.submitCount).toBe(0);
		expect(form.isSubmitted).toBe(false);
		expect(form.isValid).toBe(false);
	});

	it('errorSummary lists revealed errors with registered control ids', async () => {
		const form = makeForm();
		form.fields.email.registerControl('email-control');
		await form.handleSubmit();

		const summary = form.errorSummary;
		const emailEntry = summary.find((e) => e.fieldId === 'email-control');
		expect(emailEntry?.message).toContain('Enter a valid email');
		// fields without a registered control are skipped, not broken
		expect(summary.every((e) => typeof e.fieldId === 'string')).toBe(true);
	});

	it('rejects async schemas with a clear error', () => {
		const asyncSchema = z.object({
			name: z.string().refine(async (v) => v.length > 2, 'too short')
		});
		const form = createSuiForm(asyncSchema);
		expect(() => form.isValid).toThrowError(/asynchronous/);
	});
});

describe('createSuiForm — component wiring', () => {
	// bits-ui portals lock the body (pointer-events: none) and aria-hide
	// siblings, so we disable user-event's pointer-events check
	const user = userEvent.setup({ pointerEventsCheck: 0 });

	function setup(options: Parameters<typeof makeForm>[0] = {}) {
		const form = makeForm(options);
		const rendered = render(FormHarness, { form });
		return { form, ...rendered };
	}

	it('binds an input to the form with quiet-then-eager timing', async () => {
		const { form } = setup();
		const input = screen.getByLabelText('Name') as HTMLInputElement;

		await user.type(input, 'a');
		// quiet while typing the first answer
		expect(screen.queryByText('Name must be at least 2 characters')).toBeNull();

		await user.tab(); // blur the input (focus moves to the next control)
		await waitFor(() => {
			expect(input).toHaveAttribute('aria-invalid', 'true');
			expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument();
		});

		// re-focusing the input blurs the select — its own error shows; the
		// name error must clear the moment the second character lands
		await user.type(input, 'b');
		await waitFor(() => {
			expect(screen.queryByText('Name must be at least 2 characters')).toBeNull();
		});
		expect(form.values.name).toBe('ab');
	});

	it('flows checkbox changes through the handle and clears submit errors instantly', async () => {
		const { form } = setup();
		await user.click(screen.getByRole('button', { name: 'Submit' }));

		await waitFor(() => {
			expect(screen.getByText('Please accept the terms')).toBeInTheDocument();
		});
		expect(form.fields.accept.errors).toEqual(['Please accept the terms']);

		await user.click(screen.getByRole('checkbox'));
		await waitFor(() => {
			expect(screen.queryByText('Please accept the terms')).toBeNull();
		});
		expect(form.values.accept).toBe(true);
	});

	it('flows select selections through the handle', async () => {
		const { form } = setup();
		await user.click(screen.getByRole('button', { name: 'Role' }));
		const option = await waitFor(() => {
			const el = screen
				.queryAllByRole('option', { hidden: true })
				.find((o) => /admin/i.test(o.textContent ?? ''));
			if (!el) throw new Error('admin option not found');
			return el as HTMLElement;
		});
		await user.click(option);
		expect(form.values.role).toBe('admin');
	});

	it('focuses the first invalid control after a failed submit (desktop)', async () => {
		setup();
		const input = screen.getByLabelText('Name') as HTMLInputElement;
		await user.click(screen.getByRole('button', { name: 'Submit' }));
		await waitFor(() => {
			expect(document.activeElement).toBe(input);
		});
	});
});
