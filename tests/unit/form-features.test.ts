import { describe, expect, it, vi } from 'vitest';
import { createSuiForm } from '$lib/sui/form/index.js';
import { suiErrors } from '$lib/sui/form/schema.js';
import { z } from 'zod';
import { testSchema, type TestSchema } from './harness/form-schema.js';

function makeForm(options: Parameters<typeof createSuiForm<TestSchema>>[1] = {}) {
	return createSuiForm(testSchema, options);
}

/** Fill every field of the shared test schema with valid values. */
function fillValid(form: ReturnType<typeof makeForm>) {
	form.setValues({
		name: 'Ada',
		email: 'ada@example.com',
		role: 'admin',
		topics: ['svelte'],
		accept: true
	});
}

describe('createSuiForm — message overrides (copy / i18n)', () => {
	it('replaces messages by exact field path', async () => {
		const form = makeForm({ messages: { name: 'Enter your full name' } });
		await form.handleSubmit();
		expect(form.fields.name.errors).toEqual(['Enter your full name']);
		// untouched paths keep the schema's copy
		expect(form.fields.email.errors).toEqual(['Enter a valid email']);
	});

	it('supports the _form alias for root-level messages', async () => {
		const rootSchema = z
			.object({ name: z.string() })
			.refine(() => false, { message: 'original root copy' });
		const form = createSuiForm(rootSchema, {
			messages: { _form: 'Something went wrong — try again.' }
		});
		await form.handleSubmit();
		expect(form.formErrors).toEqual(['Something went wrong — try again.']);
	});

	it('resolves function overrides with the original issue', async () => {
		const form = makeForm({
			messages: {
				email: (issue) => `original was "${issue.message}" for ${issue.path}`
			}
		});
		await form.handleSubmit();
		expect(form.fields.email.errors[0]).toContain('original was "Enter a valid email" for email');
	});

	it('falls back to a * wildcard before giving up', () => {
		const schema = z.object({ other: z.string().min(1, 'keep me') });
		const form = createSuiForm(schema, { messages: { '*': 'generic fallback' } });
		void form.handleSubmit();
		expect(form.fields.other.errors).toEqual(['generic fallback']);
	});

	it('never overrides when the map is empty (messages stay verbatim)', async () => {
		const form = makeForm({});
		await form.handleSubmit();
		expect(form.fields.role.errors).toEqual(['Pick a role']);
	});
});

