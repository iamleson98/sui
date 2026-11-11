import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { createSuiForm } from '#lib/sui/form/index.js';
import DialogFormHarness from './harness/dialog-form-harness.svelte';
import { dialogFormSchema } from './harness/form-schema.js';

const user = userEvent.setup({ pointerEventsCheck: 0 });

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

/**
 * jsdom keeps the focus on a control that becomes disabled, a browser drops it
 * to <body>: this makes `document.activeElement` answer what the browser would.
 */
function pretendFocusIs(el: Element) {
	Object.defineProperty(document, 'activeElement', { configurable: true, get: () => el });
}

afterEach(() => {
	// remove the instance override: the prototype's getter answers again
	delete (document as unknown as { activeElement?: Element }).activeElement;
});

/** Press Save and wait until the form is disabled. */
async function startSaving(form: ReturnType<typeof savingForm>['form']) {
	await user.click(screen.getByRole('button', { name: 'Save' }));
	await waitFor(() => expect(form.isSubmitting).toBe(true));
	await waitFor(() => expect(screen.getByLabelText('Name')).toBeDisabled());
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('focus after a save', () => {
	it('goes back to the control the person was on when the browser dropped it', async () => {
		const { form, release } = savingForm();
		render(DialogFormHarness, { form, kind: 'plain' });
		const save = screen.getByRole('button', { name: 'Save' });
		const focus = vi.spyOn(save, 'focus');
		await startSaving(form);
		focus.mockClear(); // the click itself focused the button
		pretendFocusIs(document.body); // the disabled fieldset dropped the focus

		release();
		await waitFor(() => expect(focus).toHaveBeenCalledWith({ preventScroll: true }));
	});

	it('is not taken from another control the person moved to meanwhile', async () => {
		const { form, release } = savingForm();
		render(DialogFormHarness, { form, kind: 'plain' });
		const save = screen.getByRole('button', { name: 'Save' });
		const focus = vi.spyOn(save, 'focus');
		const other = document.createElement('input');
		document.body.append(other);
		try {
			await startSaving(form);
			focus.mockClear(); // the click itself focused the button
			pretendFocusIs(other);

			release();
			await waitFor(() => expect(form.isSubmitting).toBe(false));
			await settle();
			expect(focus).not.toHaveBeenCalled();
		} finally {
			other.remove();
		}
	});

	it('does nothing when the form is gone by then', async () => {
		const { form, release } = savingForm();
		const { unmount } = render(DialogFormHarness, { form, kind: 'plain' });
		const save = screen.getByRole('button', { name: 'Save' });
		const focus = vi.spyOn(save, 'focus');
		await startSaving(form);
		focus.mockClear(); // the click itself focused the button
		pretendFocusIs(document.body);

		unmount();
		release();
		await waitFor(() => expect(form.isSubmitting).toBe(false));
		await settle();
		expect(focus).not.toHaveBeenCalled();
	});
});
