<script lang="ts">
	import Seo from '$lib/demo/seo.svelte';

	const basicCode = `const col = suiColumn<Person>();

const columns = [
  col.accessor('firstName', { header: 'First name' }),
  col.accessor('age', { header: 'Age', meta: { align: 'right' } }),
  col.display({
    id: 'status',
    header: 'Status',
    cell: ({ row }) => renderComponent(StatusBadge, { status: row.original.status })
  })
];

<SuiDataTable
  data={people}
  {columns}
  enableSelection
  searchable
  onRowClick={(row) => open(row.id)}
/>`;
</script>

<Seo path="/data-table" />

<!-- The TanStack-powered table demo is code-split: the ~110 KB engine
     (table-core + virtual) is fetched on demand, keeping this page's initial
     payload at intro-copy weight. The placeholder below is dependency-free
     inline markup. -->
<h1 class="mb-8 text-3xl font-bold tracking-tight">Data Table</h1>

{#await import('./-table-demos.svelte')}
	<!-- dependency-free placeholder while the table engine streams in -->
	<div class="space-y-8" role="status" aria-label="Loading data table demos">
		<div class="animate-pulse space-y-3">
			<div class="h-9 w-full rounded-md border bg-muted"></div>
			{#each Array(8) as _, i (i)}
				<div class="h-8 w-full rounded-md bg-muted"></div>
			{/each}
		</div>
		<div class="animate-pulse space-y-3">
			<div class="h-9 w-full rounded-md border bg-muted"></div>
			{#each Array(6) as _, i (i)}
				<div class="h-8 w-full rounded-md bg-muted"></div>
			{/each}
		</div>
	</div>
{:then TableDemos}
	<TableDemos.default {basicCode} />
{/await}
