#!/usr/bin/env python3
"""SuiDataTable markup: pinned rendering + export button (part 2)."""
import pathlib

f = pathlib.Path('src/lib/sui/data-table/data-table.svelte')
s = f.read_text()

# ---------- A. toolbar: export button before the ml-auto group ----------
old = """                <div class="ml-auto flex items-center gap-2">
                        <DropdownMenu.Root>"""
new = """                <div class="ml-auto flex items-center gap-2">
                        {#if exportable}
                                <button
                                        type="button"
                                        class="hover:bg-accent hover:text-accent-foreground inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium outline-none"
                                        data-sui-data-table-export
                                        aria-label="Export as CSV"
                                        onclick={exportCsv}
                                >
                                        <DownloadIcon class="size-3.5" aria-hidden="true" />
                                        Export
                                </button>
                        {/if}
                        <DropdownMenu.Root>"""
assert old in s, 'toolbar anchor missing'
s = s.replace(old, new, 1)

# ---------- B. header: selection th sticky + ordered headers ----------
old_sel_th = """                        {#if enableSelection}
                                <th
                                        class="w-10 border-b px-3 py-2"
                                        style={gridMode ? 'display:flex; width:40px;' : ''}
                                        data-sui-data-table-select-all
                                >"""
new_sel_th = """                        {#if enableSelection}
                                <th
                                        class="w-10 border-b px-3 py-2 {anyPinned ? 'bg-muted' : ''}"
                                        style="{gridMode ? 'display:flex; width:40px;' : ''}{anyPinned ? 'position: sticky; left: 0; z-index: 21;' : ''}"
                                        data-sui-data-table-select-all
                                >"""
assert old_sel_th in s, 'selection th anchor missing'
s = s.replace(old_sel_th, new_sel_th, 1)

# replace the header group loop with displayHeaders iteration
old_head = """                        {#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
                                <tr class={cn('border-b', gridMode && '[display:flex] w-full')}>"""
new_head = """                                <tr class={cn('border-b', gridMode && '[display:flex] w-full')">"""
assert old_head in s, 'header group anchor missing'
s = s.replace(old_head, new_head, 1)

old_each = """                        {#each headerGroup.headers as header (header.id)}
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
                                        )}"""
new_each = """                        {#each displayHeaders as header (header.id)}
                                {@const column = header.column}
                                {@const meta = (column.columnDef.meta ?? {}) as { align?: 'left' | 'center' | 'right'; width?: number }}
                                {@const pin = pinStyle(column.id, true)}
                                {@const edge = edgeSide(column.id)}
                                <th
                                        scope="col"
                                        data-sui-pin-edge={edge}
                                        style="{gridMode
                                                ? `display:flex; width:${header.getSize()}px;`
                                                : (meta.width ? `width:${meta.width}px;` : '')}{pin}"
                                        class={cn(
                                                'text-muted-foreground font-medium tracking-wide',
                                                CELL_SIZE[size].header,
                                                alignClass(meta.align),
                                                column.getCanSort() ? 'cursor-pointer select-none hover:text-foreground' : '',
                                                gridMode && 'border-b',
                                                pinClasses(column.id, true)
                                        )}"""
assert old_each in s, 'header each anchor missing'
s = s.replace(old_each, new_each, 1)

# close the removed outer each: the '</tr>\n                                {/each}\n                                        </thead>' pattern
old_close = """                                </tr>
                                        {/each}
                                </thead>"""
new_close = """                                </tr>
                                </thead>"""
assert old_close in s, 'header close anchor missing'
s = s.replace(old_close, new_close, 1)

# ---------- C. rows: group/row + data-selected + selection td sticky + ordered cells ----------
# grid (virtual) row
old = """                                                        <tr
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
                                                                        <td class="w-10 px-3" style="display:flex; align-items:center;">"""
new = """                                                        <tr
                                                                data-index={virtualRow.index}
                                                                data-selected={row.getIsSelected() || undefined}
                                                                use:measureRow
                                                                class={cn(
                                                                        'group/row hover:bg-muted/40 border-b transition-colors',
                                                                        row.getIsSelected() && 'bg-muted/50',
                                                                        onRowClick && 'cursor-pointer',
                                                                        '[display:flex] absolute w-full'
                                                                )}
                                                                style="transform: translateY({virtualRow.start}px);"
                                                                onclick={onRowClick ? () => onRowClick(row.original, virtualRow.index) : undefined}
                                                        >
                                                                {#if enableSelection}
                                                                        <td class="w-10 px-3 {anyPinned ? 'bg-background group-hover/row:bg-muted/50 group-data-[selected]/row:bg-muted/50' : ''}" style="display:flex; align-items:center;{anyPinned ? ' position: sticky; left: 0; z-index: 12;' : ''}">"""
