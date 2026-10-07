import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { SuiInput } from '$lib/sui';
import { SuiCheckbox } from '$lib/sui/checkbox/index.js';
import { SuiSwitch } from '$lib/sui/switch/index.js';
import { SuiErrorSummary } from '$lib/sui/error-summary/index.js';
import { createSuiForm, type SuiFormInstance } from '$lib/sui/form/index.js';
import FormA11yHarness from './harness/form-a11y-harness.svelte';
import { testSchema, type TestSchema } from './harness/form-schema.js';

const user = userEvent.setup({ pointerEventsCheck: 0 });

function makeForm(options: Parameters<typeof createSuiForm<TestSchema>>[1] = {}) {
	return createSuiForm(testSchema, options);
}

describe('field a11y — persistent live regions (NVDA/JAWS/VoiceOver)', () => {
	it('mounts the message region empty, before any error exists', async () => {
		const { container } = render(SuiInput, {
			label: 'Email',
			schema: z.string().min(3, 'Min 3')
		});
		const input = screen.getByLabelText('Email');

		// the live region pre-exists its content — the Tetra Logical / WAI
		// requirement for reliable announcements
		const live = container.querySelector('[aria-live="polite"]');
		expect(live).toBeTruthy();
		expect(live).toHaveTextContent('');
		expect(input.getAttribute('aria-describedby')).toBeNull();

		await user.type(input, 'a');
		input.blur();
		await waitFor(() => {
			// the message appears INSIDE the pre-existing region — no
			// region-created-with-content silent failure
			expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent('Min 3');
			expect(input).toHaveAttribute('aria-invalid', 'true');
		});
	});

	it('keeps the region mounted (empty) after errors clear', async () => {
		const { container } = render(SuiInput, {
			label: 'Email',
			schema: z.string().min(3, 'Min 3')
		});
		const input = screen.getByLabelText('Email');
		await user.type(input, 'a');
		input.blur();
		await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'));

		await user.type(input, 'bc');
		await waitFor(() => expect(input).not.toHaveAttribute('aria-invalid'));
		expect(container.querySelector('[aria-live="polite"]')).toBeTruthy();
		expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent('');
	});
});

describe('field a11y — hint + error coexistence (GOV.UK / WCAG 3.3.2)', () => {
	it('composes aria-describedby from hint AND message ids, hint first', () => {
		const { container } = render(SuiInput, {
			label: 'Email',
			subText: 'We will never share your email.',
			errors: ['Email is already taken']
		});
		const input = screen.getByLabelText('Email');
		const ids = (input.getAttribute('aria-describedby') ?? '').split(' ');
		expect(ids).toHaveLength(2);
		expect(document.getElementById(ids[0])).toHaveTextContent('We will never share your email.');
		expect(document.getElementById(ids[1])).toHaveTextContent('Email is already taken');
		// both stay visible — errors never replace instructions
		expect(screen.getByText('We will never share your email.')).toBeInTheDocument();
		expect(container.querySelector('[data-sui-field-hint]')).toHaveTextContent(
			'We will never share your email.'
		);
	});

	it('references only the hint when valid', () => {
		render(SuiInput, { label: 'Email', subText: 'A hint' });
		const input = screen.getByLabelText('Email');
		const ids = (input.getAttribute('aria-describedby') ?? '').split(' ');
		expect(ids).toHaveLength(1);
		expect(document.getElementById(ids[0])).toHaveTextContent('A hint');
	});

	it('checkbox: hint carries its own id; describedby composes both', () => {
		render(SuiCheckbox, {
			label: 'Accept',
			subText: 'Read the terms first.',
			errors: ['Required']
		});
		const box = screen.getByRole('checkbox');
		const ids = (box.getAttribute('aria-describedby') ?? '').split(' ');
		expect(ids).toHaveLength(2);
		expect(document.getElementById(ids[0])).toHaveTextContent('Read the terms first.');
		expect(document.getElementById(ids[1])).toHaveTextContent('Required');
	});

	it('switch: hint carries its own id; describedby composes both', () => {
		render(SuiSwitch, {
			label: 'Enable',
			subText: 'Turns on notifications.',
			errors: ['Required']
		});
		const control = screen.getByRole('switch');
		const ids = (control.getAttribute('aria-describedby') ?? '').split(' ');
		expect(ids).toHaveLength(2);
		expect(document.getElementById(ids[0])).toHaveTextContent('Turns on notifications.');
		expect(document.getElementById(ids[1])).toHaveTextContent('Required');
	});
});

describe('field a11y — async checking state', () => {
	it('renders the checking message (with spinner) while the validator runs', async () => {
		let release: (v: true) => void = () => {};
		const form = makeForm({
			asyncValidators: { name: () => new Promise((r) => (release = r)) },
			asyncDebounce: 0,
			checkingMessage: 'Checking availability…'
		});
		render(FormA11yHarness, { form });
		const input = screen.getByLabelText('Name');

		await user.type(input, 'ab');
		input.blur();
		await waitFor(() => {
			expect(screen.getByText('Checking availability…')).toBeInTheDocument();
		});
		expect(form.field('name').isValidating).toBe(true);

		release(true);
		await waitFor(() => expect(screen.queryByText('Checking availability…')).toBeNull());
		expect(form.field('name').isValidating).toBe(false);
	});
});

