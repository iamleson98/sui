import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { SuiCombobox, SuiMultiSelect, suiFilter, suiFold } from '$lib/sui';
import type { SuiItem, SuiSource } from '$lib/sui';

const user = userEvent.setup({ pointerEventsCheck: 0 });

const options = (): HTMLElement[] =>
	Array.from(document.querySelectorAll<HTMLElement>('[data-sui-option]'));

/** A server list: ten pages of two, the item asked for never on page one. */
const people: SuiItem[] = Array.from({ length: 20 }, (_, i) => ({
	value: `u${i}`,
	label: `Person ${i}`
}));
const source: SuiSource<SuiItem> = async ({ page, size, query }) => {
	const matching = people.filter((p) => p.label.toLowerCase().includes(query.toLowerCase()));
	const items = matching.slice(page * size, (page + 1) * size);
	return { items, hasMore: (page + 1) * size < matching.length, total: matching.length };
};

describe('accent-insensitive search', () => {
	it('folds accents, đ and case', () => {
		expect(suiFold('Đại Số Tuyến Tính')).toBe('dai so tuyen tinh');
		expect(suiFold('ÉCOLE')).toBe('ecole');
	});

	it('scores every word, hiding what misses one', () => {
		expect(suiFilter('x', 'toan', ['Toán học'])).toBeGreaterThan(0);
		expect(suiFilter('x', 'dai so', ['Đại số'])).toBeGreaterThan(0);
		expect(suiFilter('x', 'toan hoc', ['Toán học'])).toBeGreaterThan(0);
		expect(suiFilter('x', 'toan ly', ['Toán học'])).toBe(0);
		expect(suiFilter('x', '', ['anything'])).toBe(1);
	});

	it('ranks the start of a word above the middle of one', () => {
		expect(suiFilter('x', 'an', ['Anh văn'])).toBeGreaterThan(suiFilter('x', 'an', ['Toán']));
	});

	it('finds Vietnamese labels typed without accents in a combobox', async () => {
		render(SuiCombobox, {
			label: 'Subject',
			items: [
				{ value: 'math', label: 'Toán học' },
				{ value: 'lit', label: 'Ngữ văn' }
			]
		});
		await user.click(screen.getByRole('combobox', { name: /subject/i }));
		await user.type(
			document.querySelector('[data-sui-combobox-input]') as HTMLInputElement,
			'toan'
		);
		await waitFor(() => {
			expect(options().map((o) => o.textContent)).toEqual([expect.stringContaining('Toán học')]);
		});
	});
});

describe('a selection the loaded pages do not hold', () => {
	it('labels the trigger through resolve, asking once', async () => {
		const resolve = vi.fn(async (value: string) => ({ value, label: 'Person 17' }));
		render(SuiCombobox, { label: 'Owner', source, pageSize: 2, value: 'u17', resolve });
		await waitFor(() =>
			expect(screen.getByRole('combobox', { name: /owner/i })).toHaveTextContent('Person 17')
		);
		expect(resolve).toHaveBeenCalledTimes(1);
		expect(resolve).toHaveBeenCalledWith('u17');
	});

	it('does not ask when the value is already known', async () => {
		const resolve = vi.fn();
		render(SuiCombobox, {
			label: 'Owner',
			source,
			pageSize: 2,
			value: 'u17',
			selectedItem: { value: 'u17', label: 'Person 17' },
			resolve
		});
		expect(screen.getByRole('combobox', { name: /owner/i })).toHaveTextContent('Person 17');
		expect(resolve).not.toHaveBeenCalled();
	});

	it('falls back to the raw value when the lookup fails', async () => {
		const resolve = vi.fn().mockRejectedValue(new Error('gone'));
		render(SuiCombobox, { label: 'Owner', source, pageSize: 2, value: 'u9', resolve });
		await waitFor(() => expect(resolve).toHaveBeenCalled());
		expect(screen.getByRole('combobox', { name: /owner/i })).toHaveTextContent('u9');
	});

	it('pins the selection on top of the unfiltered list, checked', async () => {
		render(SuiCombobox, {
			label: 'Owner',
			source,
			pageSize: 2,
			value: 'u17',
			selectedItem: { value: 'u17', label: 'Person 17' }
		});
		await user.click(screen.getByRole('combobox', { name: /owner/i }));
		await waitFor(() => expect(options().length).toBeGreaterThan(1));
		const [first] = options();
		expect(first).toHaveTextContent('Person 17');
		expect(options().map((o) => o.textContent)).toEqual(
			expect.arrayContaining([expect.stringContaining('Person 0')])
		);
	});

	it('does not pin it above search results', async () => {
		render(SuiCombobox, {
			label: 'Owner',
			source,
			pageSize: 2,
			value: 'u17',
			selectedItem: { value: 'u17', label: 'Person 17' }
		});
		await user.click(screen.getByRole('combobox', { name: /owner/i }));
		await user.type(
			document.querySelector('[data-sui-combobox-input]') as HTMLInputElement,
			'Person 3'
		);
		await waitFor(() => {
			const labels = options().map((o) => o.textContent ?? '');
			expect(labels.length).toBeGreaterThan(0);
			expect(labels.some((l) => l.includes('Person 17'))).toBe(false);
		});
	});

	it('labels the chips of a multi-select through resolve', async () => {
		const resolve = vi.fn(async (value: string) => ({ value, label: `Resolved ${value}` }));
		render(SuiMultiSelect, { label: 'Team', source, pageSize: 2, value: ['u15', 'u16'], resolve });
		await waitFor(() => {
			const text = document.body.textContent ?? '';
			expect(text).toContain('Resolved u15');
			expect(text).toContain('Resolved u16');
		});
		expect(resolve).toHaveBeenCalledTimes(2);
	});
});
