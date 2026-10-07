#!/usr/bin/env python3
"""SuiDataTable: column pinning (sticky) + CSV export + toolbar button."""
import pathlib

f = pathlib.Path('src/lib/sui/data-table/data-table.svelte')
s = f.read_text()

# ---------- 1. imports ----------
s = s.replace(
    "import Columns3Icon from '@lucide/svelte/icons/columns-3';",
    "import Columns3Icon from '@lucide/svelte/icons/columns-3';\n"
    "        import DownloadIcon from '@lucide/svelte/icons/download';"
)
assert 'DownloadIcon' in s

# csv helper import — anchor on the SuiInput import inside data-table
anchor = "import SuiInput from '../input/input.svelte';"
assert anchor in s, 'SuiInput import anchor missing'
s = s.replace(
    anchor,
    anchor + "\n        import { suiDownloadCsv, type SuiCsvColumn } from './csv.js';"
)

# ---------- 2. props ----------
s = s.replace(
    """                emptyText = 'No data',""",
    """                emptyText = 'No data',
                /** Show a CSV download button in the toolbar (exports the filtered rows). */
                exportable = false,
                /** File name for the CSV download. Default `sui-export.csv`. */
                exportFilename = 'sui-export.csv',"""
)
assert 'exportable = false' in s

# ---------- 3. pinning math + export helper (insert before the `const table = createTable`) ----------
anchor = "        // svelte-ignore state_referenced_locally\n        const table = createTable({"
assert anchor in s
pin_block = """        // ---- column pinning (sticky) ------------------------------------------------
        // sui manages pin ordering itself: TanStack's visible-leaf order is the
        // declaration order, so pinned columns are re-ordered to the edges here
        // and rendered with explicit sticky offsets. Pinned widths come from
        // `meta.width ?? column.getSize()`; giving pinned columns an explicit
        // width (or size) keeps offsets deterministic.
        const SELECTION_COL_W = 40;

        function columnWidth(column: { columnDef: { meta?: unknown }; getSize(): number }): number {
                const meta = (column.columnDef.meta ?? {}) as { width?: number };
                return meta.width ?? column.getSize();
        }

        const pinnedColumns = $derived.by(() => {
                const visible = table.getVisibleLeafColumns();
                const start = [];
                const center = [];
                const end = [];
                for (const column of visible) {
                        const meta = (column.columnDef.meta ?? {}) as { pinned?: 'left' | 'right' };
                        if (meta.pinned === 'left') start.push(column);
                        else if (meta.pinned === 'right') end.push(column);
                        else center.push(column);
                }
                return { start, center, end };
        });

        const anyPinned = $derived(pinnedColumns.start.length > 0 || pinnedColumns.end.length > 0);

        /** left offset per pinned column id (includes the selection column). */
        const leftOffsets = $derived.by(() => {
                const map = new Map<string, number>();
                let x = enableSelection ? SELECTION_COL_W : 0;
                for (const column of pinnedColumns.start) {
                        map.set(column.id, x);
                        x += columnWidth(column);
                }
                return map;
        });

        /** right offset per pinned column id (from the right edge). */
        const rightOffsets = $derived.by(() => {
                const map = new Map<string, number>();
                let x = 0;
                for (const column of [...pinnedColumns.end].reverse()) {
                        map.set(column.id, x);
                        x += columnWidth(column);
                }
                return map;
        });

        /** Sticky inline style for a column cell; '' when unpinned. */
        function pinStyle(columnId: string, header: boolean): string {
                if (leftOffsets.has(columnId)) {
                        return `position: sticky; left: ${leftOffsets.get(columnId)}px; z-index: ${header ? 21 : 12};`;
                }
                if (rightOffsets.has(columnId)) {
                        return `position: sticky; right: ${rightOffsets.get(columnId)}px; z-index: ${header ? 21 : 12};`;
                }
                return '';
        }

        /** Extra classes for a pinned cell (opaque bg + row-state tinting). */
        function pinClasses(columnId: string, header: boolean): string {
                if (!leftOffsets.has(columnId) && !rightOffsets.has(columnId)) return '';
                return cn(
                        header ? 'bg-muted' : 'bg-background',
                        !header && 'group-hover/row:bg-muted/50 group-data-[selected]/row:bg-muted/50'
                );
        }

        /** Which side of the pin group forms the shadow edge, if any. */
        function edgeSide(columnId: string): 'left' | 'right' | undefined {
                if (columnId === pinnedColumns.start[pinnedColumns.start.length - 1]?.id) return 'left';
                if (columnId === pinnedColumns.end[0]?.id) return 'right';
                return undefined;
        }

        /** Pin-ordered headers (single header group — sui never nests columns). */
        const displayHeaders = $derived.by(() => {
                const groups = table.getHeaderGroups();
                const group = groups[0];
                if (!group) return [];
                if (!anyPinned) return group.headers;
                const byId = new Map(group.headers.map((header) => [header.column.id, header]));
                const ordered = [
                        ...pinnedColumns.start,
                        ...pinnedColumns.center,
                        ...pinnedColumns.end
                ];
                return ordered.map((column) => byId.get(column.id)).filter((h) => h !== undefined);
        });

        /** Pin-ordered cells for a row. */
        function displayCells(
                row: typeof table.getRowModel().rows[number]
        ): Array<(typeof row.getVisibleCells())[number]> {
                const cells = row.getVisibleCells();
                if (!anyPinned) return cells;
                const byId = new Map(cells.map((cell) => [cell.column.id, cell]));
                return [
                        ...pinnedColumns.start,
                        ...pinnedColumns.center,
                        ...pinnedColumns.end
                ]
                        .map((column) => byId.get(column.id))
                        .filter((c) => c !== undefined);
        }

        /** CSV export of the current filtered rows (accessor columns only). */
        function exportCsv() {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const columns: SuiCsvColumn<any>[] = displayHeaders
                        .filter((header) => header.column.columnDef.accessorFn)
                        .map((header) => ({
                                id: header.column.id,
                                header:
                                        typeof header.column.columnDef.header === 'string'
                                                ? header.column.columnDef.header
                                                : header.column.id,
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                value: (row: any) => row.getValue(header.column.id)
                        }));
                suiDownloadCsv(table.getFilteredRowModel().rows, columns, exportFilename);
        }

"""
s = s.replace(anchor, pin_block + anchor)

f.write_text(s)
print('script section done')
