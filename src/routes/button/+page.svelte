<script lang="ts">
	import { SuiButton, SuiIconButton, SuiButtonSkeleton, SuiIconButtonSkeleton } from '$lib/sui';
	import CodeBlock from '$lib/demo/code-block.svelte';
	import Section from '$lib/demo/section.svelte';
	import SearchIcon from '@lucide/svelte/icons/search';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import TrashIcon from '@lucide/svelte/icons/trash';

	let loading = $state(false);
	let sizes = (['xs', 'sm', 'md', 'lg', 'xl'] as const);

	const variantsCode = `<SuiButton>Save</SuiButton>
<SuiButton variant="secondary">Cancel</SuiButton>
<SuiButton variant="outline">Import</SuiButton>
<SuiButton variant="ghost">Skip</SuiButton>
<SuiButton variant="destructive">Delete</SuiButton>
<SuiButton variant="link">Learn more</SuiButton>`;

	const iconsCode = `<SuiButton startIcon={PlusIcon}>New project</SuiButton>
<SuiButton endIcon={DownloadIcon} variant="outline">Export</SuiButton>
<SuiButton loading={saving} onClick={save}>Save</SuiButton>
<SuiIconButton icon={SearchIcon} label="Search" variant="outline" />`;

	const sizesCode = `{#each ['xs', 'sm', 'md', 'lg', 'xl'] as size}
  <SuiButton {size}>{size}</SuiButton>
{/each}

<!-- icon-only buttons are square at the same heights -->
<SuiIconButton icon={TrashIcon} label="Delete" size="sm" />`;
</script>

<svelte:head><title>Button · sui</title></svelte:head>

<h1 class="mb-8 text-3xl font-bold tracking-tight">Button</h1>

<Section title="Variants" description="Six semantic variants on top of the shadcn button.">
	<div class="flex flex-wrap items-center gap-3">
		<SuiButton>Primary</SuiButton>
		<SuiButton variant="secondary">Secondary</SuiButton>
		<SuiButton variant="outline">Outline</SuiButton>
		<SuiButton variant="ghost">Ghost</SuiButton>
		<SuiButton variant="destructive">Destructive</SuiButton>
		<SuiButton variant="link">Link</SuiButton>
	</div>
	<div class="mt-8">
		<CodeBlock code={variantsCode} />
	</div>
</Section>

<Section title="Icons & loading" description="startIcon / endIcon components, loading state, and square icon buttons with the same height scale.">
	<div class="flex flex-wrap items-center gap-3">
		<SuiButton startIcon={PlusIcon}>New project</SuiButton>
		<SuiButton variant="outline" endIcon={DownloadIcon}>Export</SuiButton>
		<SuiButton loading={loading} onclick={() => { loading = true; setTimeout(() => (loading = false), 1500); }}>
			Save changes
		</SuiButton>
		<SuiIconButton icon={SearchIcon} label="Search" variant="outline" />
		<SuiIconButton icon={TrashIcon} label="Delete" variant="ghost" />
	</div>
	<div class="mt-8">
		<CodeBlock code={iconsCode} />
	</div>
</Section>

<Section title="Sizes" description="One shared scale — an sm button is exactly as tall as an sm input or select trigger.">
	<div class="flex flex-wrap items-end gap-3">
		{#each sizes as size (size)}
			<div class="flex flex-col items-center gap-2">
				<SuiButton {size}>{size}</SuiButton>
				<span class="text-muted-foreground text-[10px] font-mono">{size}</span>
			</div>
		{/each}
		<div class="flex items-end gap-3 border-l pl-3">
			{#each (['sm', 'md', 'lg'] as const) as size (size)}
				<SuiIconButton icon={TrashIcon} label="Delete" {size} variant="outline" />
			{/each}
		</div>
	</div>
	<div class="mt-8">
		<CodeBlock code={sizesCode} />
	</div>
</Section>

<Section title="Skeletons" description="Size-matched placeholders while actions load.">
	<div class="flex flex-wrap items-center gap-3">
		{#each sizes as size (size)}
			<SuiButtonSkeleton {size} />
		{/each}
		<SuiIconButtonSkeleton size="sm" />
	</div>
</Section>
