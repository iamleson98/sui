import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { SuiInput, SuiInputSkeleton, SuiTextarea, SuiTextareaSkeleton } from '$lib/sui';
import InputHarness from './harness/input-harness.svelte';
import { z } from 'zod';
import MailIcon from '@lucide/svelte/icons/mail';
import LockIcon from '@lucide/svelte/icons/lock';

describe('SuiInput', () => {
	it('renders a label connected to the input', () => {
		render(SuiInput, { label: 'Email', placeholder: 'you@example.com' });
		const input = screen.getByLabelText('Email');
		expect(input).toHaveAttribute('placeholder', 'you@example.com');
	});

	it('shows a required indicator with a screen-reader hint', () => {
		const { container } = render(SuiInput, { label: 'Email', required: true });
		expect(container.querySelector('[data-sui-label] .text-destructive')).toBeInTheDocument();
		expect(container.querySelector('[data-sui-label] .sr-only')).toHaveTextContent('(required)');
	});

	it('applies shared size classes to the control wrapper', () => {
		const { container } = render(SuiInput, { size: 'sm' });
		expect(container.querySelector('[data-sui-control="input"]')?.className).toMatch(/\bh-8\b/);
		expect(container.querySelector('[data-sui-control="input"]')).toHaveAttribute(
			'data-sui-size',
			'sm'
		);
	});

	it('applies variant classes (blue=info default)', () => {
		const { container } = render(SuiInput, { variant: 'success' });
		expect(container.querySelector('[data-sui-control="input"]')).toHaveAttribute(
			'data-sui-variant',
			'success'
		);
		expect(container.querySelector('[data-sui-control="input"]')?.className).toContain('green');
	});

	it('renders start and end icons inside the control', () => {
		const { container } = render(SuiInput, { startIcon: MailIcon, endIcon: LockIcon });
		expect(
			container.querySelector('[data-sui-control="input"]')?.querySelectorAll('svg').length
		).toBe(2);
	});

	it('renders the action snippet at the end', () => {
		render(InputHarness, { withAction: true });
		expect(screen.getByRole('button', { name: 'Toggle visibility' })).toBeInTheDocument();
	});

	it('keeps the hint visible (and associated) when validation errors appear', async () => {
		const { container } = render(InputHarness, {
			schema: z.string().min(5, 'Too short'),
			validateDebounce: 0,
			subText: 'We will never share your email.'
		});
		// hint renders in its own (id-carrying) element from the start
		expect(container.querySelector('[data-sui-field-hint]')).toHaveTextContent(
			'We will never share your email.'
		);
		// no message region content while valid
		expect(container.querySelector('[data-sui-field-message]')).toBeNull();

		const input = screen.getByLabelText('Email');
		await userEvent.type(input, 'ab');
		input.blur();
		await waitFor(() => {
			expect(container.querySelector('[data-sui-field-message]')).toHaveTextContent('Too short');
		});
		// GOV.UK pattern: the hint stays visible when the error appears —
		// errors never replace instructions
		expect(container.querySelector('[data-sui-field-hint]')).toHaveTextContent(
			'We will never share your email.'
		);
		expect(container.querySelector('[data-sui-control="input"]')).toHaveAttribute(
			'data-invalid',
			'true'
		);
	});

	it('wires aria-invalid and aria-describedby to the message', async () => {
		const { container } = render(InputHarness, { schema: z.string().min(3, 'Min 3') });
		const input = screen.getByLabelText('Email') as HTMLInputElement;
		await userEvent.type(input, 'x');
		input.blur();
		await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'));
		const describedBy = input.getAttribute('aria-describedby');
		expect(describedBy).toBeTruthy();
		expect(container.querySelector(`#${describedBy}`)).toHaveTextContent('Min 3');
	});

	it('clears errors once the value becomes valid', async () => {
		const { container } = render(InputHarness, { schema: z.string().min(3, 'Min 3') });
		const input = screen.getByLabelText('Email');
		await userEvent.type(input, 'a');
		input.blur();
		await waitFor(() => expect(container.querySelector('[data-sui-field-message]')).toBeTruthy());
		// touched now: every keystroke re-validates
		await userEvent.type(input, 'bc');
		await waitFor(() => expect(container.querySelector('[data-sui-field-message]')).toBeNull());
	});

	it('auto timing: quiet on first typing pass, validates on blur, then eager', async () => {
		const { container } = render(InputHarness, { schema: z.string().min(3, 'Min 3') });
		const input = screen.getByLabelText('Email');

		// first pass: typing alone stays quiet — no mid-answer scolding
		await userEvent.type(input, 'a');
		expect(container.querySelector('[data-sui-field-message]')).toBeNull();

		// blur validates
		input.blur();
		await waitFor(() =>
			expect(container.querySelector('[data-sui-field-message]')).toHaveTextContent('Min 3')
		);

		// touched: subsequent keystrokes update eagerly — error persists…
		await userEvent.type(input, 'b');
		await waitFor(() =>
			expect(container.querySelector('[data-sui-field-message]')).toHaveTextContent('Min 3')
		);
		// …and clears the moment the answer becomes valid
		await userEvent.type(input, 'c');
		await waitFor(() => expect(container.querySelector('[data-sui-field-message]')).toBeNull());
	});

	it('stale external errors clear when the user edits the field', async () => {
		// regression: after a failed submit, fixing a field must clear its
		// server error immediately — without waiting for another submit
		const { container } = render(InputHarness, {
			schema: z.string().min(3, 'Min 3'),
			errors: ['Name must be at least 2 characters']
		});
		await waitFor(() =>
			expect(container.querySelector('[data-sui-field-message]')).toHaveTextContent(
				'Name must be at least 2 characters'
			)
		);

		// user fixes the field → local validation takes the display back
		await userEvent.type(screen.getByLabelText('Email'), 'abc');
		await waitFor(() => expect(container.querySelector('[data-sui-field-message]')).toBeNull());
		expect(container.querySelector('[data-sui-control="input"]')).not.toHaveAttribute(
			'data-invalid'
		);
	});

	it('fresh external errors re-take the display after an edit', async () => {
		const { rerender } = render(InputHarness, {
			schema: z.string().min(3, 'Min 3'),
			errors: ['Taken']
		});
		await userEvent.type(screen.getByLabelText('Email'), 'abc'); // edited → local valid
		await waitFor(() => expect(screen.queryByText('Taken')).toBeNull());

		// a NEW submit produces a NEW errors array → shown again
		await rerender({ schema: z.string().min(3, 'Min 3'), errors: ['Still taken'] });
		await waitFor(() => expect(screen.getByText('Still taken')).toBeInTheDocument());
	});

	it('debounces validation when validateDebounce is set', async () => {
		vi.useFakeTimers();
		try {
			const { container } = render(InputHarness, {
				schema: z.string().min(3, 'Min 3'),
				validateOn: 'change',
				validateDebounce: 200
			});
			const input = screen.getByLabelText('Email');
			await userEvent.type(input, 'a', { delay: null });
			expect(container.querySelector('[data-sui-field-message]')).toBeNull();
			vi.advanceTimersByTime(250);
			await vi.waitFor(() =>
				expect(container.querySelector('[data-sui-field-message]')).toHaveTextContent('Min 3')
			);
		} finally {
			vi.useRealTimers();
		}
	});

	it('supports external errors (server-side messages)', () => {
		const { container } = render(SuiInput, { label: 'X', errors: ['Already taken'] });
		expect(container.querySelector('[data-sui-field-message]')).toHaveTextContent('Already taken');
		expect(container.querySelector('[data-sui-control="input"]')).toHaveAttribute(
			'data-invalid',
			'true'
		);
	});

	it('binds value two-way', async () => {
		const { container } = render(InputHarness, {});
		const input = screen.getByLabelText('Email') as HTMLInputElement;
		await userEvent.type(input, 'hello');
		expect(input.value).toBe('hello');
	});

	it('disables the input', () => {
		render(SuiInput, { label: 'X', disabled: true });
		expect(screen.getByLabelText('X')).toBeDisabled();
	});
});

