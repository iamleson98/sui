import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { SuiDataTable, SuiDataTableSkeleton, suiColumn, renderComponent } from '$lib/sui';
import type { SuiDataTableColumn } from '$lib/sui';
import StatusBadge from './harness/status-badge.svelte';

type Person = { id: string; name: string; age: number; city: string };

const col = suiColumn<Person>();

// svelte2tsx mishandles the helper's intersection types; tsc proves these
// are mutually assignable, so a trailing cast keeps svelte-check happy.
const columns = [
	col.accessor('name', { header: 'Name' }),
	col.accessor('age', { header: 'Age', meta: { align: 'right' } }),
	col.accessor('city', { header: 'City' }),
	col.display({
		id: 'status',
		header: 'Status',
		cell: ({ row }) => renderComponent(StatusBadge, { status: row.original.name === 'Ada' ? 'single' : 'complicated' })
	})
] as unknown as SuiDataTableColumn<Record<string, any>>[];

const data: Person[] = [
	{ id: '1', name: 'Ada', age: 36, city: 'London' },
	{ id: '2', name: 'Grace', age: 45, city: 'New York' },
	{ id: '3', name: 'Linus', age: 55, city: 'Portland' },
	{ id: '4', name: 'Margaret', age: 87, city: 'London' }
];

const user = userEvent.setup({ pointerEventsCheck: 0 });

function cell(row: number, column: number): string {
	return document.querySelectorAll('[data-sui-data-table-body] tr')[row]?.children[column]?.textContent ?? '';
}

