import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { SuiCombobox, SuiComboboxSkeleton } from '$lib/sui';
import { cursorSource, type SuiItem, type SuiSource } from '$lib/sui';
import { z } from 'zod';

const countries: SuiItem[] = [
	{ value: 'nl', label: 'Netherlands' },
	{ value: 'vn', label: 'Vietnam' },
	{ value: 'de', label: 'Germany' }
];

// bits-ui modals lock the body; disable the pointer-events check.
const user = userEvent.setup({ pointerEventsCheck: 0 });

async function findCommandItem(match: RegExp): Promise<HTMLElement> {
	return await waitFor(() => {
		const item = Array.from(document.querySelectorAll('[data-sui-option]')).find((el) =>
			match.test(el.textContent ?? '')
		);
		if (!item) throw new Error(`command item matching ${match} not found`);
		return item as HTMLElement;
	});
}

describe('SuiCombobox', () => {
	it('renders a labelled trigger with placeholder', () => {
		render(SuiCombobox, { label: 'Owner', placeholder: 'Search users…', items: countries });
		expect(screen.getByRole('button', { name: /owner/i })).toHaveTextContent('Search users…');
	});

	it('shows the selected label in the trigger', () => {
		render(SuiCombobox, { label: 'Owner', items: countries, value: 'de' });
		expect(screen.getByRole('button', { name: /owner/i })).toHaveTextContent('Germany');
	});

	it('opens a searchable command palette with all items', async () => {
		render(SuiCombobox, { label: 'Owner', items: countries });
		await user.click(screen.getByRole('button', { name: /owner/i }));
		expect(await findCommandItem(/netherlands/i)).toBeInTheDocument();
		expect(await findCommandItem(/vietnam/i)).toBeInTheDocument();
		expect(document.querySelector('[data-sui-combobox-input]')).toBeInTheDocument();
	});

	it('filters locally as you type', async () => {
		render(SuiCombobox, { label: 'Owner', items: countries });
		await user.click(screen.getByRole('button', { name: /owner/i }));
		const input = document.querySelector('[data-sui-combobox-input]') as HTMLInputElement;

		// matches keywords (labels), not just values
		await user.type(input, 'viet');
		await waitFor(() => {
			const visible = Array.from(document.querySelectorAll('[data-sui-option]'));
			expect(visible.length).toBe(1);
			expect(visible[0]?.textContent).toContain('Vietnam');
		});

		// no match → empty state
		await user.type(input, 'zzz');
		await waitFor(() => {
			expect(document.querySelector('[data-sui-combobox-empty]')).toBeInTheDocument();
		});
	});

	it('selects an item, closes, and updates the trigger', async () => {
		const onSelect = vi.fn();
		render(SuiCombobox, { label: 'Owner', items: countries, onSelect });
		await user.click(screen.getByRole('button', { name: /owner/i }));
		await user.click(await findCommandItem(/germany/i));
		expect(onSelect).toHaveBeenCalledWith('de', expect.objectContaining({ value: 'de' }));
		expect(screen.getByRole('button', { name: /owner/i })).toHaveTextContent('Germany');
	});

	it('validates with zod', async () => {
		const { container } = render(SuiCombobox, {
			label: 'Owner',
			items: countries,
			schema: z.string().min(1, 'Pick an owner')
		});
		const trigger = screen.getByRole('button', { name: /owner/i });
		await user.click(trigger);
		await user.keyboard('{Escape}');
		await waitFor(() => {
			expect(container.querySelector('[data-sui-field-message]')).toHaveTextContent('Pick an owner');
			expect(trigger).toHaveAttribute('aria-invalid', 'true');
		});
	});
});

describe('SuiCombobox — clear & semantics', () => {
	it('clears via an overlay button outside the trigger', async () => {
		const onSelect = vi.fn();
		render(SuiCombobox, { label: 'Owner', items: countries, value: 'de', clearable: true, onSelect });
		const trigger = screen.getByRole('button', { name: /owner/i });
		const clear = screen.getByRole('button', { name: 'Clear selection' });
		expect(clear.parentElement?.closest('button')).not.toBe(trigger);

		await user.click(clear);
		expect(onSelect).toHaveBeenCalledWith(undefined, undefined);
		expect(trigger).toHaveTextContent('Select');
	});

	it('announces a listbox popup and points aria-controls at it', async () => {
		render(SuiCombobox, { label: 'Owner', items: countries });
		const trigger = screen.getByRole('button', { name: /owner/i });
		expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
		const listboxId = trigger.getAttribute('aria-controls');
		expect(listboxId).toBeTruthy();
		await user.click(trigger);
		await waitFor(() => {
			expect(document.getElementById(listboxId!)).toBeTruthy();
			expect(document.getElementById(listboxId!)).toHaveAttribute('role', 'listbox');
		});
	});
});

describe('SuiCombobox — server sources', () => {
	it('prefetches the first page and streams more via sentinel', async () => {
		const state = { calls: 0, query: '' };
		const source: SuiSource<SuiItem> = cursorSource(async ({ cursor, size, query }) => {
			state.calls += 1;
			state.query = query;
			const page = cursor ? Number(atob(cursor)) : 0;
			return {
				items: [{ value: `u-${page}`, label: `User ${page + 1}` }],
				nextCursor: page < 3 ? btoa(String(page + 1)) : null
			};
		});

		render(SuiCombobox, { label: 'Owner', source, pageSize: 1 });
		await waitFor(() => expect(state.calls).toBe(1));

		await user.click(screen.getByRole('button', { name: /owner/i }));
		expect(await findCommandItem(/user 1/i)).toBeInTheDocument();
		expect(document.querySelector('[data-sui-load-more-sentinel]')).toBeInTheDocument();
	});

	it('debounces server search and resets the list', async () => {
		const queries: string[] = [];
		const source: SuiSource<SuiItem> = cursorSource(async ({ query }) => {
			queries.push(query);
			return {
				items: [{ value: `q-${query}`, label: `Result for "${query}"` }],
				nextCursor: null
			};
		});

		render(SuiCombobox, { label: 'Owner', source, searchDebounce: 10 });
		await user.click(screen.getByRole('button', { name: /owner/i }));
		await waitFor(() => expect(queries.length).toBeGreaterThanOrEqual(1));

		const input = document.querySelector('[data-sui-combobox-input]') as HTMLInputElement;
		await user.type(input, 'mi');
		await waitFor(() => {
			expect(queries.some((q) => q === 'mi')).toBe(true);
		});
		// search reset the list to only the new result
		expect(await findCommandItem(/result for "mi"/i)).toBeInTheDocument();
	});
});

describe('SuiComboboxSkeleton', () => {
	it('matches trigger height with optional label', () => {
		const { container } = render(SuiComboboxSkeleton, { size: 'md', label: true });
		expect(container.querySelector('[data-sui-skeleton="combobox"]')?.className).toMatch(/\bh-9\b/);
		expect(container.querySelector('[data-sui-skeleton="label"]')).toBeInTheDocument();
	});
});
