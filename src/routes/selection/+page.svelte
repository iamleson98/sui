<script lang="ts">
	import {
		SuiSelect,
		SuiCombobox,
		SuiMultiSelect,
		SuiSelectSkeleton,
		SuiComboboxSkeleton,
		SuiMultiSelectSkeleton,
		cursorSource,
		offsetSource,
		type SuiItem,
		type SuiSource
	} from '$lib/sui';
	import CodeBlock from '$lib/demo/code-block.svelte';
	import Section from '$lib/demo/section.svelte';
	import { z } from 'zod';
	import UserIcon from '@lucide/svelte/icons/user';
	import PackageIcon from '@lucide/svelte/icons/package';

	let country = $state<string | undefined>(undefined);
	let assignee = $state<string | undefined>(undefined);
	let products = $state<string[]>(['sku-1000']);
	let tags = $state<string[]>([]);

	const countries: SuiItem[] = [
		{ value: 'nl', label: 'Netherlands', description: 'Europe' },
		{ value: 'vn', label: 'Vietnam', description: 'Asia' },
		{ value: 'de', label: 'Germany', description: 'Europe' },
		{ value: 'us', label: 'United States', description: 'Americas' },
		{ value: 'jp', label: 'Japan', description: 'Asia' }
	];

	const countrySchema = z.string().min(1, 'Pick a country');
	const assigneeSchema = z.string().min(1, 'Assign an owner');

	const tagOptions: SuiItem[] = [
		{ value: 'bug', label: 'Bug' },
		{ value: 'feature', label: 'Feature' },
		{ value: 'docs', label: 'Docs' },
		{ value: 'infra', label: 'Infra' },
		{ value: 'design', label: 'Design' },
		{ value: 'security', label: 'Security' },
		{ value: 'perf', label: 'Performance' }
	];

	/** Cursor REST source — the recommended infinite-scroll pattern. */
	const usersSource: SuiSource<SuiItem> = cursorSource(async ({ cursor, size, query, signal }) => {
		const params = new URLSearchParams({ size: String(size) });
		if (cursor) params.set('cursor', cursor);
		if (query) params.set('q', query);
		const res = await fetch(`/api/users?${params}`, { signal });
		const body = await res.json();
		return { items: body.items, nextCursor: body.nextCursor };
	});

	/** Offset REST source — works with classic page/size endpoints. */
	const productsSource: SuiSource<SuiItem> = offsetSource(async ({ page, size, query, signal }) => {
		const params = new URLSearchParams({ page: String(page), size: String(size) });
		if (query) params.set('q', query);
		const res = await fetch(`/api/products?${params}`, { signal });
		const body = await res.json();
		return { items: body.items, total: body.total };
	});

	const staticCode = `<SuiSelect
  label="Country"
  items={countries}
  startIcon={MapIcon}
  clearable
  schema={z.string().min(1, 'Pick a country')}
  bind:value={country}
/>`;

	const infiniteCode = `const users: SuiSource<SuiItem> = cursorSource(
  async ({ cursor, size, query, signal }) => {
    const params = new URLSearchParams({ size: String(size) });
    if (cursor) params.set('cursor', cursor);
    if (query) params.set('q', query);
    const res = await fetch('/api/users?' + params, { signal });
    const body = await res.json();
    return { items: body.items, nextCursor: body.nextCursor };
  }
);

<SuiCombobox
  label="Owner"
  source={users}
  pageSize={25}
  searchable
  clearable
  bind:value={assignee}
/>`;

	const multiCode = `<SuiMultiSelect
  label="Products"
  source={productsSource}
  pageSize={20}
  maxDisplay={3}
  clearable
  bind:value={products}
/>`;
</script>

<svelte:head><title>Selection · sui</title></svelte:head>

<h1 class="mb-8 text-3xl font-bold tracking-tight">Select · Combobox · MultiSelect</h1>

<Section title="Select — static items" description="A single-line select with label, leading icon, clear button and zod validation.">
	<div class="grid max-w-lg gap-6">
		<SuiSelect
			label="Country"
			placeholder="Choose a country…"
			items={countries}
			startIcon={UserIcon}
			clearable
			required
			schema={countrySchema}
			bind:value={country}
		/>
		{#if country}
			<p class="text-muted-foreground text-sm">Bound value: <code class="bg-muted rounded px-1 py-0.5">{country}</code></p>
		{/if}
	</div>
	<div class="mt-8">
		<CodeBlock code={staticCode} />
	</div>
</Section>

<Section title="Combobox — searchable, infinite scroll" description="Loads 25 users at a time from a cursor REST endpoint. Scroll to the bottom of the dropdown to stream the next page; type to search server-side. The list keeps 512 rows snappy.">
	<div class="grid max-w-lg gap-6">
		<SuiCombobox
			label="Owner"
			placeholder="Search users…"
			searchPlaceholder="Type to filter…"
			source={usersSource}
			pageSize={25}
			clearable
			schema={assigneeSchema}
			bind:value={assignee}
		/>
		{#if assignee}
			<p class="text-muted-foreground text-sm">Bound value: <code class="bg-muted rounded px-1 py-0.5">{assignee}</code></p>
		{/if}
	</div>
	<div class="mt-8">
		<CodeBlock title="source + combobox" code={infiniteCode} />
	</div>
</Section>

<Section title="MultiSelect — badges + offset pagination" description="Selected values render as badges with per-badge remove; overflow collapses into “+n”. This one pages through an offset-style REST endpoint and dedupes across page boundaries.">
	<div class="grid max-w-lg gap-6">
		<SuiMultiSelect
			label="Products"
			placeholder="Pick products…"
			source={productsSource}
			pageSize={20}
			maxDisplay={3}
			clearable
			startIcon={PackageIcon}
			bind:value={products}
		/>
		<SuiMultiSelect
			label="Tags (static)"
			placeholder="Pick tags…"
			items={tagOptions}
			maxDisplay={2}
			bind:value={tags}
		/>
		<p class="text-muted-foreground text-sm">Selected: <code class="bg-muted rounded px-1 py-0.5">{products.join(', ') || '—'}</code></p>
	</div>
	<div class="mt-8">
		<CodeBlock code={multiCode} />
	</div>
</Section>

<Section title="Skeletons" description="Each selection control ships a skeleton with the exact same size classes as the real control.">
	<div class="grid max-w-lg gap-6">
		<SuiSelectSkeleton size="md" label={true} />
		<SuiComboboxSkeleton size="md" label={true} />
		<SuiMultiSelectSkeleton size="md" label={true} badges={3} />
	</div>
</Section>
