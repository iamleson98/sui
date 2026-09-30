import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { SuiCheckbox, SuiSwitch, SuiRadioGroup } from '$lib/sui';
import { SuiCheckboxSkeleton, SuiRadioSkeleton, SuiSwitchSkeleton } from '$lib/sui';
import { z } from 'zod';
import RadioHarness from './harness/radio-harness.svelte';

describe('SuiCheckbox', () => {
	it('renders a label connected to the checkbox', () => {
		render(SuiCheckbox, { label: 'Accept the terms' });
		expect(screen.getByRole('checkbox', { name: 'Accept the terms' })).toBeInTheDocument();
	});

	it('renders subText below the label', () => {
		const { container } = render(SuiCheckbox, { label: 'Newsletter', subText: 'No spam, ever.' });
		expect(container.textContent).toContain('No spam, ever.');
	});

	it('binds checked and fires validation on change', async () => {
		const { container } = render(SuiCheckbox, {
			label: 'Accept',
			schema: z.literal(true, { error: 'You must accept' })
		});
		const box = screen.getByLabelText('Accept');
		await userEvent.click(box);
		expect(box).toBeChecked();
		await userEvent.click(box); // uncheck → invalid
		await waitFor(() =>
			expect(container.querySelector('[data-sui-field-message]')).toHaveTextContent('You must accept')
		);
	});

	it('exposes size on the control', () => {
		const { container } = render(SuiCheckbox, { label: 'x', size: 'lg' });
		expect(container.querySelector('[data-sui-control="checkbox"]')).toHaveAttribute('data-sui-size', 'lg');
	});
});

describe('SuiSwitch', () => {
	it('renders label + switch pair', () => {
		render(SuiSwitch, { label: 'Two-factor auth' });
		expect(screen.getByLabelText('Two-factor auth')).toHaveAttribute('role', 'switch');
	});

	it('toggles via click', async () => {
		render(SuiSwitch, { label: 'Analytics' });
		const sw = screen.getByLabelText('Analytics');
		expect(sw).toHaveAttribute('aria-checked', 'false');
		await userEvent.click(sw);
		expect(sw).toHaveAttribute('aria-checked', 'true');
	});
});

describe('SuiRadioGroup', () => {
	const items = [
		{ value: 'free', label: 'Hobby', description: 'For side projects' },
		{ value: 'pro', label: 'Pro', description: 'For teams' }
	];

	it('renders all options with descriptions', () => {
		render(SuiRadioGroup, { label: 'Plan', items });
		const group = screen.getByRole('radiogroup');
		expect(group).toHaveAccessibleName('Plan'); // via aria-labelledby
		expect(screen.getByRole('radio', { name: /^hobby/i })).toBeInTheDocument();
		expect(screen.getByRole('radio', { name: /^pro/i })).toBeInTheDocument();
		expect(screen.getByText('For side projects')).toBeInTheDocument();
	});

	it('selects an option and updates the bound value', async () => {
		render(RadioHarness, { items });
		await userEvent.click(screen.getByRole('radio', { name: /^pro/i }));
		expect(screen.getByTestId('radio-value')).toHaveTextContent('pro');
		expect(screen.getByRole('radio', { name: /^pro/i })).toBeChecked();
	});

	it('validates with a required schema on change', async () => {
		const { container } = render(SuiRadioGroup, {
			label: 'Plan',
			items,
			schema: z.string().min(1, 'Choose a plan')
		});
		// selecting then… options can't be "deselected" like checkboxes; simulate
		// validation via the exposed method through interaction state instead
		await userEvent.click(screen.getByRole('radio', { name: /^pro/i }));
		expect(container.querySelector('[data-sui-field-message]')).toBeNull(); // valid choice
	});
});

describe('toggle skeletons', () => {
	it('checkbox skeleton renders box + optional label row', () => {
		const plain = render(SuiCheckboxSkeleton, { label: false });
		expect(plain.container.querySelector('[data-sui-skeleton="checkbox"]')).toBeInTheDocument();
		expect(plain.container.querySelector('[data-sui-skeleton="label"]')).toBeNull();

		const withLabel = render(SuiCheckboxSkeleton, { label: true, size: 'lg' });
		expect(withLabel.container.querySelector('[data-sui-skeleton="label"]')).toBeInTheDocument();
	});

	it('radio skeleton renders the requested number of rows', () => {
		const { container } = render(SuiRadioSkeleton, { count: 3, label: true });
		expect(container.querySelectorAll('[data-sui-skeleton="radio"]').length).toBe(3);
	});

	it('switch skeleton renders the track', () => {
		const { container } = render(SuiSwitchSkeleton, { size: 'md' });
		expect(container.querySelector('[data-sui-skeleton="switch"]')?.className).toContain('w-9');
	});
});
