<script lang="ts">
	import type { SocialSize } from '$lib/common.js';
	import { Checkbox, RadioButton } from '$lib/Input/index.js';
	import type { SocialVariant } from '$lib/utils/consts.js';

	const socialSizes: SocialSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];

	const variants: SocialVariant[] = ['info', 'success', 'warning', 'error'];

	let subText = $state<string>('This is subtext');
	let variant = $state<SocialVariant>('info');
</script>

<div>
	<div class="mb-3 flex items-center gap-3">
		{#each variants as myVariant, idx (idx)}
			<RadioButton bind:group={variant} value={myVariant} label={myVariant} />
		{/each}
	</div>
</div>

<div>
	{#each socialSizes as size, idx (idx)}
		<div class="mb-3 flex items-center gap-3">
			<Checkbox {size} label={size} {subText} {variant} />
		</div>
	{/each}
</div>
