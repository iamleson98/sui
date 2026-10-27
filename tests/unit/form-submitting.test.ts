import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { createSuiForm } from '$lib/sui/form/index.js';
import FormA11yHarness from './harness/form-a11y-harness.svelte';
import { testSchema } from './harness/form-schema.js';

const user = userEvent.setup({ pointerEventsCheck: 0 });

/** A form that is valid once the two fields of the harness are filled, and whose submit waits for `release`. */
function setup() {
	let release!: () => void;
	const saving = new Promise<void>((resolve) => (release = resolve));
	const form = createSuiForm(testSchema, {
		initialValues: { email: 'a@b.co', role: 'admin', topics: ['x'] },
		onsubmit: () => saving
	});
	render(FormA11yHarness, { form });
	return { form, release };
}

describe('SuiForm while it submits', () => {
	it('disables every field and the submit button until the submit is done', async () => {
		const { release } = setup();
		await user.type(screen.getByLabelText('Name'), 'Ada');
		await user.click(screen.getByLabelText('Accept the terms'));
		expect(screen.getByLabelText('Name')).toBeEnabled();

		await user.click(screen.getByRole('button', { name: 'Submit' }));
		await waitFor(() => expect(screen.getByLabelText('Name')).toBeDisabled());
		expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();

		release();
		await waitFor(() => expect(screen.getByLabelText('Name')).toBeEnabled());
		expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled();
	});

	it('keeps the fields editable when a form opts out', async () => {
		const form = createSuiForm(testSchema, {
			initialValues: { email: 'a@b.co', role: 'admin', topics: ['x'] },
			onsubmit: () => new Promise<void>(() => {})
		});
		const { container } = render(FormA11yHarness, { form, disableWhileSubmitting: false });
		await user.type(screen.getByLabelText('Name'), 'Ada');
		await user.click(screen.getByLabelText('Accept the terms'));
		await user.click(screen.getByRole('button', { name: 'Submit' }));

		await waitFor(() => expect(form.isSubmitting).toBe(true));
		expect(container.querySelector('fieldset')).not.toBeDisabled();
		expect(screen.getByLabelText('Name')).toBeEnabled();
	});
});