describe('createSuiForm — per-field timing overrides', () => {
	it('lets one field validate eagerly while the form stays quiet (auto)', () => {
		const form = makeForm({ fields: { name: { validateOn: 'change' } } });
		form.fields.name.change('a', 'text');
		// the override validated mid-keystroke while the global 'auto' would not
		expect(form.fields.name.errors).toEqual(['Name must be at least 2 characters']);
	});

	it('lets one field stay quiet while the form is eager (change)', () => {
		const form = makeForm({ validateOn: 'change', fields: { name: { validateOn: 'none' } } });
		form.fields.name.change('a', 'text');
		expect(form.fields.name.errors).toEqual([]); // never scolded by schema
		form.fields.email.change('nope', 'text'); // the global 'change' mode is eager
		expect(form.fields.email.errors).toEqual(['Enter a valid email']);
	});

	it('applies a per-field sync debounce', async () => {
		vi.useFakeTimers();
		try {
			const form = makeForm({ fields: { name: { validateOn: 'change', debounce: 200 } } });
			form.fields.name.change('a', 'text');
			expect(form.fields.name.errors).toEqual([]); // still debounced
			vi.advanceTimersByTime(250);
			expect(form.fields.name.errors).toEqual(['Name must be at least 2 characters']);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('createSuiForm — async validators', () => {
	it('runs after the sync schema passes and reports its message', async () => {
		const form = makeForm({
			asyncValidators: { name: (v) => Promise.resolve(v === 'admin' ? 'Name is reserved' : true) },
			asyncDebounce: 0
		});
		form.fields.name.change('admin', 'text');
		form.fields.name.blur(); // reveals + sync passes + schedules async

		await vi.waitFor(() => expect(form.fields.name.errors).toEqual(['Name is reserved']));
		expect(form.asyncIssues.name).toEqual(['Name is reserved']);
	});

	it('skips the async run while sync errors own the field', async () => {
		const validator = vi.fn<(value: unknown) => Promise<true>>(() => Promise.resolve(true));
		const form = makeForm({ asyncValidators: { name: validator }, asyncDebounce: 0 });
		form.fields.name.blur(); // '' fails sync min(2)
		await new Promise((r) => setTimeout(r, 10));
		expect(validator).not.toHaveBeenCalled();
		expect(form.fields.name.errors).toEqual(['Name must be at least 2 characters']);
	});

	it('clears the async error the moment the field is edited (taint)', async () => {
		const form = makeForm({
			asyncValidators: { name: (v) => Promise.resolve(v === 'admin' ? 'Name is reserved' : true) },
			asyncDebounce: 0
		});
		form.fields.name.change('admin', 'text');
		form.fields.name.blur();
		await vi.waitFor(() => expect(form.fields.name.errors).toEqual(['Name is reserved']));

		form.fields.name.change('ada', 'text'); // edit → stale async error drops instantly
		expect(form.fields.name.errors).toEqual([]);
	});

	it('memoizes the last-checked value — no re-run for identical input', async () => {
		const validator = vi.fn<(value: unknown) => Promise<true>>(() => Promise.resolve(true));
		const form = makeForm({ asyncValidators: { name: validator }, asyncDebounce: 0 });
		form.fields.name.change('ab', 'text');
		form.fields.name.blur();
		await vi.waitFor(() => expect(validator).toHaveBeenCalledTimes(1));

		form.fields.name.blur(); // same value, same outcome
		form.fields.name.blur();
		expect(validator).toHaveBeenCalledTimes(1);
	});

	it('discards superseded results (latest input wins)', async () => {
		let resolveOld: (v: string | true) => void = () => {};
		const form = makeForm({
			asyncValidators: {
				name: (v) =>
					v === 'admin'
						? new Promise((r) => (resolveOld = r)) // hangs until the test releases it
						: Promise.resolve(true)
			},
			asyncDebounce: 0
		});
		form.fields.name.change('admin', 'text');
		form.fields.name.blur(); // old run starts (pending)

		form.fields.name.change('ada', 'text'); // supersedes it
		resolveOld('Old error'); // resolves AFTER the supersede
		await vi.waitFor(() => expect(form.fields.name.errors).toEqual([]));
	});

	it('exposes isValidating through the field handle', async () => {
		let release: (v: true) => void = () => {};
		const form = makeForm({
			asyncValidators: { name: () => new Promise((r) => (release = r)) },
			asyncDebounce: 0
		});
		form.fields.name.change('ab', 'text');
		form.fields.name.blur();

		await vi.waitFor(() => expect(form.fields.name.isValidating).toBe(true));
		expect(form.isValidating.name).toBe(true);
		release(true);
		await vi.waitFor(() => expect(form.fields.name.isValidating).toBe(false));
	});

	it('flushes un-checked validators on submit — onsubmit never runs while async fails', async () => {
		const onsubmit = vi.fn();
		const form = makeForm({
			asyncValidators: { name: (v) => Promise.resolve(v === 'Ada' ? 'Ada is taken' : true) },
			asyncDebounce: 0,
			onsubmit
		});
		fillValid(form); // name 'Ada' — sync-valid, async-invalid

		expect(await form.handleSubmit()).toBe(false);
		expect(form.fields.name.errors).toEqual(['Ada is taken']);
		expect(onsubmit).not.toHaveBeenCalled();
		expect(form.isSubmitting).toBe(false); // released after the failed flush
	});

	it('reuses memoized results on submit — no extra round-trips', async () => {
		const validator = vi.fn<(value: unknown) => Promise<true>>(() => Promise.resolve(true));
		const form = makeForm({
			asyncValidators: { name: validator },
			asyncDebounce: 0,
			onsubmit: vi.fn()
		});
		fillValid(form);
		form.fields.name.blur(); // checked 'Ada'
		await vi.waitFor(() => expect(validator).toHaveBeenCalledTimes(1));

		await form.handleSubmit();
		expect(validator).toHaveBeenCalledTimes(1); // memo hit, no re-run
	});

	it('turns a rejected validator into a visible field error', async () => {
		const form = makeForm({
			asyncValidators: { name: () => Promise.reject(new Error('network down')) },
			asyncDebounce: 0
		});
		form.fields.name.change('ab', 'text');
		form.fields.name.blur();
		await vi.waitFor(() => expect(form.fields.name.errors).toEqual(['network down']));
	});

	it('revalidates eagerly after a failed async submit (isSubmitted semantics)', async () => {
		const form = makeForm({
			asyncValidators: { name: (v) => Promise.resolve(v === 'Ada' ? 'Ada is taken' : true) },
			asyncDebounce: 0
		});
		fillValid(form);
		await form.handleSubmit(); // async failure
		expect(form.fields.name.errors).toEqual(['Ada is taken']);

		form.fields.name.change('Ada', 'text'); // same value: memo hit, error cleared by edit
		expect(form.fields.name.errors).toEqual([]);
	});

	it('forgets all async state on reset()', async () => {
		const form = makeForm({
			asyncValidators: { name: (v) => Promise.resolve(v === 'Ada' ? 'Ada is taken' : true) },
			asyncDebounce: 0
		});
		fillValid(form);
		await form.handleSubmit();
		expect(form.asyncIssues.name).toBeDefined();

		form.reset();
		expect(form.asyncIssues).toEqual({});
		expect(form.isValidating).toEqual({});
		expect(form.fields.name.errors).toEqual([]);
	});
});

describe('createSuiForm — valid / rewardValid / focus / checking options', () => {
	it('exposes focusOnSubmit (default summary) and checkingMessage (default Checking…)', () => {
		const form = makeForm();
		expect(form.focusOnSubmit).toBe('summary');
		expect(form.checkingMessage).toBe('Checking…');
	});

	it('valid requires reveal + a meaningful value; rewardValid gates on the option', () => {
		const form = makeForm({ rewardValid: true });
		fillValid(form);
		// pristine: not revealed → not valid (quiet until earned)
		expect(form.fields.name.valid).toBe(false);

		form.fields.name.blur(); // reveals (value already set)
		expect(form.fields.name.valid).toBe(true);
		expect(form.fields.name.rewardValid).toBe(true);

		// empty string is not a meaningful answer — no reward
		form.fields.name.value = '';
		expect(form.fields.name.valid).toBe(false);
	});

	it('rewardValid stays false when the form opts out', () => {
		const form = makeForm();
		fillValid(form);
		form.fields.name.blur();
		expect(form.fields.name.valid).toBe(true);
		expect(form.fields.name.rewardValid).toBe(false);
	});
});

describe('createSuiForm — server-error mapping via suiErrors helpers', () => {
	it('maps a standard-issues payload straight into setErrors', () => {
		const form = makeForm();
		form.setErrors(
			suiErrors.fromIssues([{ message: 'That email is already registered.', path: ['email'] }])
		);
		expect(form.fields.email.errors).toEqual(['That email is already registered.']);
	});

	it('maps a fetched JSON body (nested errors map)', () => {
		const form = makeForm();
		form.setErrors(suiErrors.fromResponse({ errors: { email: 'Taken', _form: 'rate limited' } }));
		expect(form.fields.email.errors).toEqual(['Taken']);
		expect(form.formErrors).toEqual(['rate limited']);
	});

	it('maps an issue-carrying (non-ZodError) error thrown from onsubmit', async () => {
		const form = makeForm({
			onsubmit: () => {
				// Standard Schema vendors throw plain issue-carrying errors
				throw { issues: [{ message: 'Server rejected this role', path: ['role'] }] };
			}
		});
		fillValid(form);
		expect(await form.handleSubmit()).toBe(false);
		expect(form.fields.role.errors).toEqual(['Server rejected this role']);
	});
});

describe('createSuiForm — e2e sequence replay (deterministic)', () => {
	it('replays the demo submit flow: fill → async flush → server ZodError → edit → clean submit', async () => {
		const schema = z.object({
			name: z.string().min(2, 'Name must be at least 2 characters'),
			email: z.email('Enter a valid email')
		});
		const seen: string[] = [];
		const form = createSuiForm(schema, {
			asyncValidators: {
				name: async (v) => {
					seen.push(`check:${v}`);
					await new Promise((r) => setTimeout(r, 50));
					return true;
				}
			},
			asyncDebounce: 20,
			onsubmit: async (data) => {
				await new Promise((r) => setTimeout(r, 30));
				if (data.email === 'taken@example.com') {
					throw new z.ZodError([
						{
							code: 'custom' as const,
							input: data.email,
							path: ['email'],
							message: 'That email is already registered.'
						}
					]);
				}
			}
		});

		// fill (no blur yet), then blur via the next field's focus
		form.fields.name.change('Ada Lovelace', 'text');
		form.fields.name.blur(); // schedules the debounced async check
		form.fields.email.change('taken@example.com', 'text');
		form.fields.email.blur();

		// first submit: async flush may still be pending — it must be awaited
		expect(await form.handleSubmit()).toBe(false);
		expect(form.fields.email.errors).toEqual(['That email is already registered.']);
		// the async check for 'Ada Lovelace' completed exactly once
		await vi.waitFor(() => expect(seen.filter((s) => s === 'check:Ada Lovelace')).toHaveLength(1));

		// edit the server-flagged field — display hands back to the schema
		form.fields.email.change('ada@example.com', 'text');
		expect(form.fields.email.errors).toEqual([]);

		// clean submit: memoised async result, onsubmit succeeds
		expect(await form.handleSubmit()).toBe(true);
		expect(seen.filter((s) => s === 'check:Ada Lovelace')).toHaveLength(1); // no re-run
	});
});
