import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { createSuiForm } from '#lib/sui/form/index.js';
import { DismissGuard } from '#lib/hooks/dismiss-guard.svelte.js';
import DialogFormHarness from './harness/dialog-form-harness.svelte';
import DialogNestedHarness from './harness/dialog-nested-harness.svelte';
import DialogTwoFormsHarness from './harness/dialog-two-forms-harness.svelte';
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

	it('is aria-disabled and does nothing while the form saves, and works again afterwards', async () => {
		const { form, release } = savingForm();
		render(DialogFormHarness, { form, kind });
		await startSaving(form);

		const close = screen.getByRole('button', { name: 'Close' });
		// aria-disabled, not natively disabled: the dialog keeps something focusable while the fields are off
		expect(close).not.toBeDisabled();
		expect(close).toHaveAttribute('aria-disabled', 'true');
		await user.click(close);
		await settle();
		expect(screen.getByRole('dialog')).toBeInTheDocument();

		release();
		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Close' })).not.toHaveAttribute('aria-disabled')
		);
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

/*
 * A caller's own `onEscapeKeydown` / `onInteractOutside` on a Content
 * component. Observed with bits-ui: while the guard is busy the Content
 * passes behaviour 'ignore', and bits-ui then returns before it reaches the
 * caller's handler, so the handler is NOT called either (it is for a
 * dismissal that would have gone through). A caller that needs to react
 * to a blocked dismissal must read the form's own `isSubmitting`.
 */
describe('a caller handler on the Content component', () => {
	it('is called for Escape while nothing is saving, and not while the form saves', async () => {
		const onEscapeKeydown = vi.fn();
		const { form, release } = savingForm();
		render(DialogFormHarness, { form, kind: 'dialog', onEscapeKeydown });
		await startSaving(form);

		await user.keyboard('{Escape}');
		await settle();
		expect(onEscapeKeydown).not.toHaveBeenCalled();
		expect(screen.getByRole('dialog')).toBeInTheDocument();

		release();
		await waitFor(() => expect(form.isSubmitting).toBe(false));
		await user.keyboard('{Escape}');
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		expect(onEscapeKeydown).toHaveBeenCalledTimes(1);
	});
});

/*
 * An outside click is a pointerdown on the overlay. bits-ui decides it is
 * "truly outside" from the pointer's coordinates against the content's
 * bounding box, which jsdom reports as all zeros, so the press needs
 * coordinates away from that origin.
 */
describe('an outside click on the overlay', () => {
	const overlay = () => document.querySelector<HTMLElement>('[data-slot="dialog-overlay"]')!;
	const press = () =>
		user.pointer({
			keys: '[MouseLeft]',
			target: overlay(),
			coords: { clientX: 10, clientY: 10 }
		});

	it('closes the dialog while idle', async () => {
		const onInteractOutside = vi.fn();
		const { form } = savingForm();
		render(DialogFormHarness, { form, kind: 'dialog', onInteractOutside });
		await press();
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		expect(onInteractOutside).toHaveBeenCalledTimes(1);
	});

	it('is ignored while the form saves, and works again once it has answered', async () => {
		const onInteractOutside = vi.fn();
		const { form, release } = savingForm();
		render(DialogFormHarness, { form, kind: 'dialog', onInteractOutside });
		await startSaving(form);

		await press();
		await settle();
		expect(screen.getByRole('dialog')).toBeInTheDocument();
		expect(onInteractOutside).not.toHaveBeenCalled();

		release();
		await waitFor(() => expect(form.isSubmitting).toBe(false));
		await press();
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
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

describe('aria-busy', () => {
	it.each([
		{ kind: 'dialog', role: 'dialog' },
		{ kind: 'sheet', role: 'dialog' },
		{ kind: 'alert', role: 'alertdialog' }
	] as const)('marks a $kind busy only while its form saves', async ({ kind, role }) => {
		const { form, release } = savingForm();
		render(DialogFormHarness, { form, kind });
		expect(screen.getByRole(role)).not.toHaveAttribute('aria-busy');
		await startSaving(form);
		expect(screen.getByRole(role)).toHaveAttribute('aria-busy', 'true');
		release();
		await waitFor(() => expect(screen.getByRole(role)).not.toHaveAttribute('aria-busy'));
	});
});

describe('a SuiForm that unmounts while it saves', () => {
	it('hands its hold back, so the dialog is not stuck busy', async () => {
		const first = savingForm();
		const second = savingForm();
		const view = render(DialogTwoFormsHarness, { first: first.form, second: second.form });
		await user.click(screen.getByRole('button', { name: 'Save A' }));
		await waitFor(() => expect(screen.getByTestId('guard-dialog')).toHaveTextContent('busy'));

		await view.rerender({ showFirst: false });
		await waitFor(() => expect(screen.getByTestId('guard-dialog')).toHaveTextContent('idle'));
		expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-busy');
		// the save settling later must not take a second hold off the counter
		first.release();
		await settle();
		expect(screen.getByTestId('guard-dialog')).toHaveTextContent('idle');

		await user.click(screen.getByRole('button', { name: 'Save B' }));
		await waitFor(() => expect(screen.getByTestId('guard-dialog')).toHaveTextContent('busy'));
		second.release();
		await waitFor(() => expect(screen.getByTestId('guard-dialog')).toHaveTextContent('idle'));
	});
});

describe('two SuiForms in one dialog', () => {
	it('keep it busy until both have settled', async () => {
		const first = savingForm();
		const second = savingForm();
		render(DialogTwoFormsHarness, { first: first.form, second: second.form });
		const probe = () => screen.getByTestId('guard-dialog');
		expect(probe()).toHaveTextContent('idle');

		await user.click(screen.getByRole('button', { name: 'Save A' }));
		await user.click(screen.getByRole('button', { name: 'Save B' }));
		await waitFor(() => expect(first.form.isSubmitting && second.form.isSubmitting).toBe(true));

		first.release();
		await waitFor(() => expect(first.form.isSubmitting).toBe(false));
		await settle();
		expect(probe()).toHaveTextContent('busy');
		await user.keyboard('{Escape}');
		await settle();
		expect(screen.getByRole('dialog')).toBeInTheDocument();

		second.release();
		await waitFor(() => expect(probe()).toHaveTextContent('idle'));
		await user.keyboard('{Escape}');
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	});
});

describe('nested dialogs', () => {
	it('lets a SuiForm hold the nearest guard only: the inner dialog is blocked, the outer is not', async () => {
		const { form, release } = savingForm();
		render(DialogNestedHarness, { form });
		const outer = screen.getByTestId('outer');
		const inner = screen.getByTestId('inner');
		expect(screen.getByTestId('guard-outer')).toHaveTextContent('idle');
		expect(screen.getByTestId('guard-inner')).toHaveTextContent('idle');

		await startSaving(form);
		expect(screen.getByTestId('guard-inner')).toHaveTextContent('busy');
		expect(screen.getByTestId('guard-outer')).toHaveTextContent('idle');
		expect(inner).toHaveAttribute('aria-busy', 'true');
		expect(outer).not.toHaveAttribute('aria-busy');
		// each dialog has its own X: only the inner one is locked
		const [outerClose] = within(outer).getAllByRole('button', { name: 'Close' });
		const innerClose = within(inner).getByRole('button', { name: 'Close' });
		expect(innerClose).toHaveAttribute('aria-disabled', 'true');
		expect(outerClose).not.toHaveAttribute('aria-disabled');

		await user.keyboard('{Escape}');
		await settle();
		expect(screen.getByTestId('inner')).toBeInTheDocument();
		release();
		await waitFor(() => expect(screen.getByTestId('guard-inner')).toHaveTextContent('idle'));
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
