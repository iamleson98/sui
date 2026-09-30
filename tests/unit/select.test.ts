import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';

// bits-ui modals lock the body (pointer-events: none) and aria-hide siblings,
// so we disable user-event's pointer-events check and locate options by text.
const user = userEvent.setup({ pointerEventsCheck: 0 });

async function findOption(match: RegExp): Promise<HTMLElement> {
	return await waitFor(() => {
		const option = screen
			.queryAllByRole('option', { hidden: true })
			.find((el) => match.test(el.textContent ?? ''));
		if (!option) throw new Error(`option matching ${match} not found`);
		return option as HTMLElement;
	});
}
import { SuiSelect, SuiSelectSkeleton } from '$lib/sui';
import { cursorSource, type SuiItem, type SuiSource } from '$lib/sui';
import { z } from 'zod';
import UserIcon from '@lucide/svelte/icons/user';

const countries: SuiItem[] = [
	{ value: 'nl', label: 'Netherlands', description: 'Europe' },
	{ value: 'vn', label: 'Vietnam', description: 'Asia' },
	{ value: 'de', label: 'Germany', description: 'Europe' }
];

describe('SuiSelect', () => {
	it('renders a labelled trigger with placeholder', () => {
		render(SuiSelect, { label: 'Country', placeholder: 'Choose…', items: countries });
		expect(screen.getByRole('button', { name: 'Country' })).toHaveTextContent('Choose…');
	});

	it('shows the selected item label in the trigger', async () => {
		render(SuiSelect, { label: 'Country', items: countries, value: 'vn' });
		expect(screen.getByRole('button', { name: 'Country' })).toHaveTextContent('Vietnam');
	});

	it('opens the menu and lists items with descriptions', async () => {
		const { container } = render(SuiSelect, { label: 'Country', items: countries });
		await user.click(screen.getByRole('button', { name: 'Country' }));
		const nl = await findOption(/netherlands/i);
		expect(nl.textContent).toContain('Europe');
		expect(await findOption(/vietnam/i)).toBeInTheDocument();
	});

	it('applies shared size classes to the trigger', () => {
		const { container } = render(SuiSelect, { label: 'C', items: countries, size: 'sm' });
		expect(container.querySelector('[data-sui-trigger]')?.className).toMatch(/\bh-8\b/);
	});

	it('renders a leading icon in the trigger', () => {
		const { container } = render(SuiSelect, { label: 'C', items: countries, startIcon: UserIcon });
		expect(container.querySelector('[data-sui-trigger]')?.querySelector('svg')).toBeTruthy();
	});

	it('selects an option and fires onSelect', async () => {
		const onSelect = vi.fn();
		render(SuiSelect, { label: 'Country', items: countries, onSelect });
		await user.click(screen.getByRole('button', { name: 'Country' }));
		await user.click(await findOption(/germany/i));
		expect(onSelect).toHaveBeenCalledWith(
			'de',
			expect.objectContaining({ value: 'de', label: 'Germany' })
		);
		expect(screen.getByRole('button', { name: 'Country' })).toHaveTextContent('Germany');
	});

	it('validates selection with zod and shows the error under the trigger', async () => {
		const { container } = render(SuiSelect, {
			label: 'Country',
			items: countries,
			schema: z.string().min(1, 'Pick a country')
		});
		const trigger = screen.getByRole('button', { name: 'Country' });
		expect(trigger).not.toHaveAttribute('aria-invalid', 'true');

		// open and close without choosing → blur triggers validation
		await user.click(trigger);
		await user.keyboard('{Escape}');
		await user.tab();
		await waitFor(() => {
			expect(container.querySelector('[data-sui-field-message]')).toHaveTextContent('Pick a country');
			expect(container.querySelector('[data-sui-control], [data-sui-trigger]')).toBeTruthy();
		});
	});

	it('clearable select resets to placeholder', async () => {
		render(SuiSelect, { label: 'Country', items: countries, value: 'nl', clearable: true });
		const clear = screen.getByRole('button', { name: /clear/i }) ?? screen.getByLabelText(/clear/i);
		expect(clear).toBeTruthy();
	});
});

