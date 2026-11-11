import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { createSuiForm } from '#lib/sui/form/index.js';
import { DismissGuard } from '#lib/hooks/dismiss-guard.svelte.js';
import DialogFormHarness from './harness/dialog-form-harness.svelte';
import { dialogFormSchema } from './harness/form-schema.js';

const user = userEvent.setup({ pointerEventsCheck: 0 });

describe('DismissGuard', () => {
	it('is busy while any hold is active', () => {
		const guard = new DismissGuard();
		expect(guard.busy).toBe(false);
		const a = guard.hold();
		const b = guard.hold();
		expect(guard.busy).toBe(true);
		a();
		expect(guard.busy).toBe(true);
		b();
		expect(guard.busy).toBe(false);
	});

	it('releases a hold only once', () => {
		const guard = new DismissGuard();
		const a = guard.hold();
		const b = guard.hold();
		a();
		a(); // a second call must not release the other hold
		expect(guard.busy).toBe(true);
		b();
		expect(guard.busy).toBe(false);
	});
});

/** A form whose submit waits for the test; `release` ends the save. */
function savingForm() {
	let release!: () => void;
	const saving = new Promise<void>((resolve) => (release = resolve));
	const form = createSuiForm(dialogFormSchema, {
		initialValues: { name: 'Ada' },
		onsubmit: () => saving
	});
	return { form, release };
}

/** Press Save and wait until the form is disabled. */
async function startSaving(form: ReturnType<typeof savingForm>['form']) {
	await user.click(screen.getByRole('button', { name: 'Save' }));
	await waitFor(() => expect(form.isSubmitting).toBe(true));
	await waitFor(() => expect(screen.getByLabelText('Name')).toBeDisabled());
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe.each([
	{ kind: 'dialog', role: 'dialog' },
	{ kind: 'sheet', role: 'dialog' },
	{ kind: 'alert', role: 'alertdialog' }
] as const)('$kind with a saving form in a child component', ({ kind, role }) => {
	it('closes on Escape while nothing is saving', async () => {
		const { form } = savingForm();
		render(DialogFormHarness, { form, kind });
		expect(screen.getByRole(role)).toBeInTheDocument();
		await user.keyboard('{Escape}');
		await waitFor(() => expect(screen.queryByRole(role)).toBeNull());
	});

	it('ignores Escape while the form saves, then closes on Escape once it has answered', async () => {
		const { form, release } = savingForm();
		render(DialogFormHarness, { form, kind });
		await startSaving(form);

		await user.keyboard('{Escape}');
		await settle();
		expect(screen.getByRole(role)).toBeInTheDocument();
		expect(screen.getByTestId('state')).toHaveTextContent('open');

		release();
		await waitFor(() => expect(form.isSubmitting).toBe(false));
		await user.keyboard('{Escape}');
		await waitFor(() => expect(screen.queryByRole(role)).toBeNull());
	});

	it('still closes from code while the form saves', async () => {
		const { form, release } = savingForm();
		const view = render(DialogFormHarness, { form, kind });
		await startSaving(form);

		await view.rerender({ open: false });
		await waitFor(() => expect(screen.queryByRole(role)).toBeNull());
		release();
	});
});

describe.each(['dialog', 'sheet'] as const)('the X button of a %s', (kind) => {
	it('closes it while idle', async () => {
		const { form } = savingForm();
		render(DialogFormHarness, { form, kind });
		expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled();
		await user.click(screen.getByRole('button', { name: 'Close' }));
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	});

	it('is disabled and does nothing while the form saves, and works again afterwards', async () => {
		const { form, release } = savingForm();
		render(DialogFormHarness, { form, kind });
		await startSaving(form);

		const close = screen.getByRole('button', { name: 'Close' });
		expect(close).toBeDisabled();
		expect(close).toHaveAttribute('aria-disabled', 'true');
		await user.click(close);
		await settle();
		expect(screen.getByRole('dialog')).toBeInTheDocument();

		release();
		await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled());
		await user.click(screen.getByRole('button', { name: 'Close' }));
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	});
});

describe('a caller-chosen dismiss behaviour', () => {
	it('is kept while nothing is saving', async () => {
		const { form } = savingForm();
		render(DialogFormHarness, { form, kind: 'dialog', escapeKeydownBehavior: 'ignore' });
		await user.keyboard('{Escape}');
		await settle();
		expect(screen.getByRole('dialog')).toBeInTheDocument();
	});
});

describe('a SuiForm outside any dialog', () => {
	it('submits as usual, with no guard and no error', async () => {
		const { form, release } = savingForm();
		render(DialogFormHarness, { form, kind: 'plain' });
		await startSaving(form);
		release();
		await waitFor(() => expect(screen.getByLabelText('Name')).toBeEnabled());
	});
});

describe('when the save fails', () => {
	it('lets Escape close the dialog again', async () => {
		let fail!: (error: Error) => void;
		const form = createSuiForm(dialogFormSchema, {
			initialValues: { name: 'Ada' },
			onsubmit: () => new Promise<void>((_, reject) => (fail = reject))
		});
		render(DialogFormHarness, { form, kind: 'dialog' });
		await startSaving(form);

		fail(new Error('Network error'));
		await waitFor(() => expect(form.isSubmitting).toBe(false));
		await user.keyboard('{Escape}');
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	});
});
