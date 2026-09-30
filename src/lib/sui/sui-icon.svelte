<script lang="ts">
	import type { SuiIconComponent, SuiSize } from './types.js';
	import { SUI_ICON } from './styles.js';

	let {
		icon,
		size = 'md',
		class: className = ''
	}: { icon: SuiIconComponent; size?: SuiSize; class?: string } = $props();
</script>

{#key icon}
	{@const Icon = icon}
	<Icon class="{SUI_ICON[size]} {className}" aria-hidden="true" />
{/key}
