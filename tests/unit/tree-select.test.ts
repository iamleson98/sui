import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { SuiTreeSelect, SuiTreeSelectSkeleton, type SuiTreeItem } from '$lib/sui';

// bits-ui modals lock the body; disable the pointer-events check.
const user = userEvent.setup({ pointerEventsCheck: 0 });

const subjects: SuiTreeItem[] = [
	{
		value: 'math',
		label: 'Toán học',
		badge: 12,
		children: [
			{ value: 'g1', label: 'Lớp 1', badge: 5 },
			{ value: 'g2', label: 'Lớp 2', children: [{ value: 'frac', label: 'Phân số' }] }
		]
	},
	{ value: 'eng', label: 'Tiếng Anh' }
];

const trigger = () => screen.getByRole('combobox', { name: /subject/i });
// A popup of an earlier test can outlive its portal: read the newest panel only.
const panel = (): ParentNode =>
	Array.from(document.querySelectorAll('[data-sui-tree-select-panel]')).at(-1) ?? document;
const rows = (): HTMLElement[] => Array.from(panel().querySelectorAll('[data-sui-tree-row]'));
const rowLabels = () => rows().map((r) => r.querySelector('span.truncate')?.textContent);
const row = (text: RegExp): HTMLElement => {
	const found = rows().find((r) => text.test(r.textContent ?? ''));
	if (!found) throw new Error(`no row matching ${text}`);
	return found;
};
const searchBox = () => panel().querySelector('[data-sui-tree-select-input]') as HTMLInputElement;

/** Types into the search box and presses keys on it, without the focus races of a popup. */
const typeSearch = (text: string) => fireEvent.input(searchBox(), { target: { value: text } });
const press = (key: string) => fireEvent.keyDown(searchBox(), { key });

async function open(props: Record<string, unknown> = {}) {
	const view = render(SuiTreeSelect, {
		label: 'Subject',
		items: subjects,
		display: 'inline',
		...props
	});
	await user.click(trigger());
	await waitFor(() => expect(rows().length).toBeGreaterThan(0));
	return view;
}

// A popup still animating out keeps focus and its rows: close it while its
// field is mounted, so the next test starts clean.
afterEach(async () => {
	if (!document.querySelector('[data-sui-tree-select-panel]')) return;
	await user.keyboard('{Escape}');
	await waitFor(() => expect(document.querySelector('[data-sui-tree-select-panel]')).toBeNull());
});

