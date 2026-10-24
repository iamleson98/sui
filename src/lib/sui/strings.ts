import { getContext, hasContext, setContext } from 'svelte';

/**
 * Every piece of UI copy sui renders on its own — placeholders, loading
 * and empty states, button labels, screen-reader text. Override any subset
 * with {@link setSuiStrings} (i18n / house style); props such as
 * `placeholder` or `emptyText` still win per instance.
 */
export type SuiStrings = {
	/**
	 * BCP 47 locale for date/time formatting — segment order, month and
	 * weekday names, 12/24-hour clock (`'en-US'`, `'de-DE'`, `'vi-VN'`…).
	 */
	locale: string;
	/** Date/time pickers: calendar button. */
	openCalendar: string;
	/** Time pickers: time-slot list button. */
	chooseTime: string;
	/** Date pickers: "today" shortcut in the calendar. */
	today: string;
	/** Select/combobox/multi-select trigger placeholder. */
	selectPlaceholder: string;
	/** Search input placeholder (combobox, multi-select, data table). */
	searchPlaceholder: string;
	/** Empty state of a select with no options. */
	noOptions: string;
	/** Empty state of a searchable list with no matches. */
	noResults: string;
	/** A `source` request failed. */
	loadError: string;
	/** Retry button after a failed `source` request. */
	retry: string;
	/** First page / table loading state. */
	loading: string;
	/** Next page loading state. */
	loadingMore: string;
	/** Clear (✕) button of select/combobox. */
	clearSelection: string;
	/** Clear (✕) button of multi-select. */
	clearAll: string;
	/** Tree select: button that opens a branch (label of the branch). */
	expandNode: (label: string) => string;
	/** Tree select: button that closes a branch (label of the branch). */
	collapseNode: (label: string) => string;
	/** Screen-reader description of a mobile single-choice sheet. */
	chooseOption: string;
	/** Screen-reader description of a mobile multi-choice sheet. */
	chooseOptions: string;
	/** Chip remove button label. */
	removeItem: (label: string) => string;
	/** "+n" overflow chip label. */
	showMore: (count: number, labels: string[]) => string;
	/** Collapse control of an expanded chip list. */
	showLess: string;
	/** Async validation in progress (form `checkingMessage` wins). */
	checking: string;
	/** `<SuiForm>` banner title. */
	formErrorTitle: string;
	/** `<SuiErrorSummary>` title. */
	errorSummaryTitle: string;
	/** Data table: CSV export button. */
	tableExport: string;
	/** Data table: CSV export button accessible label. */
	tableExportLabel: string;
	/** Data table: column visibility menu button. */
	tableColumns: string;
	/** Data table: column visibility menu button accessible label. */
	tableColumnsLabel: string;
	/** Data table: column visibility menu heading. */
	tableVisibleColumns: string;
	/** Data table: empty state. */
	tableEmpty: string;
	/** Data table: row count. */
	tableRowCount: (count: number) => string;
	/** Data table: selection count. */
	tableSelectedCount: (selected: number, total: number) => string;
	/** Data table: page-size picker label. */
	tableRowsPerPage: string;
	/** Data table: page-size picker visible caption. */
	tableRowsCaption: string;
	/** Data table: previous page button. */
	tablePreviousPage: string;
	/** Data table: next page button. */
	tableNextPage: string;
	/** Data table: select-all checkbox. */
	tableSelectAll: string;
	/** Data table: row checkbox (1-based row number on the page). */
	tableSelectRow: (row: number) => string;
	/** Skeleton container live-region text. */
	skeletonLoading: string;
};

/** The built-in (English) copy. */
export const SUI_STRINGS: Readonly<SuiStrings> = Object.freeze({
	locale: 'en-US',
	openCalendar: 'Open calendar',
	chooseTime: 'Choose a time',
	today: 'Today',
	selectPlaceholder: 'Select…',
	searchPlaceholder: 'Search…',
	noOptions: 'No options',
	noResults: 'No results',
	expandNode: (label) => `Show what is under ${label}`,
	collapseNode: (label) => `Hide what is under ${label}`,
	loadError: 'Failed to load options',
	retry: 'Try again',
	loading: 'Loading…',
	loadingMore: 'Loading more…',
	clearSelection: 'Clear selection',
	clearAll: 'Clear all',
	chooseOption: 'Choose an option',
	chooseOptions: 'Choose options',
	removeItem: (label) => `Remove ${label}`,
	showMore: (count, labels) => `Show ${count} more selected: ${labels.join(', ')}`,
	showLess: 'Show less',
	checking: 'Checking…',
	formErrorTitle: 'There is a problem:',
	errorSummaryTitle: 'Please fix the following:',
	tableExport: 'Export',
	tableExportLabel: 'Download the filtered rows as CSV',
	tableColumns: 'Columns',
	tableColumnsLabel: 'Toggle columns',
	tableVisibleColumns: 'Visible columns',
	tableEmpty: 'No data',
	tableRowCount: (count) => `${count} rows`,
	tableSelectedCount: (selected, total) => `${selected} of ${total} selected`,
	tableRowsPerPage: 'Rows per page',
	tableRowsCaption: 'Rows',
	tablePreviousPage: 'Previous page',
	tableNextPage: 'Next page',
	tableSelectAll: 'Select all rows',
	tableSelectRow: (row) => `Select row ${row}`,
	skeletonLoading: 'Loading'
});

const KEY = Symbol('sui-strings');

/**
 * Override sui's UI copy for this component's subtree (call it during
 * component initialisation — typically in the root `+layout.svelte`).
 * Nested calls layer over their parent; unspecified keys fall through.
 *
 * Pass a function to stay reactive — it is re-read on every access, so a
 * locale switch re-renders the copy:
 *
 * ```svelte
 * <script lang="ts">
 *   import { setSuiStrings } from '$lib/sui';
 *   import * as m from '$lib/paraglide/messages';
 *
 *   setSuiStrings(() => ({ loading: m.loading(), noResults: m.no_results() }));
 * </script>
 * ```
 */
export function setSuiStrings(overrides: Partial<SuiStrings> | (() => Partial<SuiStrings>)): void {
	const parent = getSuiStrings();
	const read = typeof overrides === 'function' ? overrides : () => overrides;
	const layered = {} as SuiStrings;
	for (const key of Object.keys(SUI_STRINGS) as (keyof SuiStrings)[]) {
		Object.defineProperty(layered, key, {
			enumerable: true,
			get: () => read()[key] ?? parent[key]
		});
	}
	setContext(KEY, layered);
}

/**
 * The copy in effect for the calling component (call during component
 * initialisation). Falls back to {@link SUI_STRINGS} outside any
 * {@link setSuiStrings} scope.
 */
export function getSuiStrings(): SuiStrings {
	return hasContext(KEY) ? getContext<SuiStrings>(KEY) : SUI_STRINGS;
}
