import {
        createColumnHelper,
        tableFeatures,
        metaHelper,
        rowSortingFeature,
        rowPaginationFeature,
        rowSelectionFeature,
        columnVisibilityFeature,
        columnFilteringFeature,
        columnSizingFeature,
        globalFilteringFeature,
        createSortedRowModel,
        createPaginatedRowModel,
        createFilteredRowModel,
        sortFn_alphanumeric,
        sortFn_datetime,
        sortFn_text,
        type ColumnDef,
        type ColumnHelper
} from '@tanstack/svelte-table';

/** Extra rendering hints sui applies to a column. */
export interface SuiColumnMeta {
        /** Horizontal alignment of cells (and header). Default `left`. */
        align?: 'left' | 'center' | 'right';
        /** Preferred column width in px. */
        width?: number;
        /** Extra classes for cells in this column. */
        class?: string;
        /** Hide this column by default (users can re-enable it in the menu). */
        hiddenByDefault?: boolean;
}

/**
 * The canonical feature set used by `SuiDataTable`, with sui's column meta
 * wired in. Exported so column helpers stay correctly typed.
 */
export const SUI_TABLE_FEATURES = tableFeatures({
        rowSortingFeature,
        sortedRowModel: createSortedRowModel(),
        rowPaginationFeature,
        paginatedRowModel: createPaginatedRowModel(),
        rowSelectionFeature,
        columnVisibilityFeature,
        columnFilteringFeature,
        columnSizingFeature,
        globalFilteringFeature,
        filteredRowModel: createFilteredRowModel(),
        sortFns: {
                alphanumeric: sortFn_alphanumeric,
                datetime: sortFn_datetime,
                text: sortFn_text
        },
        columnMeta: metaHelper<SuiColumnMeta>()
});

export type SuiTableFeatures = typeof SUI_TABLE_FEATURES;

/** Column definition accepted by `SuiDataTable`. */
export type SuiDataTableColumn<T extends Record<string, any>> = ColumnDef<SuiTableFeatures, T>;

/**
 * Ergonomic column factory. Example:
 *
 * ```ts
 * const col = suiColumn<Person>();
 * const columns = [
 *   col.accessor('name', { header: 'Name' }),
 *   col.accessor('age', { header: 'Age', meta: { align: 'right' } }),
 *   col.display({ id: 'actions', header: '', cell: ({ row }) => … })
 * ];
 * ```
 */
export function suiColumn<T extends Record<string, any>>(): ColumnHelper<SuiTableFeatures, T> {
        return createColumnHelper<SuiTableFeatures, T>();
}