describe('SuiTreeSelect (inline tree)', () => {
	it('renders a labelled trigger with its placeholder', () => {
		render(SuiTreeSelect, {
			label: 'Subject',
			placeholder: 'Any subject',
			items: subjects,
			display: 'inline'
		});
		expect(trigger()).toHaveTextContent('Any subject');
		expect(trigger()).toHaveAttribute('aria-haspopup', 'tree');
	});

	it('shows the chosen node with the names above it', () => {
		render(SuiTreeSelect, { label: 'Subject', items: subjects, value: 'frac' });
		expect(trigger()).toHaveTextContent('Toán học › Lớp 2 › Phân số');
	});

	it('shows just its own name when asked', () => {
		render(SuiTreeSelect, { label: 'Subject', items: subjects, value: 'frac', showPath: false });
		expect(trigger()).toHaveTextContent('Phân số');
		expect(trigger()).not.toHaveTextContent('›');
	});

	it('opens on the top level with branches closed', async () => {
		await open();
		expect(rowLabels()).toEqual(['Toán học', 'Tiếng Anh']);
		expect(screen.getByRole('tree')).toBeInTheDocument();
		expect(row(/Toán học/)).toHaveAttribute('aria-expanded', 'false');
		expect(row(/Toán học/)).toHaveAttribute('aria-level', '1');
		expect(row(/Toán học/)).toHaveTextContent('12');
	});

	it('opens the way to the chosen node', async () => {
		await open({ value: 'frac' });
		expect(rowLabels()).toEqual(['Toán học', 'Lớp 1', 'Lớp 2', 'Phân số', 'Tiếng Anh']);
		expect(row(/Phân số/)).toHaveAttribute('aria-selected', 'true');
		expect(row(/Phân số/)).toHaveAttribute('aria-level', '3');
	});

	it('opens everything on request', async () => {
		await open({ expandAll: true });
		expect(rowLabels()).toEqual(['Toán học', 'Lớp 1', 'Lớp 2', 'Phân số', 'Tiếng Anh']);
	});

	it('unfolds a branch from its chevron without choosing it', async () => {
		const onSelect = vi.fn();
		await open({ onSelect });
		await user.click(screen.getByRole('button', { name: /under Toán học/i }));
		expect(rowLabels()).toEqual(['Toán học', 'Lớp 1', 'Lớp 2', 'Tiếng Anh']);
		expect(onSelect).not.toHaveBeenCalled();
		await user.click(screen.getByRole('button', { name: /under Toán học/i }));
		expect(rowLabels()).toEqual(['Toán học', 'Tiếng Anh']);
	});

	it('chooses a branch when any node can be chosen', async () => {
		const onSelect = vi.fn();
		await open({ onSelect });
		await user.click(row(/Toán học/));
		expect(onSelect).toHaveBeenCalledWith('math', expect.objectContaining({ value: 'math' }), [
			expect.objectContaining({ value: 'math' })
		]);
		expect(trigger()).toHaveTextContent('Toán học');
	});

	it('reports the path of what was chosen', async () => {
		const onSelect = vi.fn();
		await open({ onSelect, expandAll: true });
		await user.click(row(/Phân số/));
		const path = onSelect.mock.calls[0][2].map((item: SuiTreeItem) => item.value);
		expect(path).toEqual(['math', 'g2', 'frac']);
	});

	it('only opens branches when just leaves can be chosen', async () => {
		const onSelect = vi.fn();
		await open({ selectable: 'leaf', onSelect });
		await user.click(row(/Toán học/));
		expect(onSelect).not.toHaveBeenCalled();
		expect(rowLabels()).toEqual(['Toán học', 'Lớp 1', 'Lớp 2', 'Tiếng Anh']);
		await user.click(row(/Lớp 1/));
		expect(onSelect).toHaveBeenCalledWith('g1', expect.anything(), expect.anything());
	});

	describe('search', () => {
		it('finds nodes by name without accents and lists where they sit', async () => {
			await open();
			await typeSearch('phan so');
			await waitFor(() => expect(rowLabels()).toEqual(['Phân số']));
			expect(row(/Phân số/)).toHaveTextContent('Toán học › Lớp 2');
			expect(screen.getByRole('listbox')).toBeInTheDocument();
		});

		it('lists only choosable nodes when just leaves can be chosen', async () => {
			await open({ selectable: 'leaf' });
			await typeSearch('toan');
			await waitFor(() => expect(rowLabels()).toEqual(['Lớp 1', 'Phân số']));
		});

		it('says so when nothing matches', async () => {
			await open();
			await typeSearch('zzz');
			await waitFor(() =>
				expect(panel().querySelector('[data-sui-tree-select-empty]')).toHaveTextContent(
					'No results'
				)
			);
		});

		it('chooses a result and shows its full path afterwards', async () => {
			await open();
			await typeSearch('lop 1');
			await user.click(await waitFor(() => row(/Lớp 1/)));
			expect(trigger()).toHaveTextContent('Toán học › Lớp 1');
		});

		it('has no search box when switched off', async () => {
			await open({ searchable: false });
			expect(searchBox()).toBeNull();
		});
	});

	describe('keyboard', () => {
		const active = () => panel().querySelector('[data-sui-tree-row][data-active]');

		it('moves with the arrows and chooses with Enter', async () => {
			const onSelect = vi.fn();
			await open({ onSelect });
			expect(active()).toHaveTextContent('Toán học');
			await press('ArrowDown');
			expect(active()).toHaveTextContent('Tiếng Anh');
			await press('Enter');
			expect(onSelect).toHaveBeenCalledWith('eng', expect.anything(), expect.anything());
		});

		it('opens and closes branches with Right and Left', async () => {
			await open();
			await press('ArrowRight');
			expect(rowLabels()).toEqual(['Toán học', 'Lớp 1', 'Lớp 2', 'Tiếng Anh']);
			await press('ArrowRight');
			expect(active()).toHaveTextContent('Lớp 1');
			await press('ArrowLeft');
			expect(active()).toHaveTextContent('Toán học');
			await press('ArrowLeft');
			expect(rowLabels()).toEqual(['Toán học', 'Tiếng Anh']);
		});

		it('points the search box at the highlighted row', async () => {
			await open();
			await press('ArrowDown');
			expect(searchBox()).toHaveAttribute('aria-activedescendant', active()?.id);
		});

		it('Enter on a branch only opens it when just leaves can be chosen', async () => {
			const onSelect = vi.fn();
			await open({ selectable: 'leaf', onSelect });
			await press('Enter');
			expect(onSelect).not.toHaveBeenCalled();
			expect(rowLabels()).toEqual(['Toán học', 'Lớp 1', 'Lớp 2', 'Tiếng Anh']);
		});
	});

	it('clears the choice', async () => {
		const onSelect = vi.fn();
		render(SuiTreeSelect, {
			label: 'Subject',
			items: subjects,
			value: 'g1',
			clearable: true,
			onSelect
		});
		await user.click(screen.getByRole('button', { name: /clear selection/i }));
		expect(onSelect).toHaveBeenCalledWith(undefined, undefined, []);
		expect(trigger()).toHaveTextContent('Select…');
	});

	it('validates with zod on a genuine blur', async () => {
		const { container } = render(SuiTreeSelect, {
			label: 'Subject',
			items: subjects,
			schema: z.string().min(1, 'Pick a subject')
		});
		trigger().focus();
		await user.tab();
		await waitFor(() => expect(container).toHaveTextContent('Pick a subject'));
	});

	it('a hidden input carries the value for native forms', () => {
		render(SuiTreeSelect, { label: 'Subject', items: subjects, name: 'subject', value: 'g1' });
		expect(document.querySelector('input[name="subject"]')).toHaveValue('g1');
	});

	it('a value that is not in the tree shows no label', () => {
		render(SuiTreeSelect, { label: 'Subject', items: subjects, value: 'gone' });
		expect(trigger()).toHaveTextContent('gone');
	});

	it('has a skeleton the size of the field', () => {
		render(SuiTreeSelectSkeleton, { size: 'sm' });
		expect(document.querySelector('[data-sui-skeleton="tree-select"]')).toHaveAttribute(
			'data-sui-size',
			'sm'
		);
	});
});

