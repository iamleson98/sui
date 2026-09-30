<script lang="ts" module>
        import type { Snippet } from 'svelte';
        import type { SortingState, PaginationState, RowSelectionState } from '@tanstack/svelte-table';
        import type { SuiDataTableColumn } from './columns.js';

        export type SuiDataTableSize = 'sm' | 'md' | 'lg';

        export type SuiDataTableProps<T extends Record<string, any>> = {
                /** Rows to display. */
                data: T[];
                /** Column definitions — see {@link suiColumn}. */
                columns: SuiDataTableColumn<T>[];
                /** Cell density. Default `md`. */
                size?: SuiDataTableSize;
                /** Stable row identity — required for selection & virtual scroll when rows lack unique ids. */
                rowId?: (row: T, index: number) => string;
                /** Enable row selection checkboxes. Default `false`. */
                enableSelection?: boolean;
                /** Fired whenever the selection changes. */
                onSelectionChange?: (rows: T[], ids: string[]) => void;
                /** Fired when a row is clicked. */
                onRowClick?: (row: T, index: number) => void;
                /** Enable the built-in global search box. Default `false`. */
                searchable?: boolean;
                searchPlaceholder?: string;
                /**
                 * `client` (default) sorts and paginates locally.
                 * `server` switches to manual pagination + sort events.
                 * `none` hides the footer.
                 */
                pagination?: 'client' | 'server' | 'none';
                /** Default page size (client mode). Default `10`. */
                pageSize?: number;
                /** Selectable page sizes. */
                pageSizeOptions?: number[];
                /** Server mode: total row count across all pages. */
                rowCount?: number;
                /** Server mode: fired on page / page-size changes. */
                onPageChange?: (page: PaginationState) => void;
                /** Fired with the active sort descriptors (always fires in server mode). */
                onSortChange?: (sorting: SortingState) => void;
                /** Initial sorting. */
                defaultSorting?: SortingState;
                /** Virtualize long lists for fast rendering. Default `true`. */
                virtual?: boolean;
                /** Scroll container max height (px). Default `480`. */
                maxHeight?: number;
                /** Show a loading indicator / skeleton. */
                loading?: boolean;
                /** Message shown when there are no rows. Default `No data`. */
                emptyText?: string;
                /** Extra classes for the root wrapper. */
                class?: string;
                /** Toolbar content rendered between search and column toggles. */
                toolbar?: Snippet;
                /** Full-width content rendered above the toolbar. */
                header?: Snippet;
        };
</script>

