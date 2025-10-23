<script lang="ts">
	import { INPUT_BUTTON_SIZE_MAP } from '$lib/Button/types.js';
	import { SkeletonContainer } from '$lib/Skeleton/index.js';
	import Skeleton from '../Skeleton/skeleton.svelte';
	import type { SocialSize } from '$lib/common.js';

	type Props = {
		/**size of input skeleton*/
		size?: SocialSize | 'xxs';
		/**show label skeleton as well*/
		label?: boolean;
	};

	let { size = 'md', label }: Props = $props();
</script>

<SkeletonContainer>
	<!-- label -->
	{#if label}
		<Skeleton class="h-3 w-1/4 mb-1" />
	{/if}

	<!-- input -->
	<Skeleton class={INPUT_BUTTON_SIZE_MAP[size]} />
</SkeletonContainer>