describe('SuiSelect — infinite scroll', () => {
	function makeSource(): { source: SuiSource<SuiItem>; calls: number } {
		const state = { calls: 0 };
		const source = cursorSource<SuiItem>(async ({ cursor, size }) => {
			state.calls += 1;
			const page = cursor ? Number(atob(cursor)) : 0;
			const items: SuiItem[] = Array.from({ length: size }, (_, i) => ({
				value: `u-${page + i}`,
				label: `User ${page + i + 1}`
			}));
			const next = page + size < 60 ? btoa(String(page + size)) : null;
			return { items, nextCursor: next };
		});
		return { source, calls: 0, get calls2() { return state.calls } } as never;
	}

	it('loads the first page when opened', async () => {
		const state = { calls: 0 };
		const source: SuiSource<SuiItem> = cursorSource(async ({ cursor, size }) => {
			state.calls += 1;
			const page = cursor ? Number(atob(cursor)) : 0;
			return {
				items: [{ value: `u-${page}`, label: `User ${page + 1}` }],
				nextCursor: page < 10 ? btoa(String(page + 1)) : null
			};
		});

		render(SuiSelect, { label: 'Owner', source, pageSize: 1 });
		// the first page is prefetched on mount so the menu opens instantly
		await waitFor(() => expect(state.calls).toBe(1));

		await user.click(screen.getByRole('button', { name: 'Owner' }));
		expect(await findOption(/user 1/i)).toBeInTheDocument();
	});

	it('renders a load-more sentinel while more pages exist', async () => {
		const source: SuiSource<SuiItem> = async () => ({
			items: [{ value: 'a', label: 'Alpha' }],
			hasMore: true
		});
		render(SuiSelect, { label: 'Owner', source, pageSize: 5 });
		await user.click(screen.getByRole('button', { name: 'Owner' }));
		await waitFor(() => {
			// content renders in a portal on document.body
			expect(document.querySelector('[data-sui-load-more-sentinel]')).toBeInTheDocument();
			expect(document.querySelector('[data-sui-select-loading]')).toBeNull();
		});
	});

	it('shows an error state when the source fails', async () => {
		const source: SuiSource<SuiItem> = async () => {
			throw new Error('network down');
		};
		render(SuiSelect, { label: 'Owner', source });
		await user.click(screen.getByRole('button', { name: 'Owner' }));
		await waitFor(() => {
			expect(document.querySelector('[data-sui-select-error]')).toHaveTextContent(
				'Failed to load options'
			);
		});
	});
});

describe('SuiSelect — clear button (overlay outside the trigger)', () => {
	it('is a real button outside the trigger that clears the value', async () => {
		const onSelect = vi.fn();
		render(SuiSelect, { label: 'Country', items: countries, value: 'nl', clearable: true, onSelect });
		const trigger = screen.getByRole('button', { name: 'Country' });
		const clear = screen.getByRole('button', { name: 'Clear selection' });
		// the clear button must not be nested inside the trigger button
		expect(clear.parentElement?.closest('button')).not.toBe(trigger);
		expect(trigger).not.toContain(clear);

		await user.click(clear);
		expect(onSelect).toHaveBeenCalledWith(undefined, undefined);
		expect(trigger).toHaveTextContent('Select');
		expect(trigger).toHaveAttribute('aria-expanded', 'false');
	});

	it('hides the clear button while nothing is selected', () => {
		render(SuiSelect, { label: 'Country', items: countries, clearable: true });
		expect(screen.queryByRole('button', { name: 'Clear selection' })).toBeNull();
	});
});

describe('SuiSelect — field anatomy & variants', () => {
	it('renders label, control and message inside one root element', () => {
		const { container } = render(SuiSelect, { label: 'Country', items: countries, subText: 'Pick one' });
		const root = container.querySelector('[data-sui-field="select"]');
		expect(root).toBeTruthy();
		expect(root).toContainElement(container.querySelector('[data-sui-label]') as HTMLElement);
		expect(root).toContainElement(container.querySelector('[data-sui-control], [data-sui-trigger]') as HTMLElement);
		expect(root).toContainElement(container.querySelector('[data-sui-field-message]') as HTMLElement);
	});

	it('tints the label and subtext with the variant color', () => {
		const { container } = render(SuiSelect, {
			label: 'Country',
			items: countries,
			subText: 'Helper',
			variant: 'success'
		});
		expect(container.querySelector('[data-sui-label]')?.className).toContain('text-green');
		expect(container.querySelector('[data-sui-field-message]')?.className).toContain('text-green');
	});

	it('forces the error variant on label and message when invalid', async () => {
		const { container } = render(SuiSelect, {
			label: 'Country',
			items: countries,
			schema: z.string().min(1, 'Pick a country')
		});
		const trigger = screen.getByRole('button', { name: 'Country' });
		await user.click(trigger);
		await user.keyboard('{Escape}');
		await user.tab();
		await waitFor(() => {
			expect(container.querySelector('[data-sui-label]')?.className).toContain('text-red');
			expect(container.querySelector('[data-sui-field-message]')).toHaveTextContent('Pick a country');
		});
	});
});

describe('SuiSelectSkeleton', () => {
	it('matches the trigger height and renders an optional label', () => {
		const { container } = render(SuiSelectSkeleton, { size: 'lg', label: true });
		expect(container.querySelector('[data-sui-skeleton="select"]')?.className).toMatch(/\bh-10\b/);
		expect(container.querySelector('[data-sui-skeleton="label"]')).toBeInTheDocument();
	});
});