describe('field a11y — reward early (success ring)', () => {
	it('paints the success variant once a revealed field validates', async () => {
		const form = makeForm({ rewardValid: true });
		const { container } = render(FormA11yHarness, { form });
		const input = screen.getByLabelText('Name');

		await user.type(input, 'ab');
		expect(container.querySelector('[data-sui-control="input"]')).not.toHaveAttribute(
			'data-sui-variant',
			'success'
		); // quiet until revealed

		input.blur();
		await waitFor(() => {
			expect(container.querySelector('[data-sui-control="input"]')).toHaveAttribute(
				'data-sui-variant',
				'success'
			);
		});
	});
});

describe('SuiForm — error summary focus (GOV.UK pattern)', () => {
	it('the summary box is focusable and receives focus after a failed submit', async () => {
		const form = makeForm();
		render(FormA11yHarness, { form, showSummary: true });

		await user.click(screen.getByRole('button', { name: 'Submit' }));

		const summary = await screen.findByRole('alert');
		expect(summary).toHaveAttribute('tabindex', '-1');
		await waitFor(() => expect(document.activeElement).toBe(summary));
	});

	it('falls back to the first invalid control when no summary is rendered', async () => {
		const form = makeForm();
		render(FormA11yHarness, { form });
		const input = screen.getByLabelText('Name');

		await user.click(screen.getByRole('button', { name: 'Submit' }));
		await waitFor(() => expect(document.activeElement).toBe(input));
	});

	it('honours focusOnSubmit: "none" — no focus management', async () => {
		const form = makeForm({ focusOnSubmit: 'none' });
		render(FormA11yHarness, { form, showSummary: true });
		const button = screen.getByRole('button', { name: 'Submit' });

		await user.click(button);
		await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
		// focus stays wherever the user left it — nothing is yanked
		expect(document.activeElement).toBe(button);
	});

	it('honours focusOnSubmit: "field" — the first invalid field, even with a summary', async () => {
		const form = makeForm({ focusOnSubmit: 'field' });
		render(FormA11yHarness, { form, showSummary: true });
		const input = screen.getByLabelText('Name');

		await user.click(screen.getByRole('button', { name: 'Submit' }));
		await waitFor(() => expect(document.activeElement).toBe(input));
	});
});

describe('SuiForm — form-level error banner', () => {
	const rootSchema = z
		.object({ name: z.string() })
		.refine(() => false, { message: 'Server says no' });

	function setupRootForm(options: Parameters<typeof createSuiForm<typeof rootSchema>>[1] = {}) {
		const form = createSuiForm(rootSchema, options);
		return { form, ...render(FormA11yHarness, { form, showFormErrors: true }) };
	}

	it('renders form-level errors as a banner (role=alert, focusable)', async () => {
		const { form } = setupRootForm();
		await user.type(screen.getByLabelText('Name'), 'anything');
		await form.handleSubmit();

		const banner = await screen.findByText('Server says no');
		expect(banner.closest('[data-sui-form-errors]')).toHaveAttribute('role', 'alert');
		expect(banner.closest('[data-sui-form-errors]')).toHaveAttribute('tabindex', '-1');
	});

	it('receives focus after a failed submit that produced only form-level errors', async () => {
		const { form } = setupRootForm();
		await user.type(screen.getByLabelText('Name'), 'anything');
		await user.click(screen.getByRole('button', { name: 'Submit' }));

		await waitFor(() => {
			const banner = document.querySelector('[data-sui-form-errors]');
			expect(banner).toBeTruthy();
			expect(document.activeElement).toBe(banner);
		});
	});

	it('renders no visible banner when there are no form-level errors', () => {
		const form = makeForm();
		render(FormA11yHarness, { form, showFormErrors: true });
		const banner = document.querySelector('[data-sui-form-errors]');
		expect(banner).toBeTruthy(); // region exists
		expect(banner).toHaveTextContent(''); // …but is empty and takes no space
	});
});

describe('SuiErrorSummary — focusability contract', () => {
	it('carries tabindex="-1" so programmatic focus lands on it', () => {
		render(SuiErrorSummary, { errors: [{ fieldId: 'x', message: 'Broken' }] });
		expect(screen.getByRole('alert')).toHaveAttribute('tabindex', '-1');
	});
});

describe('SuiForm — issue-carrying server errors reach the banner', () => {
	it('maps a thrown non-Zod error message into the banner', async () => {
		const form = makeForm({
			onsubmit: () => {
				throw new Error('The server exploded');
			}
		});
		form.setValues({
			name: 'Ada',
			email: 'ada@example.com',
			role: 'admin',
			topics: ['svelte'],
			accept: true
		});
		render(FormA11yHarness, { form, showFormErrors: true });
		await user.click(screen.getByRole('button', { name: 'Submit' }));

		await screen.findByText('The server exploded');
		expect(form.formErrors).toContain('The server exploded');
	});
});

// keep the SuiFormInstance type import referenced for harness typing clarity
type _FormInstance = SuiFormInstance<TestSchema>;
