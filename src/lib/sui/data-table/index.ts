import Root, { type SuiDataTableProps } from './data-table.svelte';
import DataTableSkeleton from './data-table-skeleton.svelte';
import {
	suiColumn,
	SUI_TABLE_FEATURES,
	type SuiColumnMeta,
	type SuiDataTableColumn,
	type SuiTableFeatures
} from './columns.js';

export {
	Root,
	Root as SuiDataTable,
	type SuiDataTableProps,
	//
	DataTableSkeleton,
	DataTableSkeleton as SuiDataTableSkeleton,
	//
	suiColumn,
	SUI_TABLE_FEATURES,
	type SuiColumnMeta,
	type SuiDataTableColumn,
	type SuiTableFeatures
};