<script lang="ts" generics="T extends Record<string, any>">
        import { FlexRender, createTable, isFunction } from '@tanstack/svelte-table';
        import { createVirtualizer } from '@tanstack/svelte-virtual';
        import { get } from 'svelte/store';
        import { untrack } from 'svelte';
        import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
        import { Checkbox } from '$lib/components/ui/checkbox/index.js';
        import SuiInput from '../input/input.svelte';
        import { SUI_TABLE_FEATURES, type SuiColumnMeta } from './columns.js';
        import { cn } from '$lib/utils.js';
        import SearchIcon from '@lucide/svelte/icons/search';
        import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
        import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
        import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
        import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
        import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
        import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
        import Columns3Icon from '@lucide/svelte/icons/columns-3';
        import InboxIcon from '@lucide/svelte/icons/inbox';

        let {
                data,
                columns,
                size = 'md',
                rowId,
                enableSelection = false,
                onSelectionChange,
                onRowClick,
                searchable = false,
                searchPlaceholder = 'Search…',
                pagination = 'client',
                pageSize = 10,
                pageSizeOptions = [10, 20, 30, 50, 100],
                rowCount,
                onPageChange,
                onSortChange,
                defaultSorting = [],
                virtual = true,
                maxHeight = 480,
                loading = false,
                emptyText = 'No data',
                class: className = '',
                toolbar,
                header
        }: SuiDataTableProps<T> = $props();

        const CELL_SIZE: Record<SuiDataTableSize, { cell: string; header: string; estimate: number }> = {
                sm: { cell: 'py-1.5 px-2 text-xs', header: 'py-2 px-2 text-xs', estimate: 32 },
                md: { cell: 'py-2.5 px-3 text-sm', header: 'py-2.5 px-3 text-xs', estimate: 41 },
                lg: { cell: 'py-3.5 px-4 text-sm', header: 'py-3 px-4 text-sm', estimate: 53 }
        };

        // ---- state ----------------------------------------------------------------
        // meta.hiddenByDefault must be applied synchronously — an $effect would
        // let the first paint show columns that should start hidden. Accessor
        // columns carry their id as `accessorKey` until the table resolves it.
        // (Columns are structural — like the createTable call below, this
        // intentionally captures only the initial array.)
        const initialVisibility: Record<string, boolean> = {};
        // svelte-ignore state_referenced_locally
        for (const col of columns) {
                const id = col.id ?? (col as { accessorKey?: string }).accessorKey;
                if (id && (col.meta as SuiColumnMeta | undefined)?.hiddenByDefault) {
                        initialVisibility[id] = false;
                }
        }

        // initial values intentionally captured once (initial state semantics)
        // svelte-ignore state_referenced_locally
        let sorting = $state.raw<SortingState>(defaultSorting);
        // svelte-ignore state_referenced_locally
        let columnVisibility = $state.raw<Record<string, boolean>>(initialVisibility);
        let rowSelection = $state.raw<RowSelectionState>({});
        let globalFilter = $state('');
        // svelte-ignore state_referenced_locally
        let paginationState = $state.raw<PaginationState>({ pageIndex: 0, pageSize });

        const manual = $derived(pagination === 'server');
        // 'none' hands the data over as-is: manual pagination without a row count
        // makes the paginated row model show every row in one "page".
        const manualNone = $derived(pagination === 'none');

        // The table instance is created once; `data` stays reactive through the
        // getter below, while columns/rowId are structural (recreate to change).
        // svelte-ignore state_referenced_locally
        const table = createTable({
                features: SUI_TABLE_FEATURES,
                columns,
                get data() {
                        return data;
                },
                // svelte-ignore state_referenced_locally
                getRowId: rowId ?? undefined,
                get manualPagination() {
                        return manual || manualNone;
                },
                // The svelte adapter stores options inside a deep $state proxy, so
                // `table.options.data` gets re-proxied on EVERY state change. The
                // core row model treats that as a new dataset and auto-resets the
                // page index, cancelling every nextPage() call. We own the reset
                // instead — see the data-change effect below.
                autoResetPageIndex: false,
                get manualSorting() {
                        return manual;
                },
                get rowCount() {
                        return manual ? (rowCount ?? 0) : data.length;
                },
                state: {
                        get sorting() {
                                return sorting;
                        },
                        get columnVisibility() {
                                return columnVisibility;
                        },
                        get rowSelection() {
                                return rowSelection;
                        },
                        get globalFilter() {
                                return globalFilter;
                        },
                        get pagination() {
                                return paginationState;
                        }
                },
                onSortingChange: (updater) => {
                        sorting = isFunction(updater) ? updater(sorting) : updater;
                        onSortChange?.(sorting);
                },
                onColumnVisibilityChange: (updater) => {
                        columnVisibility = isFunction(updater) ? updater(columnVisibility) : updater;
                },
                onRowSelectionChange: (updater) => {
                        rowSelection = isFunction(updater) ? updater(rowSelection) : updater;
                        const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
                        onSelectionChange?.(selectedRows, Object.keys(rowSelection));
                },
                onGlobalFilterChange: (updater) => {
                        globalFilter = isFunction(updater) ? updater(globalFilter) : updater;
                },
                onPaginationChange: (updater) => {
                        paginationState = isFunction(updater) ? updater(paginationState) : updater;
                        onPageChange?.(paginationState);
                }
        });

        // Return to page 1 when a genuinely new dataset arrives (client mode).
        // Server mode is skipped: the consumer refetches on every page change
        // and must stay on the requested page.
        let sawFirstDataset = false;
        $effect(() => {
                const dataset = data;
                untrack(() => {
                        if (!sawFirstDataset) {
                                sawFirstDataset = true;
                                return;
                        }
                        if (manual || manualNone) return;
                        paginationState = { ...paginationState, pageIndex: 0 };
                });
        });

        const rows = $derived(table.getRowModel().rows);
        const visibleColumnCount = $derived(table.getVisibleLeafColumns().length + (enableSelection ? 1 : 0));
        const pageCount = $derived(table.getPageCount());
        const pageIndex = $derived(paginationState.pageIndex);
        const currentPageSize = $derived(paginationState.pageSize);
        const canPrevious = $derived(table.getCanPreviousPage());
        const canNext = $derived(table.getCanNextPage());
        const selectedCount = $derived(Object.keys(rowSelection).length);
        const totalRows = $derived(manual ? (rowCount ?? 0) : data.length);
        const showBody = $derived(!loading && rows.length > 0);
        const gridMode = $derived(virtual && showBody);

        // ---- virtualization -------------------------------------------------------
        let scrollRef = $state<HTMLDivElement | undefined>(undefined);
        const rowVirtualizer = createVirtualizer({
                get count() {
                        return rows.length;
                },
                estimateSize: () => CELL_SIZE[size].estimate,
                getScrollElement: () => scrollRef ?? null,
                measureElement:
                        typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
                                ? (element) => element.getBoundingClientRect().height
                                : undefined,
                overscan: 10
        });

        $effect(() => {
                if (!scrollRef) return;
                get(rowVirtualizer).setOptions({ getScrollElement: () => scrollRef ?? null });
        });
        $effect(() => {
                get(rowVirtualizer).setOptions({ count: rows.length });
        });

        function measureRow(node: HTMLTableRowElement) {
                get(rowVirtualizer).measureElement(node);
        }

        // ---- helpers --------------------------------------------------------------
        function alignClass(align: 'left' | 'center' | 'right' | undefined): string {
                if (align === 'right') return 'text-right';
                if (align === 'center') return 'text-center';
                return 'text-left';
        }

        function toggleSort(columnId: string) {
                const column = table.getColumn(columnId);
                if (!column || !column.getCanSort()) return;
                const sorted = column.getIsSorted();
                // none → asc → desc → none (the classic desktop cycle)
                if (sorted === 'desc') column.clearSorting();
                else column.toggleSorting(sorted === 'asc');
        }

        export function getPage(): PaginationState {
                return paginationState;
        }

        export function getSorting(): SortingState {
                return sorting;
        }
