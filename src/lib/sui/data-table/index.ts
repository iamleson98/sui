import Root, { type SuiDataTableProps, type SuiDataTableSize } from './data-table.svelte';
import DataTableSkeleton from './data-table-skeleton.svelte';
import { renderComponent, renderSnippet } from '@tanstack/svelte-table';
import {
	suiColumn,
	SUI_TABLE_FEATURES,
	type SuiColumnMeta,
	type SuiDataTableColumn,
	type SuiTableFeatures
} from './columns.js';

export {
	Root as SuiDataTable,
	type SuiDataTableProps,
	type SuiDataTableSize,
	//
	DataTableSkeleton,
	DataTableSkeleton as SuiDataTableSkeleton,
	//
	suiColumn,
	renderComponent,
	renderSnippet,
	SUI_TABLE_FEATURES,
	type SuiColumnMeta,
	type SuiDataTableColumn,
	type SuiTableFeatures
};
