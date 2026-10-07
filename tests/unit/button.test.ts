import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { SuiButton, SuiIconButton, SuiButtonSkeleton } from '$lib/sui';
import ButtonHarness from './harness/button-harness.svelte';
import SearchIcon from '@lucide/svelte/icons/search';
import TrashIcon from '@lucide/svelte/icons/trash';

describe('SuiButton', () => {
	it('renders children', () => {
		render(ButtonHarness, { label: 'Save changes' });
		expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
	});

	it('maps variants onto shadcn button variants', () => {
		const { container } = render(ButtonHarness, { label: 'Delete', variant: 'destructive' });
		expect(container.querySelector('button')?.className).toContain('bg-destructive');
	});

	it('applies the shared size scale (heights align across the library)', () => {
		const { container: sm } = render(ButtonHarness, { label: 'sm', size: 'sm' });
		const { container: xl } = render(ButtonHarness, { label: 'xl', size: 'xl' });
		expect(sm.querySelector('button')?.className).toMatch(/\bh-8\b/);
		expect(xl.querySelector('button')?.className).toMatch(/\bh-12\b/);
	});

	it('carries the sui size data attribute', () => {
		const { container } = render(ButtonHarness, { label: 'x', size: 'lg' });
		expect(container.querySelector('button')).toHaveAttribute('data-sui-size', 'lg');
	});

	it('renders start and end icons', () => {
		render(ButtonHarness, { label: 'New project', startIcon: TrashIcon, endIcon: SearchIcon });
		const svgs = screen.getByRole('button', { name: 'New project' }).querySelectorAll('svg');
		expect(svgs.length).toBeGreaterThanOrEqual(2);
	});

	it('shows a spinner and disables while loading', () => {
		render(ButtonHarness, { label: 'Save', loading: true });
		const button = screen.getByRole('button', { name: /save/i });
		expect(button).toHaveAttribute('aria-busy', 'true');
		expect(button).toBeDisabled();
		expect(button.querySelector('.animate-spin')).toBeTruthy();
	});

	it('renders an anchor when href is provided', () => {
		render(ButtonHarness, { label: 'Docs', href: '/docs' });
		expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '/docs');
	});

	it('fires click handlers', async () => {
		let clicked = 0;
		const { container } = render(ButtonHarness, { label: 'Go', onclick: () => (clicked += 1) });
		await userEvent.click(container.querySelector('button')!);
		expect(clicked).toBe(1);
	});
});

describe('SuiIconButton', () => {
	it('renders an icon-only button with an accessible name', () => {
		render(SuiIconButton, { icon: TrashIcon, label: 'Delete row' });
		const button = screen.getByRole('button', { name: 'Delete row' });
		expect(button.querySelector('svg')).toBeTruthy();
	});

	it('is square at the control height for its size', () => {
		const { container } = render(SuiIconButton, { icon: SearchIcon, label: 'Search', size: 'lg' });
		expect(container.querySelector('button')?.className).toContain('size-10');
	});
});

describe('SuiButtonSkeleton', () => {
	it('renders with skeleton metadata and size', () => {
		const { container } = render(SuiButtonSkeleton, { size: 'md' });
		const el = container.querySelector('[data-sui-skeleton="button"]');
		expect(el).toBeInTheDocument();
		expect(el).toHaveAttribute('data-sui-size', 'md');
	});

	it('matches the button height for every size', () => {
		const expected = {
			xs: /\bh-6\b/,
			sm: /\bh-8\b/,
			md: /\bh-9\b/,
			lg: /\bh-10\b/,
			xl: /\bh-12\b/
		};
		for (const size of Object.keys(expected) as (keyof typeof expected)[]) {
			const { container } = render(SuiButtonSkeleton, { size });
			expect(container.querySelector('[data-sui-skeleton="button"]')?.className).toMatch(
				expected[size]
			);
		}
	});
});
