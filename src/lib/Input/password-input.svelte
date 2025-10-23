<script lang="ts">
	import { TablerEyeClosed, TablerLock, TablerEye } from '$lib/Icon/consts.js';
	import { Icon } from '$lib/Icon/index.js';
	import Input from './input.svelte';
	import type { InputProps } from './input.types.js';
	import { type Snippet } from 'svelte';

	let {
		size,
		placeholder,
		value = $bindable(),
		showAction,
		...rest
	}: Omit<InputProps, 'action'> & { showAction?: boolean } = $props();

	type passwordDisplay = 'password' | 'text';

	let passwordFieldType: passwordDisplay = $state('password');

	const togglePasswordType = () =>
		(passwordFieldType = passwordFieldType === 'password' ? 'text' : 'password');
</script>

{#snippet passwordAction()}
	<span
		class={`rounded-full ${size === 'sm' ? 'w-6 h-6' : 'w-7 h-7'} bg-gray-100 hover:bg-gray-200 flex items-center justify-center cursor-pointer select-none`}
		role="button"
		onclick={togglePasswordType}
		tabindex="0"
		onkeydown={(e) => e.key === 'Enter' && togglePasswordType()}
	>
		<Icon icon={passwordFieldType === 'password' ? TablerEye : TablerEyeClosed} />
	</span>
{/snippet}

<Input
	{placeholder}
	bind:value
	startIcon={TablerLock}
	action={showAction ? (passwordAction as Snippet<[]>) : undefined}
	type={passwordFieldType}
	{size}
	{...rest}
/>
