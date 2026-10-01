import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { SuiErrorSummary } from '$lib/sui';

const user = userEvent.setup({ pointerEventsCheck: 0 });

describe('SuiErrorSummary', () => {
	it('renders nothing when there are no errors', () => {
		const { container } = render(SuiErrorSummary, { errors: [] });
		expect(container.querySelector('[data-sui-error-summary]')).toBeNull();
	});

	it('lists every field error as a link inside a live region', () => {
		render(SuiErrorSummary, {
			errors: [
				{ fieldId: 'name', message: 'Name is required' },
				{ fieldId: 'email', message: 'Email is not valid' }
			]
		});
		const box = screen.getByRole('alert');
		expect(box).toHaveAttribute('id', 'sui-error-summary');
		const links = screen.getAllByRole('link');
		expect(links).toHaveLength(2);
		expect(links[0]).toHaveTextContent('Name is required');
		expect(links[0]).toHaveAttribute('href', '#name');
	});

	it('activating a link focuses that field without navigating', async () => {
		const input = document.createElement('input');
		input.id = 'name-input';
		document.body.append(input);

		render(SuiErrorSummary, {
			errors: [{ fieldId: 'name-input', message: 'Name is required' }]
		});
		await user.click(screen.getByRole('link'));

		expect(document.activeElement).toBe(input);
		// preventDefault keeps the hash out of the URL
		expect(window.location.hash).toBe('');
		input.remove();
	});

	it('supports a custom title and id', () => {
		render(SuiErrorSummary, {
			errors: [{ fieldId: 'x', message: 'Broken' }],
			title: 'Fix these:',
			id: 'form-errors'
		});
		expect(screen.getByText('Fix these:')).toBeInTheDocument();
		expect(screen.getByRole('alert')).toHaveAttribute('id', 'form-errors');
	});
});