describe('SuiDataTable', () => {
	it('renders headers and rows', () => {
		render(SuiDataTable, { data, columns, pagination: 'none', virtual: false });
		expect(screen.getByRole('columnheader', { name: /name/i })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: /age/i })).toBeInTheDocument();
		expect(document.querySelectorAll('[data-sui-data-table-body] tr').length).toBe(4);
		expect(cell(0, 0)).toBe('Ada');
		expect(cell(2, 0)).toBe('Linus');
	});

	it('renders custom cell components', () => {
		render(SuiDataTable, { data, columns, pagination: 'none', virtual: false });
		expect(document.querySelectorAll('[data-testid="status-badge"]').length).toBe(4);
	});

	it('sorts ascending then descending on header click', async () => {
		render(SuiDataTable, { data, columns, pagination: 'none', virtual: false });
		const ageHeader = screen.getByRole('columnheader', { name: /age/i });
		expect(ageHeader).not.toHaveAttribute('aria-sort'); // none is implicit

		await user.click(ageHeader);
		expect(ageHeader).toHaveAttribute('aria-sort', 'ascending');
		expect(cell(0, 0)).toBe('Ada'); // youngest first

		await user.click(ageHeader);
		expect(ageHeader).toHaveAttribute('aria-sort', 'descending');
		expect(cell(0, 0)).toBe('Margaret'); // oldest first

		await user.click(ageHeader);
		expect(ageHeader).not.toHaveAttribute('aria-sort');
	});


	it('paginates and switches page size', async () => {
		const more = [...data, ...data.map((p, i) => ({ ...p, id: `x${i}` }))];
		render(SuiDataTable, { data: more, columns, pageSize: 5, virtual: false });

		expect(document.querySelectorAll('[data-sui-data-table-body] tr').length).toBe(5);
		expect(screen.getByText(/1 \/ 2/)).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Next page' }));
		expect(document.querySelectorAll('[data-sui-data-table-body] tr').length).toBe(3);

		await user.click(screen.getByRole('button', { name: 'Previous page' }));
		expect(screen.getByText(/1 \/ 2/)).toBeInTheDocument();

		const sizeSelect = screen.getByLabelText('Rows per page') as HTMLSelectElement;
		await user.selectOptions(sizeSelect, '10');
		expect(document.querySelectorAll('[data-sui-data-table-body] tr').length).toBe(8);
	});

	it('hides and shows columns via the visibility menu', async () => {
		render(SuiDataTable, { data, columns, pagination: 'none', virtual: false });
		expect(screen.getByRole('columnheader', { name: /city/i })).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: /toggle columns/i }));
		const menu = await screen.findByRole('menu');
		await user.click(within(menu).getByText(/city/i));
		await waitFor(() => {
			expect(screen.queryByRole('columnheader', { name: /city/i })).toBeNull();
		});

		// checkbox items intentionally keep the menu open so several columns
		// can be toggled in one go — dismiss explicitly before reopening
		await user.keyboard('{Escape}');
		await waitFor(() => {
			expect(screen.queryByRole('menu')).toBeNull();
		});

		await user.click(screen.getByRole('button', { name: /toggle columns/i }));
		const menu2 = await screen.findByRole('menu');
		await user.click(within(menu2).getByText(/city/i));
		await waitFor(() => {
			expect(screen.getByRole('columnheader', { name: /city/i })).toBeInTheDocument();
		});
	});

	it('respects hiddenByDefault column meta', () => {
		const hidden = [
			col.accessor('name', { header: 'Name' }),
			col.accessor('city', { header: 'City', meta: { hiddenByDefault: true } })
		] as unknown as SuiDataTableColumn<Record<string, any>>[];
		render(SuiDataTable, { data, columns: hidden, pagination: 'none', virtual: false });
		expect(screen.queryByRole('columnheader', { name: /city/i })).toBeNull();
		expect(screen.getByRole('columnheader', { name: /name/i })).toBeInTheDocument();
	});

	it('filters rows with the global search', async () => {
		render(SuiDataTable, { data, columns, searchable: true, pagination: 'none', virtual: false });
		const search = screen.getByPlaceholderText('Search…');
		await user.type(search, 'London');
		await waitFor(() => {
			expect(document.querySelectorAll('[data-sui-data-table-body] tr').length).toBe(2);
		});
	});

	it('supports row selection with select-all', async () => {
		const onSelectionChange = vi.fn();
		render(SuiDataTable, {
			data,
			columns,
			enableSelection: true,
			onSelectionChange,
			pagination: 'none',
			rowId: (row) => row.id,
			virtual: false
		});
		const checkboxes = () => document.querySelectorAll('[role="checkbox"]');
		expect(checkboxes().length).toBe(5); // header + 4 rows

		await user.click(checkboxes()[1]!); // select Ada
		expect(screen.getByText(/1 of 4 selected/)).toBeInTheDocument();

		await user.click(checkboxes()[0]!); // select all
		expect(screen.getByText(/4 of 4 selected/)).toBeInTheDocument();
		expect(onSelectionChange).toHaveBeenLastCalledWith(
			expect.arrayContaining([expect.objectContaining({ name: 'Ada' })]),
			expect.any(Array)
		);
	});

	it('fires onRowClick', async () => {
		const onRowClick = vi.fn();
		render(SuiDataTable, { data, columns, onRowClick, pagination: 'none', virtual: false });
		const row = document.querySelector('[data-sui-data-table-body] tr') as HTMLElement;
		await user.click(row);
		expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ada' }), 0);
	});

	it('shows the empty state', () => {
		render(SuiDataTable, { data: [], columns, pagination: 'none', emptyText: 'Nothing here' });
		expect(screen.getByText('Nothing here')).toBeInTheDocument();
	});

	it('shows a loading state', () => {
		render(SuiDataTable, { data: [], columns, loading: true, pagination: 'none' });
		expect(screen.getByRole('status')).toBeInTheDocument();
	});

	it('reports sort changes via onSortChange', async () => {
		const onSortChange = vi.fn();
		render(SuiDataTable, { data, columns, onSortChange, pagination: 'none', virtual: false });
		await user.click(screen.getByRole('columnheader', { name: /name/i }));
		expect(onSortChange).toHaveBeenCalledWith([{ id: 'name', desc: false }]);
	});

	it('applies density classes per size', () => {
		const { container } = render(SuiDataTable, {
			data,
			columns,
			size: 'lg',
			pagination: 'none',
			virtual: false
		});
		expect(container.querySelector('[data-sui-data-table]')).toHaveAttribute('data-sui-size', 'lg');
		expect(container.querySelector('[data-sui-data-table-body] td')?.className).toContain('py-3.5');
	});

	it('gives the virtualized body a real pixel height (not an unevaluated template)', () => {
		// regression: `height: {$rowVirtualizer.getTotalSize()}px` (brace
		// without the $) renders as literal text → invalid CSS → 0px body
		// → the table collapses to a header-only strip.
		const { container } = render(SuiDataTable, { data, columns, virtual: true });
		const style = container.querySelector('[data-sui-data-table-body]')?.getAttribute('style') ?? '';
		expect(style).toMatch(/height:\s*\d+(\.\d+)?px/);
		expect(style).not.toContain('{');
	});

	it('pins columns sticky to their edge with deterministic offsets', () => {
		const pinned = [
			col.accessor('name', { header: 'Name', meta: { pinned: 'left', width: 120 } }),
			col.accessor('age', { header: 'Age' }),
			col.display({
				id: 'actions',
				header: 'Actions',
				meta: { pinned: 'right', width: 90 }
			})
		] as unknown as SuiDataTableColumn<Record<string, any>>[];
		const { container } = render(SuiDataTable, {
			data,
			columns: pinned,
			enableSelection: true,
			pagination: 'none',
			virtual: false
		});

		const header = container.querySelectorAll('[data-sui-data-table-head] th');
		// selection column always pins at left:0 when any column is pinned
		expect(header[0]).toHaveAttribute('data-sui-data-table-select-all');
		expect(header[0].getAttribute('style')).toContain('position: sticky; left: 0px;');
		// first left-pinned column starts after the 40px selection column
		expect(header[1].getAttribute('style')).toContain('left: 40px;');
		// right-pinned column offsets from the right edge
		expect(header[3].getAttribute('style')).toContain('position: sticky; right: 0px;');
		// the freeze edges carry the shadow affordance
		expect(header[1]).toHaveAttribute('data-sui-pin-shadow', 'left');
		expect(header[3]).toHaveAttribute('data-sui-pin-shadow', 'right');
		expect(header[2]).not.toHaveAttribute('data-sui-pin-shadow');

		// body cells mirror the same sticky offsets
		const row = container.querySelector('[data-sui-data-table-body] tr');
		const cells = row?.querySelectorAll('td') ?? [];
		expect(cells[1].getAttribute('style')).toContain('left: 40px;');
		expect(cells[3].getAttribute('style')).toContain('right: 0px;');
	});

	it('leaves everything un-sticky when no column is pinned', () => {
		const { container } = render(SuiDataTable, {
			data,
			columns,
			enableSelection: true,
			pagination: 'none',
			virtual: false
		});
		const header = container.querySelectorAll('[data-sui-data-table-head] th');
		expect(header[0].getAttribute('style') ?? '').not.toContain('sticky');
		expect(container.querySelector('[data-sui-pin-shadow]')).toBeNull();
	});

	it('renders an export button only when exportable, and it downloads the filtered rows', async () => {
		const created: Blob[] = [];
		URL.createObjectURL = vi.fn((blob: Blob) => {
			created.push(blob);
			return 'blob:mock';
		}) as unknown as typeof URL.createObjectURL;
		URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
		const clickSpy = vi.fn();
		vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickSpy);

		// no button by default
		const plain = render(SuiDataTable, { data, columns, pagination: 'none', virtual: false });
		expect(plain.container.querySelector('[data-sui-data-table-export]')).toBeNull();
		plain.unmount();

		const { container } = render(SuiDataTable, {
			data,
			columns,
			exportable: true,
			exportFilename: 'people.csv',
			pagination: 'none',
			virtual: false
		});
		const button = container.querySelector('[data-sui-data-table-export]') as HTMLButtonElement;
		expect(button).toHaveTextContent('Export');
		await user.click(button);

		expect(clickSpy).toHaveBeenCalledTimes(1);
		const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
		expect(anchor.download).toBe('people.csv');
		const text = await created[0]!.text(); // Blob.text() strips the BOM
		// header + every row, display columns (status) excluded
		expect(text.startsWith('"Name","Age","City"\r\n"Ada","36","London"')).toBe(true);
		expect(text).not.toContain('single');
	});
});

describe('SuiDataTableSkeleton', () => {
	it('renders the requested rows and columns', () => {
		const { container } = render(SuiDataTableSkeleton, { rows: 3, columns: 4 });
		expect(container.querySelectorAll('[data-sui-skeleton="table-head"]').length).toBe(4);
		expect(container.querySelectorAll('[data-sui-skeleton="table-cell"]').length).toBe(12);
	});
});