</script>

<div
        class="bg-card text-card-foreground w-full overflow-hidden rounded-lg border {className}"
        data-sui-data-table
        data-sui-size={size}
>
        <!-- toolbar (always rendered: the column visibility menu is a core
             affordance, search / header / toolbar slots are optional) -->
        <div class="flex flex-wrap items-center gap-2 border-b px-3 py-2.5" data-sui-data-table-toolbar>
                        {#if header}
                                <div class="w-full" data-sui-data-table-header>{@render header()}</div>
                        {/if}
                        {#if searchable}
                                <div class="w-full max-w-56" data-sui-data-table-search>
                                        <SuiInput
                                                bind:value={globalFilter}
                                                size="sm"
                                                placeholder={searchPlaceholder}
                                                startIcon={SearchIcon}
                                                aria-label={searchPlaceholder}
                                        />
                                </div>
                        {/if}
                        {@render toolbar?.()}
                <div class="ml-auto flex items-center gap-2">
                        <DropdownMenu.Root>
                                        <DropdownMenu.Trigger
                                                class="hover:bg-accent hover:text-accent-foreground inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium outline-none"
                                                data-sui-data-table-columns-trigger
                                                aria-label="Toggle columns"
                                        >
                                                <Columns3Icon class="size-3.5" aria-hidden="true" />
                                                Columns
                                        </DropdownMenu.Trigger>
                                        <DropdownMenu.Content align="end" class="z-50">
                                                <DropdownMenu.Label class="text-muted-foreground text-xs">Visible columns</DropdownMenu.Label>
                                                {#each table.getAllLeafColumns() as column (column.id)}
                                                        {#if column.getCanHide()}
                                                                <DropdownMenu.CheckboxItem
                                                                        checked={column.getIsVisible()}
                                                                        onCheckedChange={(value) => column.toggleVisibility(value)}
                                                                        class="text-xs capitalize"
                                                                >
                                                                        {column.id.replace(/([a-z])([A-Z])/g, '$1 $2')}
                                                                </DropdownMenu.CheckboxItem>
                                                        {/if}
                                                {/each}
                                        </DropdownMenu.Content>
                        </DropdownMenu.Root>
                </div>
        </div>

        <!-- table -->
        <div class="relative">
                <div
                        bind:this={scrollRef}
                        class="relative overflow-auto"
                        style="max-height: {maxHeight}px"
                        data-sui-data-table-scroll
                >
                        <table class="w-full border-collapse" style={gridMode ? 'display: grid;' : ''}>
                                <thead
                                        class={cn('bg-muted/50 sticky top-0 z-10', gridMode && '[display:grid]')}
                                        data-sui-data-table-head
                                >
                                        {#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
                                                <tr class={cn('border-b', gridMode && '[display:flex] w-full')}>
                                                        {#if enableSelection}
                                                                <th
                                                                        class="w-10 border-b px-3 py-2"
                                                                        style={gridMode ? 'display:flex; width:40px;' : ''}
                                                                        data-sui-data-table-select-all
                                                                >
                                                                        <Checkbox
                                                                                checked={table.getIsAllRowsSelected()}
                                                                                indeterminate={table.getIsSomeRowsSelected()}
                                                                                onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
                                                                                aria-label="Select all rows"
                                                                        />
                                                                </th>
                                                        {/if}
                                                        {#each headerGroup.headers as header (header.id)}
                                                                {@const column = header.column}
                                                                {@const meta = (column.columnDef.meta ?? {}) as { align?: 'left' | 'center' | 'right'; width?: number }}
                                                                <th
                                                                        scope="col"
                                                                        style={gridMode
                                                                                ? `display:flex; width:${header.getSize()}px;`
                                                                                : (meta.width ? `width:${meta.width}px;` : '')}
                                                                        class={cn(
                                                                                'text-muted-foreground font-medium tracking-wide',
                                                                                CELL_SIZE[size].header,
                                                                                alignClass(meta.align),
                                                                                column.getCanSort() ? 'cursor-pointer select-none hover:text-foreground' : '',
                                                                                gridMode && 'border-b'
                                                                        )}
                                                                        aria-sort={column.getIsSorted() === 'asc'
                                                                                ? 'ascending'
                                                                                : column.getIsSorted() === 'desc'
                                                                                        ? 'descending'
                                                                                        : undefined}
                                                                        onclick={() => toggleSort(column.id)}
                                                                        onkeydown={(e) => {
                                                                                if (e.key === 'Enter' || e.key === ' ') {
                                                                                        e.preventDefault();
                                                                                        toggleSort(column.id);
                                                                                }
                                                                        }}
                                                                >
                                                                        {#if !header.isPlaceholder}
                                                                                <span class="inline-flex items-center gap-0.5">
                                                                                        <FlexRender header={header} />
                                                                                        {#if column.getCanSort()}
                                                                                                <span class="text-muted-foreground/60 ml-0.5 inline-flex" aria-hidden="true">
                                                                                                        {#if column.getIsSorted() === 'asc'}
                                                                                                                <ChevronUpIcon class="size-3.5" />
                                                                                                        {:else if column.getIsSorted() === 'desc'}
                                                                                                                <ChevronDownIcon class="size-3.5" />
                                                                                                        {:else}
                                                                                                                <ChevronsUpDownIcon class="size-3.5 opacity-40" />
                                                                                                        {/if}
                                                                                                </span>
                                                                                        {/if}
                                                                                </span>
                                                                        {/if}
                                                                </th>
                                                        {/each}
                                                </tr>
                                        {/each}
                                </thead>

                                <tbody
                                        class="relative"
                                        style={gridMode ? `display:grid; height: ${$rowVirtualizer.getTotalSize()}px;` : ''}
                                        data-sui-data-table-body
                                >
                                        {#if loading}
                                                <tr>
                                                        <td colspan={visibleColumnCount} class="py-16 text-center">
                                                                <span class="text-muted-foreground inline-flex items-center gap-2 text-sm" role="status">
                                                                        <LoaderCircleIcon class="size-4 animate-spin" aria-hidden="true" />
                                                                        Loading…
                                                                </span>
                                                        </td>
                                                </tr>
                                        {:else if rows.length === 0}
                                                <tr>
                                                        <td colspan={visibleColumnCount} class="py-16" data-sui-data-table-empty>
                                                                <div class="text-muted-foreground flex flex-col items-center gap-2">
                                                                        <InboxIcon class="size-8 opacity-40" aria-hidden="true" />
                                                                        <span class="text-sm">{emptyText}</span>
                                                                </div>
                                                        </td>
                                                </tr>
                                        {:else if gridMode}
                                                {#each $rowVirtualizer.getVirtualItems() as virtualRow (virtualRow.index)}
                                                        {@const row = rows[virtualRow.index]}
                                                        <tr
                                                                data-index={virtualRow.index}
                                                                use:measureRow
                                                                class={cn(
                                                                        'hover:bg-muted/40 border-b transition-colors',
                                                                        row.getIsSelected() && 'bg-muted/50',
                                                                        onRowClick && 'cursor-pointer',
                                                                        '[display:flex] absolute w-full'
                                                                )}
                                                                style="transform: translateY({virtualRow.start}px);"
                                                                onclick={onRowClick ? () => onRowClick(row.original, virtualRow.index) : undefined}
                                                        >
                                                                {#if enableSelection}
                                                                        <td class="w-10 px-3" style="display:flex; align-items:center;">
                                                                                <Checkbox
                                                                                        checked={row.getIsSelected()}
                                                                                        onCheckedChange={(value) => row.toggleSelected(!!value)}
                                                                                        aria-label="Select row {virtualRow.index + 1}"
                                                                                        onclick={(e) => e.stopPropagation()}
                                                                                />
                                                                        </td>
                                                                {/if}
                                                                {#each row.getVisibleCells() as cell (cell.id)}
                                                                        {@const meta = (cell.column.columnDef.meta ?? {}) as { align?: 'left' | 'center' | 'right'; class?: string }}
                                                                        <td
                                                                                style="display:flex; width:{cell.column.getSize()}px; align-items:center;"
                                                                                class={cn('truncate', CELL_SIZE[size].cell, alignClass(meta.align), meta.class)}
                                                                        >
                                                                                <FlexRender cell={cell} />
                                                                        </td>
                                                                {/each}
                                                        </tr>
                                                {/each}
                                        {:else}
                                                {#each rows as row, index (row.id)}
                                                        <tr
                                                                class={cn(
                                                                        'hover:bg-muted/40 border-b transition-colors',
                                                                        row.getIsSelected() && 'bg-muted/50',
                                                                        onRowClick && 'cursor-pointer'
                                                                )}
                                                                onclick={onRowClick ? () => onRowClick(row.original, index) : undefined}
                                                        >
                                                                {#if enableSelection}
                                                                        <td class="w-10 px-3">
                                                                                <Checkbox
                                                                                        checked={row.getIsSelected()}
                                                                                        onCheckedChange={(value) => row.toggleSelected(!!value)}
                                                                                        aria-label="Select row {index + 1}"
                                                                                        onclick={(e) => e.stopPropagation()}
                                                                                />
                                                                        </td>
                                                                {/if}
                                                                {#each row.getVisibleCells() as cell (cell.id)}
                                                                        {@const meta = (cell.column.columnDef.meta ?? {}) as { align?: 'left' | 'center' | 'right'; class?: string }}
                                                                        <td class={cn('truncate', CELL_SIZE[size].cell, alignClass(meta.align), meta.class)}>
                                                                                <FlexRender cell={cell} />
                                                                        </td>
                                                                {/each}
                                                        </tr>
                                                {/each}
                                        {/if}
                                </tbody>
                        </table>
                </div>
        </div>

        <!-- footer: always present with selection (the count matters even
             without pagination); the pager itself needs a pagination mode -->
        {#if pagination !== 'none' || enableSelection}
                <div class="flex flex-wrap items-center gap-3 border-t px-3 py-2 text-xs" data-sui-data-table-footer>
                        {#if enableSelection}
                                <span class="text-muted-foreground" data-sui-data-table-count>
                                        {selectedCount > 0 ? `${selectedCount} of ${totalRows} selected` : `${totalRows} rows`}
                                </span>
                        {:else}
                                <span class="text-muted-foreground" data-sui-data-table-count>{totalRows} rows</span>
                        {/if}
                        {#if pagination !== 'none'}
                                {#if pagination === 'client' && rows.length !== 0}
                                        <label class="text-muted-foreground ml-auto flex items-center gap-1.5" data-sui-data-table-page-size>
                                                Rows
                                                <select
                                                        class="bg-background hover:bg-accent focus-visible:ring-ring/50 border-input h-8 rounded-md border px-2 text-xs outline-none"
                                                        value={currentPageSize}
                                                        onchange={(e) => table.setPageSize(Number(e.currentTarget.value))}
                                                        aria-label="Rows per page"
                                                >
                                                        {#each pageSizeOptions as opt (opt)}
                                                                <option value={opt}>{opt}</option>
                                                        {/each}
                                                </select>
                                        </label>
                                {:else}
                                        <span class="ml-auto"></span>
                                {/if}
                                <span class="text-muted-foreground flex items-center gap-1">
                                        <button
                                                type="button"
                                                class="hover:bg-accent disabled:opacity-40 inline-flex size-7 items-center justify-center rounded-md border outline-none disabled:pointer-events-none"
                                                onclick={() => table.previousPage()}
                                                disabled={!canPrevious}
                                                aria-label="Previous page"
                                        >
                                                <ChevronLeftIcon class="size-3.5" aria-hidden="true" />
                                        </button>
                                        <span class="px-1 tabular-nums" data-sui-data-table-page>
                                                {pageCount === 0 ? 0 : pageIndex + 1} / {pageCount === -1 ? '…' : pageCount}
                                        </span>
                                        <button
                                                type="button"
                                                class="hover:bg-accent disabled:opacity-40 inline-flex size-7 items-center justify-center rounded-md border outline-none disabled:pointer-events-none"
                                                onclick={() => table.nextPage()}
                                                disabled={!canNext}
                                                aria-label="Next page"
                                        >
                                                <ChevronRightIcon class="size-3.5" aria-hidden="true" />
                                        </button>
                                </span>
                        {:else}
                                <span class="ml-auto"></span>
                        {/if}
                </div>
        {/if}
</div>
