<script lang="ts">
	/**
	 * The footer of a paged `SuiDataTable`: what is shown ("1–20 of 245"), how
	 * many rows a page holds, and numbered pages with previous / next.
	 * Numbers give way to "2 / 13" on a phone. The page size is a small
	 * `SuiSelect`, like every other picker.
	 */
	import SuiButton from '../button/button.svelte';
	import SuiIconButton from '../button/icon-button.svelte';
	import SuiSelect from '../select/select.svelte';
	import { getSuiStrings } from '../strings.js';
	import { pageWindow } from './page-window.js';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';

	type Props = {
		/** What the footer says on the left. */
		summary: string;
		/** Zero-based current page. */
		pageIndex: number;
		/** Pages in all; `-1` when the total is not known. */
		pageCount: number;
		pageSize: number;
		pageSizeOptions: number[];
		/** Offer the page-size picker (there is something to page). */
		pickSize: boolean;
		onPage: (index: number) => void;
		onPageSize: (size: number) => void;
	};

	let {
		summary,
		pageIndex,
		pageCount,
		pageSize,
		pageSizeOptions,
		pickSize,
		onPage,
		onPageSize
	}: Props = $props();

	const strings = $derived(getSuiStrings());
	const known = $derived(pageCount >= 0);
	const window = $derived(known ? pageWindow(pageIndex, pageCount) : []);
	// A size in use that the options do not list (a consumer's own default) is
	// still choosable, in its place.
	const sizes = $derived(
		pageSizeOptions.includes(pageSize)
			? pageSizeOptions
			: [...pageSizeOptions, pageSize].sort((a, b) => a - b)
	);
</script>

<div
	class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t bg-muted/30 px-4 py-3 text-sm"
	data-sui-data-table-footer
>
	<span class="text-muted-foreground tabular-nums" data-sui-data-table-count>{summary}</span>

	<div class="ml-auto flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
		{#if pickSize}
			<div class="flex items-center gap-2 text-muted-foreground" data-sui-data-table-page-size>
				<span class="hidden sm:inline">{strings.tableRowsCaption}</span>
				<SuiSelect
					size="xs"
					class="w-16"
					items={sizes.map((option) => ({ value: String(option), label: String(option) }))}
					value={String(pageSize)}
					aria-label={strings.tableRowsPerPage}
					onSelect={(value) => value && onPageSize(Number(value))}
				/>
			</div>
		{/if}

		<nav class="flex items-center gap-1" aria-label={strings.tablePagination}>
			<SuiIconButton
				icon={ChevronLeftIcon}
				label={strings.tablePreviousPage}
				variant="ghost"
				size="sm"
				disabled={pageIndex <= 0}
				onclick={() => onPage(pageIndex - 1)}
			/>
			<span class="px-2 text-muted-foreground tabular-nums sm:hidden" data-sui-data-table-page>
				{pageCount === 0 ? 0 : pageIndex + 1} / {known ? pageCount : '…'}
			</span>
			<ol class="hidden items-center gap-1 sm:flex">
				{#if known}
					{#each window as item, slot (slot)}
						<li>
							{#if item === null}
								<span class="px-1.5 text-muted-foreground" aria-hidden="true">…</span>
							{:else}
								<SuiButton
									size="sm"
									variant="outline"
									class={item === pageIndex
										? 'min-w-8 border-foreground bg-foreground px-2 text-background tabular-nums hover:bg-foreground/90 hover:text-background'
										: 'min-w-8 px-2 tabular-nums'}
									aria-label={strings.tablePage(item + 1)}
									aria-current={item === pageIndex ? 'page' : undefined}
									onclick={() => onPage(item)}>{item + 1}</SuiButton
								>
							{/if}
						</li>
					{/each}
				{:else}
					<li class="px-2 tabular-nums">{pageIndex + 1}</li>
				{/if}
			</ol>
			<SuiIconButton
				icon={ChevronRightIcon}
				label={strings.tableNextPage}
				variant="ghost"
				size="sm"
				disabled={known ? pageIndex >= pageCount - 1 : false}
				onclick={() => onPage(pageIndex + 1)}
			/>
		</nav>
	</div>
</div>
