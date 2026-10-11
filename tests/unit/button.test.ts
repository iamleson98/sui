import { describe, expect, it, vi } from 'vitest';
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

	it('shows a spinner and blocks activation while loading — without dropping focus', async () => {
		const onclick = vi.fn();
		render(ButtonHarness, { label: 'Save', loading: true, onclick });
		const button = screen.getByRole('button', { name: /save/i });
		expect(button).toHaveAttribute('aria-busy', 'true');
		expect(button).toHaveAttribute('aria-disabled', 'true');
		// `disabled` would blur a focused button (focus falls to <body>)
		expect(button).not.toBeDisabled();
		expect(button.querySelector('.animate-spin')).toBeTruthy();

		button.focus();
		await userEvent.keyboard('{Enter}');
		expect(onclick).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(button);
	});

	it('a loading submit button does not submit its form again', async () => {
		const onsubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
		const form = document.createElement('form');
		form.addEventListener('submit', onsubmit);
		document.body.append(form);
		render(SuiButton, { target: form, props: { type: 'submit', loading: true } });
		await userEvent.click(form.querySelector('button')!);
		expect(onsubmit).not.toHaveBeenCalled();
		form.remove();
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

describe('button colors', () => {
	it('semantic colors tint every variant through CSS tokens', () => {
		const { container } = render(SuiButton, { color: 'success', variant: 'outline' });
		const button = container.querySelector('button')!;
		expect(button).toHaveAttribute('data-sui-color', 'success');
		expect(button.className).toContain('[--sui-btn:var(--color-green-700)]');
		// the outline tone reads the derived tokens instead of the neutral border
		expect(button.className).toContain('border-(--sui-btn-line)');
		expect(button.className).not.toMatch(/(^|\s)border-border(\s|$)/);
	});

	it('accepts any CSS color for brand buttons', () => {
		const { container } = render(SuiButton, { color: '#7c3aed' });
		const button = container.querySelector('button')!;
		expect(button).toHaveAttribute('data-sui-color', 'custom');
		expect(button.getAttribute('style')).toMatch(/--sui-btn:\s*#7c3aed/);
		expect(button.className).toContain('bg-(--sui-btn)');
	});

	it('keeps a consumer style next to the color token', () => {
		const { container } = render(SuiButton, {
			color: 'var(--brand)',
			style: '--sui-btn-fg: black'
		});
		const style = container.querySelector('button')!.getAttribute('style') ?? '';
		expect(style).toMatch(/--sui-btn:\s*var\(--brand\)/);
		expect(style).toMatch(/--sui-btn-fg:\s*black/);
	});

	it('leaves the destructive variant (red by definition) and the default look untouched', () => {
		const destructive = render(SuiButton, { color: 'info', variant: 'destructive' });
		expect(destructive.container.querySelector('button')!.className).not.toContain('--sui-btn');
		const plain = render(SuiButton, {});
		expect(plain.container.querySelector('button')).not.toHaveAttribute('data-sui-color');
	});

	it('icon buttons take the same palette', () => {
		render(SuiIconButton, {
			icon: TrashIcon,
			label: 'Delete',
			color: 'error',
			variant: 'secondary'
		});
		const button = screen.getByRole('button', { name: 'Delete' });
		expect(button).toHaveAttribute('data-sui-color', 'error');
		expect(button.className).toContain('bg-(--sui-btn-tint)');
	});
});

describe('SuiButton ↔ SuiIconButton parity', () => {
	it('share one height per size (icon buttons are square)', () => {
		const heights = { xs: '6', sm: '8', md: '9', lg: '10', xl: '12' } as const;
		for (const [size, n] of Object.entries(heights) as [keyof typeof heights, string][]) {
			const button = render(SuiButton, { size }).container.querySelector('button')!;
			const icon = render(SuiIconButton, {
				icon: SearchIcon,
				label: `s-${size}`,
				size
			}).container.querySelector('button')!;
			expect(button.className).toMatch(new RegExp(`(^|\\s)h-${n}(\\s|$)`));
			expect(icon.className).toMatch(new RegExp(`(^|\\s)size-${n}(\\s|$)`));
		}
	});

	it('icon buttons support the link variant and href', () => {
		render(SuiIconButton, { icon: SearchIcon, label: 'Open docs', href: '/docs', variant: 'link' });
		const link = screen.getByRole('link', { name: 'Open docs' });
		expect(link).toHaveAttribute('href', '/docs');
		expect(link).not.toHaveAttribute('type');
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