describe('SuiTextarea', () => {
	it('renders label + placeholder + rows', () => {
		render(SuiTextarea, { label: 'Bio', placeholder: 'Tell us…', rows: 5 });
		expect(screen.getByLabelText('Bio')).toHaveAttribute('rows', '5');
	});

	it('wraps the textarea in a box that grows with rows, not a fixed one-line height', () => {
		const { container } = render(SuiTextarea, { label: 'Bio', rows: 4 });
		const wrapper = container.querySelector('[data-sui-control="textarea"]') as HTMLElement;
		const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
		// no fixed control height on the wrapper — the textarea's rows drive it
		expect(wrapper.className).not.toMatch(/\bh-\d\b/);
		// the inner textarea owns the horizontal padding (no double padding)
		expect(wrapper.className).not.toMatch(/\bpx-\d\b/);
		expect(textarea.className).toMatch(/\bpx-3\b/);
		expect(textarea.rows).toBe(4);
	});

	it('validates with zod and shows the message', async () => {
		const { container } = render(SuiTextarea, {
			label: 'Bio',
			schema: z.string().max(4, 'Max 4 characters')
		});
		const textarea = screen.getByLabelText('Bio') as HTMLTextAreaElement;
		await userEvent.type(textarea, 'way too long');
		textarea.blur();
		await waitFor(() =>
			expect(container.querySelector('[data-sui-field-message]')).toHaveTextContent(
				'Max 4 characters'
			)
		);
	});
});

describe('skeletons', () => {
	it('input skeleton matches control height and renders label row optionally', () => {
		const without = render(SuiInputSkeleton, { size: 'md', label: false });
		expect(without.container.querySelectorAll('[data-sui-skeleton="label"]').length).toBe(0);
		const withLabel = render(SuiInputSkeleton, { size: 'md', label: true });
		expect(withLabel.container.querySelector('[data-sui-skeleton="label"]')).toBeInTheDocument();
		expect(withLabel.container.querySelector('[data-sui-skeleton="input"]')?.className).toMatch(
			/\bh-9\b/
		);
	});

	it('textarea skeleton approximates row height', () => {
		const { container } = render(SuiTextareaSkeleton, { rows: 4 });
		expect(
			container.querySelector('[data-sui-skeleton="textarea"]')?.getAttribute('style')
		).toContain('height: 7rem');
	});
});