assert old in s, 'grid row anchor missing'
s = s.replace(old, new, 1)

# grid cells
old = """                                                                {#each row.getVisibleCells() as cell (cell.id)}
                                                                        {@const meta = (cell.column.columnDef.meta ?? {}) as { align?: 'left' | 'center' | 'right'; class?: string }}
                                                                        <td
                                                                                style="display:flex; width:{cell.column.getSize()}px; align-items:center;"
                                                                                class={cn('truncate', CELL_SIZE[size].cell, alignClass(meta.align), meta.class)}
                                                                        >
                                                                                <FlexRender cell={cell} />
                                                                        </td>
                                                                {/each}"""
new = """                                                                {#each displayCells(row) as cell (cell.id)}
                                                                        {@const meta = (cell.column.columnDef.meta ?? {}) as { align?: 'left' | 'center' | 'right'; class?: string }}
                                                                        <td
                                                                                style="display:flex; width:{cell.column.getSize()}px; align-items:center;{pinStyle(cell.column.id, false)}"
                                                                                data-sui-pin-edge={edgeSide(cell.column.id)}
                                                                                class={cn('truncate', CELL_SIZE[size].cell, alignClass(meta.align), meta.class, pinClasses(cell.column.id, false))}
                                                                        >
                                                                                <FlexRender cell={cell} />
                                                                        </td>
                                                                {/each}"""
assert old in s, 'grid cells anchor missing'
s = s.replace(old, new, 1)

# normal row
old = """                                                {#each rows as row, index (row.id)}
                                                        <tr
                                                                class={cn(
                                                                        'hover:bg-muted/40 border-b transition-colors',
                                                                        row.getIsSelected() && 'bg-muted/50',
                                                                        onRowClick && 'cursor-pointer'
                                                                )}
                                                                onclick={onRowClick ? () => onRowClick(row.original, index) : undefined}
                                                        >
                                                                {#if enableSelection}
                                                                        <td class="w-10 px-3">"""
new = """                                                {#each rows as row, index (row.id)}
                                                        <tr
                                                                data-selected={row.getIsSelected() || undefined}
                                                                class={cn(
                                                                        'group/row hover:bg-muted/40 border-b transition-colors',
                                                                        row.getIsSelected() && 'bg-muted/50',
                                                                        onRowClick && 'cursor-pointer'
                                                                )}
                                                                onclick={onRowClick ? () => onRowClick(row.original, index) : undefined}
                                                        >
                                                                {#if enableSelection}
                                                                        <td class="w-10 px-3 {anyPinned ? 'bg-background group-hover/row:bg-muted/50 group-data-[selected]/row:bg-muted/50' : ''}" style="{anyPinned ? 'position: sticky; left: 0; z-index: 12;' : ''}">"""
assert old in s, 'normal row anchor missing'
s = s.replace(old, new, 1)

# normal cells
old = """                                                                {#each row.getVisibleCells() as cell (cell.id)}
                                                                        {@const meta = (cell.column.columnDef.meta ?? {}) as { align?: 'left' | 'center' | 'right'; class?: string }}
                                                                        <td class={cn('truncate', CELL_SIZE[size].cell, alignClass(meta.align), meta.class)}>
                                                                                <FlexRender cell={cell} />
                                                                        </td>
                                                                {/each}"""
new = """                                                                {#each displayCells(row) as cell (cell.id)}
                                                                        {@const meta = (cell.column.columnDef.meta ?? {}) as { align?: 'left' | 'center' | 'right'; class?: string }}
                                                                        <td
                                                                                data-sui-pin-edge={edgeSide(cell.column.id)}
                                                                                style="{pinStyle(cell.column.id, false)}"
                                                                                class={cn('truncate', CELL_SIZE[size].cell, alignClass(meta.align), meta.class, pinClasses(cell.column.id, false))}
                                                                        >
                                                                                <FlexRender cell={cell} />
                                                                        </td>
                                                                {/each}"""
assert old in s, 'normal cells anchor missing'
s = s.replace(old, new, 1)

f.write_text(s)
print('markup done')
