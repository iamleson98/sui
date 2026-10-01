<script lang="ts">
	import { SuiButton } from '$lib/sui/button/index.js';
	import CodeBlock from '$lib/demo/code-block.svelte';
	import Seo from '$lib/demo/seo.svelte';
	import { SITE_DESCRIPTION } from '$lib/demo/site';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import ZapIcon from '@lucide/svelte/icons/zap';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import InfinityIcon from '@lucide/svelte/icons/infinity';
	import TableIcon from '@lucide/svelte/icons/table';
	import BoneIcon from '@lucide/svelte/icons/bone';

	const quickStart = `npm install zod @tanstack/svelte-table @tanstack/svelte-virtual

# then copy src/lib/sui into your project (shadcn-style source ownership),
# or depend on this repo as a library.`;

	const oneLiner = `<SuiSelect
  label="Country"
  items={[{ value: 'nl', label: 'Netherlands' }, { value: 'vn', label: 'Vietnam' }]}
  schema={z.string().min(1, 'Pick a country')}
  bind:value={country}
/>`;

	const features = [
		{
			icon: ZapIcon,
			title: 'One-liner fields',
			body: 'Labels, sub-text, required markers, icons and actions are props — no boilerplate wrappers.'
		},
		{
			icon: ShieldCheckIcon,
			title: 'zod v4 validation',
			body: 'Pass a schema to any field. Errors render inline with ARIA wiring and error styling.'
		},
		{
			icon: InfinityIcon,
			title: 'Infinite scroll',
			body: 'Selects, comboboxes and multi-selects stream pages from any REST API — cursor or offset.'
		},
		{
			icon: TableIcon,
			title: 'Virtual data table',
			body: 'TanStack Table v9 + virtual scrolling, sorting, column toggles, pagination and selection.'
		},
		{
			icon: BoneIcon,
			title: 'Matched skeletons',
			body: 'Every control has a size-matched skeleton with an optional label placeholder.'
		}
	];
	const jsonLd = JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'SoftwareApplication',
		name: 'sui',
		description: SITE_DESCRIPTION,
		applicationCategory: 'DeveloperApplication',
		operatingSystem: 'Web',
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
	});
</script>

<Seo path="/" />
<svelte:head>
	<!-- {@html}: script content is raw text in HTML; Svelte's text escaping
	would corrupt the JSON, {@html} keeps it verbatim -->
	{@html `<script type="application/ld+json">${jsonLd}</` + 'script>'}
</svelte:head>

<div class="flex flex-col items-center py-8 text-center">
	<span class="bg-primary/10 text-primary mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
		Svelte 5 · shadcn-svelte · Tailwind v4
	</span>
	<h1 class="max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
		Forms and tables that stay out of your way
	</h1>
	<p class="text-muted-foreground mt-4 max-w-2xl text-base text-pretty sm:text-lg">
		sui wraps shadcn-svelte with the glue you write every day: labels, sizes, validation,
		infinite scrolling and loading states — all with one consistent, minimal API.
	</p>
	<div class="mt-6 flex flex-wrap items-center justify-center gap-3">
		<a href="/selection"><SuiButton size="lg" endIcon={ArrowRightIcon}>Explore components</SuiButton></a>
		<a href="/validation"><SuiButton size="lg" variant="outline">Validation demo</SuiButton></a>
	</div>
</div>

<div class="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
	{#each features as feature (feature.title)}
		<div class="bg-card rounded-lg border p-4">
			<feature.icon class="text-primary mb-2 size-5" aria-hidden="true" />
			<div class="text-sm font-medium">{feature.title}</div>
			<p class="text-muted-foreground mt-1 text-xs leading-relaxed">{feature.body}</p>
		</div>
	{/each}
</div>

<div class="grid gap-8 lg:grid-cols-2">
	<CodeBlock title="Quick start" code={quickStart}>
		<h3 class="text-lg font-semibold">Get started</h3>
	</CodeBlock>
	<CodeBlock title="One-liner select with validation" code={oneLiner}>
		<h3 class="text-lg font-semibold">Why it exists</h3>
	</CodeBlock>
</div>
