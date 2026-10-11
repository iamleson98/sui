<script lang="ts">
	import { setSuiStrings, type SuiStrings } from '$lib/sui/strings.js';
	import SuiSelect from '$lib/sui/select/select.svelte';
	import SuiMultiSelect from '$lib/sui/multi-select/multi-select.svelte';

	let { strings }: { strings: () => Partial<SuiStrings> } = $props();
	// a function override stays reactive (locale switches re-render)
	// svelte-ignore state_referenced_locally
	setSuiStrings(strings);
</script>

<SuiSelect label="Owner" items={[]} />
<SuiMultiSelect label="Tags" items={[{ value: 'a', label: 'Alpha' }]} value={['a']} clearable />
