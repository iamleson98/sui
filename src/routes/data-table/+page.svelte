<script lang="ts">
	import { SuiDataTable, suiColumn, renderComponent, type SuiDataTableSize, type SuiDataTableColumn } from '$lib/sui';
	import CodeBlock from '$lib/demo/code-block.svelte';
	import Section from '$lib/demo/section.svelte';
	import StatusBadge from '$lib/demo/status-badge.svelte';
	import ProgressBar from '$lib/demo/progress-bar.svelte';

	type Person = {
		id: string;
		firstName: string;
		lastName: string;
		email: string;
		age: number;
		visits: number;
		status: 'single' | 'relationship' | 'complicated';
		progress: number;
	};

	const col = suiColumn<Person>();

	// NOTE: plain tsc finds the helper output assignable to SuiDataTableColumn,
	// but svelte2tsx (svelte-check) mishandles the intersection type — a single
	// trailing cast keeps both worlds happy.
	const columns = [
		col.accessor('firstName', { header: 'First name' }),
		col.accessor('lastName', { header: 'Last name' }),
		col.accessor('email', { header: 'Email' }),
		col.accessor('age', { header: 'Age', meta: { align: 'right' } }),
		col.accessor('visits', { header: 'Visits', meta: { align: 'right' } }),
		col.display({
			id: 'status',
			header: 'Status',
			cell: ({ row }) => renderComponent(StatusBadge, { status: row.original.status })
		}),
		col.accessor('progress', {
			header: 'Progress',
			cell: (info) => renderComponent(ProgressBar, { value: info.getValue() })
		})
	] as SuiDataTableColumn<Person>[];

	function makeRows(count: number, offset = 0): Person[] {
		const first = ['Minh', 'Lena', 'Jonas', 'Aiko', 'Priya', 'Marco', 'Sofia', 'Kai', 'Nora', 'Omar'];
		const last = ['Nguyen', 'Schmidt', 'Tanaka', 'Patel', 'Rossi', 'Silva', 'Okafor', 'Novak'];
		return Array.from({ length: count }, (_, i) => {
			const n = offset + i;
			return {
				id: `p-${n}`,
				firstName: first[n % first.length]!,
				lastName: last[(n * 3) % last.length]!,
				email: `user${n}@example.com`,
				age: 20 + ((n * 13) % 45),
				visits: (n * 17) % 500,
				status: (['single', 'relationship', 'complicated'] as const)[n % 3]!,
				progress: (n * 37) % 101
			};
		});
	}

	const small = $state.raw(makeRows(23));
	const big = $state.raw(makeRows(10_000));

	let size = $state<SuiDataTableSize>('md');
	const densityOptions: SuiDataTableSize[] = ['sm', 'md', 'lg'];
	let selected = $state<Person[]>([]);
	let clicked = $state<Person | undefined>(undefined);

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

<svelte:head><title>Data Table · sui</title></svelte:head>

<h1 class="mb-8 text-3xl font-bold tracking-tight">Data Table</h1>

<Section title="Everything at once" description="Sorting (click headers), global search, column visibility menu, row selection, pagination and density — on 23 rows.">
	<div class="mb-3 flex items-center gap-2">
		<span class="text-muted-foreground text-sm">Density:</span>
		{#each densityOptions as s (s)}
			<button
				class="rounded-md border px-2 py-1 text-xs {s === size ? 'bg-primary text-primary-foreground border-primary' : ''}"
				onclick={() => (size = s)}
			>
				{s}
			</button>
		{/each}
		{#if clicked}
			<span class="text-muted-foreground ml-3 text-xs">Last clicked: <strong>{clicked.firstName} {clicked.lastName}</strong></span>
		{/if}
	</div>
	<SuiDataTable
		data={small}
		{columns}
		{size}
		rowId={(row) => row.id}
		enableSelection
		searchable
		onRowClick={(row) => (clicked = row)}
		onSelectionChange={(rows) => (selected = rows)}
	/>
	{#if selected.length}
		<p class="text-muted-foreground mt-2 text-xs">{selected.length} selected: {selected.map((r) => r.firstName).join(', ')}</p>
	{/if}
	<div class="mt-8">
		<CodeBlock code={basicCode} />
	</div>
</Section>

<Section title="Virtual scrolling — 10,000 rows" description="TanStack Virtual only renders the visible window (plus overscan). Sorting and selection keep working across the whole set. Scroll to feel it.">
	<SuiDataTable data={big} {columns} size="sm" rowId={(row) => row.id} enableSelection maxHeight={420} pageSize={50} />
</Section>

<Section title="Custom columns" description="Columns support meta options for alignment, width, extra classes and hiddenByDefault. Try hiding the email column from the Columns menu, then re-enable it.">
	<SuiDataTable
		data={small}
		columns={[
			col.accessor('firstName', { header: 'First name' }),
			col.accessor('email', { header: 'Email', meta: { hiddenByDefault: true } }),
			col.accessor('age', { header: 'Age', meta: { align: 'right', width: 72 } })
		] as SuiDataTableColumn<Person>[]}
		size="sm"
		pagination="none"
	/>
</Section>
