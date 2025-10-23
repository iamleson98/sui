<script lang="ts">
	import { Skeleton } from '$lib/Skeleton/index.js';
	import type { SocialSize } from '$lib/common.js';
	import { RADIO_SIZES } from './input.types.js';

	type Props = {
		size?: SocialSize;
	};

	let { size = 'md' }: Props = $props();
</script>

<div class="flex items-center gap-1.5">
	<Skeleton class="radio shadow-none! border-none! {RADIO_SIZES[size]}" />
	<Skeleton class="h-5 w-20" />
</div>
