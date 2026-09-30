import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { SuiMultiSelect, SuiMultiSelectSkeleton } from '$lib/sui';
import { offsetSource, type SuiItem, type SuiSource } from '$lib/sui';
import { z } from 'zod';

const tags: SuiItem[] = [
	{ value: 'bug', label: 'Bug' },
	{ value: 'feature', label: 'Feature' },
	{ value: 'docs', label: 'Docs' },
	{ value: 'infra', label: 'Infra' },
	{ value: 'design', label: 'Design' }
];

const user = userEvent.setup({ pointerEventsCheck: 0 });

async function findItem(match: RegExp): Promise<HTMLElement> {
	return await waitFor(() => {
		const item = Array.from(document.querySelectorAll('[data-sui-option]')).find((el) =>
			match.test((el.textContent ?? '').trim())
		);
		if (!item) throw new Error(`item matching ${match} not found`);
		return item as HTMLElement;
	});
}

describe('SuiMultiSelect', () => {
	it('renders a labelled trigger with placeholder', () => {
		render(SuiMultiSelect, { label: 'Tags', placeholder: 'Pick tags…', items: tags });
		expect(screen.getByRole('button', { name: /tags/i })).toHaveTextContent('Pick tags…');
	});

	it('renders selected values as badges', () => {
		render(SuiMultiSelect, { label: 'Tags', items: tags, value: ['bug', 'docs'] });
		const badges = document.querySelectorAll('[data-sui-badge]');
		expect(badges.length).toBe(2);
		expect(badges[0]?.textContent).toContain('Bug');
	});

	it('collapses overflow beyond maxDisplay into +n', () => {
		render(SuiMultiSelect, {
			label: 'Tags',
			items: tags,
			value: ['bug', 'docs', 'infra', 'design'],
			maxDisplay: 2
		});
		expect(document.querySelectorAll('[data-sui-badge]').length).toBe(3); // 2 + overflow
		expect(document.querySelector('[data-sui-badge-overflow]')?.textContent).toContain('+2');
	});

	it('falls back to the raw value for labels not in items', () => {
		render(SuiMultiSelect, { label: 'Tags', items: tags, value: ['ghost-value'] });
		expect(document.querySelector('[data-sui-badge]')?.textContent).toContain('ghost-value');
	});

	it('toggles items in the dropdown and keeps badges in sync', async () => {
		const onSelect = vi.fn();
		render(SuiMultiSelect, { label: 'Tags', items: tags, onSelect });
		await user.click(screen.getByRole('button', { name: /tags/i }));
		await user.click(await findItem(/^bug/i));
		expect(document.querySelector('[data-sui-badge]')?.textContent).toContain('Bug');
		expect(onSelect).toHaveBeenCalledWith(['bug'], [expect.objectContaining({ value: 'bug' })]);

		await user.click(await findItem(/^feature/i));
		expect(document.querySelectorAll('[data-sui-badge]').length).toBe(2);

		// clicking again deselects
		await user.click(await findItem(/^bug/i));
		expect(document.querySelectorAll('[data-sui-badge]').length).toBe(1);
	});

	it('removes a badge via its remove button', async () => {
		render(SuiMultiSelect, { label: 'Tags', items: tags, value: ['bug', 'docs'] });
		const remove = document.querySelector('[data-sui-badge-remove]') as HTMLElement;
		await user.click(remove);
		const badges = document.querySelectorAll('[data-sui-badge]');
		expect(badges.length).toBe(1);
		expect(badges[0]?.textContent).toContain('Docs');
	});

	it('clearAll wipes the selection', async () => {
		render(SuiMultiSelect, { label: 'Tags', items: tags, value: ['bug'], clearable: true });
		await user.click(document.querySelector('[data-sui-clear]') as HTMLElement);
		expect(document.querySelectorAll('[data-sui-badge]').length).toBe(0);
	});

	it('validates a min-selection schema', async () => {
		const { container } = render(SuiMultiSelect, {
			label: 'Tags',
			items: tags,
			schema: z.array(z.string()).min(1, 'Select at least one topic')
		});
		await user.click(screen.getByRole('button', { name: /tags/i }));
		await user.click(await findItem(/^bug/i));
		await user.click(await findItem(/^bug/i)); // deselect → invalid
		await waitFor(() => {
			expect(container.querySelector('[data-sui-field-message]')).toHaveTextContent(
				'Select at least one topic'
			);
		});
	});
});

describe('SuiMultiSelect — infinite scroll', () => {
	it('streams offset pages and dedupes', async () => {
		const state = { calls: 0 };
		const source: SuiSource<SuiItem> = offsetSource(async ({ page }) => {
			state.calls += 1;
			return {
				items: [
					{ value: `p${page}`, label: `Product ${page + 1}` },
					// duplicate across pages to prove client-side dedupe
					...(page > 0 ? ([{ value: 'p0', label: 'Product 1' }] as SuiItem[]) : [])
				],
				hasMore: page < 1
			};
		});

		render(SuiMultiSelect, { label: 'Products', source, pageSize: 1 });
		await waitFor(() => expect(state.calls).toBe(1));
		expect(document.querySelector('[data-sui-badge]')).toBeNull(); // nothing selected yet

		await user.click(screen.getByRole('button', { name: /products/i }));
		expect(await findItem(/product 1/i)).toBeInTheDocument();
		expect(document.querySelector('[data-sui-load-more-sentinel]')).toBeInTheDocument();
	});
});

describe('SuiMultiSelectSkeleton', () => {
	it('renders trigger + badge skeletons', () => {
		const { container } = render(SuiMultiSelectSkeleton, { size: 'md', label: true, badges: 2 });
		expect(container.querySelector('[data-sui-skeleton="multi-select"]')?.className).toMatch(/\bh-9\b/);
		expect(container.querySelectorAll('[data-sui-skeleton="badge"]').length).toBe(2);
	});
});
