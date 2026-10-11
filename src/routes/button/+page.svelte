<script lang="ts">
	import {
		SuiButton,
		SuiIconButton,
		SuiButtonSkeleton,
		SuiIconButtonSkeleton
	} from '$lib/sui/button/index.js';
	import Seo from '$lib/demo/seo.svelte';
	import CodeBlock from '$lib/demo/code-block.svelte';
	import Section from '$lib/demo/section.svelte';
	import SearchIcon from '@lucide/svelte/icons/search';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import TrashIcon from '@lucide/svelte/icons/trash';
	import CheckIcon from '@lucide/svelte/icons/check';
	import InfoIcon from '@lucide/svelte/icons/info';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';

	let loading = $state(false);
	let sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
	const tones = ['primary', 'secondary', 'outline', 'ghost', 'link'] as const;
	const colors = [
		{ color: 'info', label: 'Info', icon: InfoIcon },
		{ color: 'success', label: 'Success', icon: CheckIcon },
		{ color: 'warning', label: 'Warning', icon: TriangleAlertIcon },
		{ color: 'error', label: 'Error', icon: TrashIcon },
		{ color: '#7c3aed', label: 'Brand', icon: SparklesIcon }
	] as const;

	const colorsCode = `<!-- semantic colours, combined with any variant -->
<SuiButton color="success">Approve</SuiButton>
<SuiButton color="warning" variant="secondary">Review</SuiButton>
<SuiButton color="error" variant="outline">Reject</SuiButton>
<SuiButton color="info" variant="ghost">Details</SuiButton>

<!-- any CSS colour for brand buttons (a token works too: color="var(--brand)") -->
<SuiButton color="#7c3aed">Upgrade</SuiButton>

<!-- icon buttons take the same palette -->
<SuiIconButton icon={CheckIcon} label="Approve" color="success" variant="secondary" />`;

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

<!-- icon-only buttons are square at the same heights, every size -->
<SuiIconButton icon={TrashIcon} label="Delete" size="sm" />`;
</script>

<Seo path="/button" />

<h1 class="mb-8 text-3xl font-bold tracking-tight">Button</h1>

<Section title="Variants" description="Six variants on top of the shadcn button.">
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

<Section
	title="Colors"
	description="A color prop on top of every variant: the four semantic field colors or any CSS color. Soft, outline, ghost and link tones are derived from it, so custom colors look right in light and dark mode."
>
	<div class="overflow-x-auto">
		<div class="grid w-max grid-cols-[auto_repeat(5,minmax(0,1fr))] items-center gap-x-3 gap-y-3">
			<span></span>
			{#each colors as c (c.color)}
				<span class="font-mono text-[10px] text-muted-foreground">{c.label}</span>
			{/each}
			{#each tones as variant (variant)}
				<span class="pr-2 font-mono text-[10px] text-muted-foreground">{variant}</span>
				{#each colors as c (c.color)}
					<SuiButton {variant} color={c.color} startIcon={c.icon}>{c.label}</SuiButton>
				{/each}
			{/each}
			<span class="pr-2 font-mono text-[10px] text-muted-foreground">icon</span>
			{#each colors as c (c.color)}
				<div class="flex gap-2">
					<SuiIconButton icon={c.icon} label={c.label} color={c.color} variant="primary" />
					<SuiIconButton icon={c.icon} label={c.label} color={c.color} variant="secondary" />
					<SuiIconButton icon={c.icon} label={c.label} color={c.color} variant="outline" />
				</div>
			{/each}
		</div>
	</div>
	<div class="mt-8">
		<CodeBlock code={colorsCode} />
	</div>
</Section>

<Section
	title="Icons & loading"
	description="startIcon / endIcon components, loading state, and square icon buttons with the same height scale."
>
	<div class="flex flex-wrap items-center gap-3">
		<SuiButton startIcon={PlusIcon}>New project</SuiButton>
		<SuiButton variant="outline" endIcon={DownloadIcon}>Export</SuiButton>
		<SuiButton
			{loading}
			onclick={() => {
				loading = true;
				setTimeout(() => (loading = false), 1500);
			}}
		>
			Save changes
		</SuiButton>
		<SuiIconButton icon={SearchIcon} label="Search" variant="outline" />
		<SuiIconButton icon={TrashIcon} label="Delete" variant="ghost" />
	</div>
	<div class="mt-8">
		<CodeBlock code={iconsCode} />
	</div>
</Section>

<Section
	title="Sizes"
	description="One shared scale — an sm button is exactly as tall as an sm input or select trigger."
>
	<!-- buttons and icon buttons share the scale: same height per size -->
	<div class="flex flex-wrap items-end gap-5">
		{#each sizes as size (size)}
			<div class="flex flex-col items-center gap-2" data-size-sample={size}>
				<div class="flex items-center gap-2">
					<SuiButton {size} startIcon={PlusIcon}>Add</SuiButton>
					<SuiIconButton icon={TrashIcon} label="Delete" {size} variant="outline" />
				</div>
				<span class="font-mono text-[10px] text-muted-foreground">{size}</span>
			</div>
		{/each}
	</div>
	<div class="mt-8">
		<CodeBlock code={sizesCode} />
	</div>
</Section>

<Section title="Skeletons" description="Size-matched placeholders while actions load.">
	<div class="flex flex-wrap items-center gap-3">
		{#each sizes as size (size)}
			<div class="flex items-center gap-2">
				<SuiButtonSkeleton {size} />
				<SuiIconButtonSkeleton {size} />
			</div>
		{/each}
	</div>
</Section>
