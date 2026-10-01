<script lang="ts">
	import Seo from '$lib/demo/seo.svelte';
	import { SuiButtonSkeleton, SuiIconButtonSkeleton } from '$lib/sui/button/index.js';
	import { SuiInputSkeleton, SuiTextareaSkeleton } from '$lib/sui/input/index.js';
	import { SuiSelectSkeleton } from '$lib/sui/select/index.js';
	import { SuiComboboxSkeleton } from '$lib/sui/combobox/index.js';
	import { SuiMultiSelectSkeleton } from '$lib/sui/multi-select/index.js';
	import { SuiCheckboxSkeleton } from '$lib/sui/checkbox/index.js';
	import { SuiRadioSkeleton } from '$lib/sui/radio-group/index.js';
	import { SuiSwitchSkeleton } from '$lib/sui/switch/index.js';
	import { SuiDataTableSkeleton } from '$lib/sui/data-table/index.js';
	import Section from '$lib/demo/section.svelte';
</script>

<Seo path="/skeletons" />

<h1 class="mb-8 text-3xl font-bold tracking-tight">Skeletons</h1>

<Section title="Loading states that match" description="Every control has a skeleton using the exact same size classes — swap a control for its skeleton and the layout never shifts. Form skeletons accept a label option (default on) so users can anticipate the field while it loads.">
	<div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
		<div class="space-y-3">
			<h3 class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Buttons</h3>
			<div class="flex items-center gap-3">
				<SuiButtonSkeleton size="sm" />
				<SuiButtonSkeleton size="md" />
				<SuiButtonSkeleton size="lg" />
				<SuiIconButtonSkeleton size="sm" />
			</div>
		</div>
		<div class="space-y-3">
			<h3 class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Text inputs</h3>
			<SuiInputSkeleton label={true} />
			<SuiTextareaSkeleton label={true} rows={2} />
		</div>
		<div class="space-y-3">
			<h3 class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Selection</h3>
			<SuiSelectSkeleton label={true} />
			<SuiComboboxSkeleton label={true} />
			<SuiMultiSelectSkeleton label={true} badges={2} />
		</div>
		<div class="space-y-3">
			<h3 class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Toggles</h3>
			<SuiCheckboxSkeleton label={true} />
			<SuiSwitchSkeleton label={true} />
			<SuiRadioSkeleton label={true} count={2} />
		</div>
		<div class="space-y-3 sm:col-span-2 lg:col-span-2">
			<h3 class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Data table</h3>
			<SuiDataTableSkeleton rows={4} columns={4} size="md" searchable />
		</div>
	</div>
</Section>

<Section title="Real-world: form loading" description="A plausible settings form mid-load — note the label placeholders keep vertical rhythm stable.">
	<form class="grid max-w-lg gap-5" onsubmit={(e) => e.preventDefault()}>
		<SuiInputSkeleton label={true} />
		<SuiSelectSkeleton label={true} />
		<SuiMultiSelectSkeleton label={true} badges={2} />
		<SuiCheckboxSkeleton label={true} />
		<div class="flex justify-end gap-3">
			<SuiButtonSkeleton size="sm" />
			<SuiButtonSkeleton size="sm" />
		</div>
	</form>
</Section>