describe('SuiTreeSelect (cascade)', () => {
	const menuItems = (): HTMLElement[] =>
		Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'));
	const itemLabels = () =>
		menuItems().map((item) => item.querySelector('span.truncate')?.textContent);
	const menuItem = (text: RegExp): HTMLElement => {
		const found = menuItems().find((item) => text.test(item.textContent ?? ''));
		if (!found) throw new Error(`no menu item matching ${text}`);
		return found;
	};
	/** Opens a branch the way the keyboard does (a hover is a pointer's way to the same). */
	const openBranch = async (text: RegExp) => {
		await fireEvent.keyDown(menuItem(text), { key: 'ArrowRight' });
	};
	const choose = async (text: RegExp) => {
		await waitFor(() => menuItem(text));
		await fireEvent.click(menuItem(text));
	};

	async function openMenu(props: Record<string, unknown> = {}) {
		const view = render(SuiTreeSelect, { label: 'Subject', items: subjects, ...props });
		await user.click(trigger());
		await waitFor(() => expect(menuItems().length).toBeGreaterThan(0));
		return view;
	}

	// A popup still animating out keeps its items: close it while the field is mounted.
	afterEach(async () => {
		if (!document.querySelector('[data-sui-tree-select-content]')) return;
		await user.keyboard('{Escape}');
		await waitFor(() =>
			expect(document.querySelector('[data-sui-tree-select-content]')).toBeNull()
		);
	});

	it('is a menu, and a branch says it has a submenu', async () => {
		await openMenu();
		expect(itemLabels()).toEqual(['Toán học', 'Tiếng Anh']);
		expect(trigger()).toHaveAttribute('aria-haspopup', 'menu');
		expect(menuItem(/Toán học/)).toHaveAttribute('aria-haspopup', 'menu');
		expect(menuItem(/Tiếng Anh/)).not.toHaveAttribute('aria-haspopup');
		expect(menuItem(/Toán học/)).toHaveTextContent('12');
	});

	it('flies out a branch’s children when it is hovered', async () => {
		await openMenu();
		await user.hover(menuItem(/Toán học/));
		await waitFor(() => expect(menuItem(/Lớp 1/)).toBeInTheDocument());
		expect(itemLabels()).toContain('Lớp 2');
	});

	it('offers a branch itself as the first item of its submenu', async () => {
		const onSelect = vi.fn();
		await openMenu({ onSelect });
		await openBranch(/Toán học/);
		await choose(/All of Toán học/);
		expect(onSelect).toHaveBeenCalledWith('math', expect.objectContaining({ value: 'math' }), [
			expect.objectContaining({ value: 'math' })
		]);
		expect(trigger()).toHaveTextContent('Toán học');
	});

	it('reaches a deeper level and reports the whole path', async () => {
		const onSelect = vi.fn();
		await openMenu({ onSelect });
		await openBranch(/Toán học/);
		await waitFor(() => menuItem(/Lớp 2/));
		await openBranch(/Lớp 2/);
		await choose(/Phân số/);
		expect(onSelect.mock.calls[0][2].map((item: SuiTreeItem) => item.value)).toEqual([
			'math',
			'g2',
			'frac'
		]);
		expect(trigger()).toHaveTextContent('Toán học › Lớp 2 › Phân số');
	});

	it('has no "all of" item when just leaves can be chosen', async () => {
		const onSelect = vi.fn();
		await openMenu({ selectable: 'leaf', onSelect });
		await openBranch(/Toán học/);
		await waitFor(() => expect(menuItem(/Lớp 1/)).toBeInTheDocument());
		expect(itemLabels().some((label) => /All of/.test(label ?? ''))).toBe(false);
		await choose(/Lớp 1/);
		expect(onSelect).toHaveBeenCalledWith('g1', expect.anything(), expect.anything());
	});

	it('marks the branches above the chosen node', async () => {
		await openMenu({ value: 'frac' });
		expect(menuItem(/Toán học/)).toHaveClass('font-medium');
		expect(menuItem(/Tiếng Anh/)).not.toHaveClass('font-medium');
	});

	it('shows the way from a hidden item: a disabled leaf cannot be chosen', async () => {
		const onSelect = vi.fn();
		await openMenu({
			onSelect,
			items: [
				{ value: 'a', label: 'Alpha', disabled: true },
				{ value: 'b', label: 'Beta' }
			]
		});
		expect(menuItem(/Alpha/)).toHaveAttribute('data-disabled');
		await fireEvent.click(menuItem(/Alpha/));
		expect(onSelect).not.toHaveBeenCalled();
	});

	it('has no search box: a menu owns items only, and its type-ahead finds them', async () => {
		await openMenu();
		expect(document.querySelector('[data-sui-tree-select-input]')).toBeNull();
	});
});
