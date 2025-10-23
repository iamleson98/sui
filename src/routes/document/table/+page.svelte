<script lang="ts">
	import { Button } from '$lib/Button/index.js';
	import { Checkbox } from '$lib/Input/index.js';
	import { Table } from '$lib/Table/index.js';
	import { toast } from 'svelte-sonner';

	let disabledTable = $state(false);
	let disabledGraphqlTable = $state(false);
	let sortMultipleTable = $state(false);
	let sortMultipleGraphqlTable = $state(false);


	const handleCopyNormalTable = () => {
		const code = `<Table
			disabled={${disabledTable}}
			items={[]}
			columns={PRODUCT_COLUMNS}
			sortMultiple={${sortMultipleTable}}
		/>`;

		navigator.clipboard.writeText(code).then(() => {
			toast.success(`Copied code: ${code}`);
		});
	};

	const handleCopyGraphqlTable = () => {
		const code = `<GraphqlPaginableTable
			query={PRODUCT_LIST_QUERY}
			variables={{ first: 10 }}
			resultKey={'products' as keyof Query}
			columns={PRODUCT_COLUMNS}
			disabled={${disabledGraphqlTable}}
			sortMultiple={${sortMultipleGraphqlTable}}
			forceReExecuteGraphqlQuery={true}
		/>`;

		navigator.clipboard.writeText(code).then(() => {
			toast.success(`Copied code: ${code}`);
		});
	};
</script>

<div class="rounded-md p-4 bg-white border mb-4">
	<h2 class="text-lg font-semibold mb-2">Normal Table</h2>
	<div class="flex gap-4 mb-2">
		<Checkbox bind:checked={disabledTable} label="Disabled" />
		<Checkbox bind:checked={sortMultipleTable} label="Sort Multiple" />
	</div>
	<Table
		items={[]}
		columns={[]}
		disabled={disabledTable}
		sortMultiple={sortMultipleTable}
	/>
	<Button class="mt-2" onclick={handleCopyNormalTable}>Copy Normal Table</Button>
</div>

<div class="rounded-md p-4 bg-white border">
	<h2 class="text-lg font-semibold mb-2">GraphQL Table</h2>
	<div class="flex gap-4 mb-2">
		<Checkbox bind:checked={disabledGraphqlTable} label="Disabled" />
		<Checkbox bind:checked={sortMultipleGraphqlTable} label="Sort Multiple" />
	</div>
	<Button class="mt-2" onclick={handleCopyGraphqlTable}>Copy GraphQL Table</Button>
</div>
