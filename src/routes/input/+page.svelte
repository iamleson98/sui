<script lang="ts">
	import {
	SuiInput,
	SuiTextarea,
	SuiInputSkeleton,
	SuiTextareaSkeleton
} from '$lib/sui/input/index.js';
	import Seo from '$lib/demo/seo.svelte';
	import CodeBlock from '$lib/demo/code-block.svelte';
	import Section from '$lib/demo/section.svelte';
	import { z } from 'zod';
	import MailIcon from '@lucide/svelte/icons/mail';
	import UserIcon from '@lucide/svelte/icons/user';
	import LockIcon from '@lucide/svelte/icons/lock';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import CheckIcon from '@lucide/svelte/icons/check';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';

	let email = $state('');
	let username = $state('minh');
	let bio = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let usernameAvailable = $state<'idle' | 'checking' | 'taken' | 'free'>('idle');

	const emailSchema = z.email('Enter a valid email address');
	const usernameSchema = z
		.string()
		.min(3, 'At least 3 characters')
		.regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and dashes only');

	$effect(() => {
		if (username.length >= 3) {
			usernameAvailable = 'checking';
			const timer = setTimeout(
				() => (usernameAvailable = username === 'admin' ? 'taken' : 'free'),
				500
			);
			return () => clearTimeout(timer);
		}
		usernameAvailable = 'idle';
	});

	const basicCode = `<SuiInput
  label="Email"
  type="email"
  placeholder="you@example.com"
  startIcon={MailIcon}
  schema={z.email('Enter a valid email')}
  bind:value={email}
/>`;

	const variantsCode = `<SuiInput label="Normal" variant="info" />
<SuiInput label="Success" variant="success" subText="Looks good" />
<SuiInput label="Warning" variant="warning" subText="Check your input" />
<SuiInput label="Error" variant="error" errors={['Something is wrong']} />`;

	const actionCode = `<SuiInput
  label="Password"
  type={showPassword ? 'text' : 'password'}
  startIcon={LockIcon}
  endIcon={EyeIcon}
  bind:value={password}
/>`;

	const sizes = (['sm', 'md', 'lg'] as const).map((size) => ({ size }));
</script>

<Seo path="/input" />

<h1 class="mb-8 text-3xl font-bold tracking-tight">Input & Textarea</h1>

<Section title="Label, icon & zod validation" description="Label, helper text and validation are all props — validated with zod v4 as you type, errors render under the field with ARIA wiring.">
	<div class="grid max-w-lg gap-6">
		<SuiInput
			label="Email"
			type="email"
			placeholder="you@example.com"
			startIcon={MailIcon}
			schema={emailSchema}
			bind:value={email}
		/>
		<SuiInput
			label="Username"
			placeholder="your-handle"
			startIcon={UserIcon}
			schema={usernameSchema}
			bind:value={username}
			validateDebounce={300}
			subText="Changing this will update your profile URL."
		>
			{#snippet action({ size })}
				{#if usernameAvailable === 'checking'}
					<LoaderCircleIcon class="text-muted-foreground size-4 animate-spin" aria-hidden="true" />
				{:else if usernameAvailable === 'free'}
					<CheckIcon class="size-4 text-green-500" aria-hidden="true" />
				{/if}
			{/snippet}
		</SuiInput>
	</div>
	<div class="mt-8">
		<CodeBlock code={basicCode} />
	</div>
</Section>

<Section title="Semantic variants" description="info (blue) is the normal state; success, warning and error style the border, ring and message. Validation errors always win.">
	<div class="grid max-w-lg gap-6">
		<SuiInput label="Normal" placeholder="info / blue" />
		<SuiInput label="Success" variant="success" subText="This value looks good." />
		<SuiInput label="Warning" variant="warning" subText="Are you sure? This cannot be undone." />
		<SuiInput label="Error" variant="error" errors={['This name is already taken.']} />
	</div>
	<div class="mt-8">
		<CodeBlock code={variantsCode} />
	</div>
</Section>

<Section title="Actions & password toggle" description="The action snippet renders interactive content at the end of the field.">
	<div class="grid max-w-lg gap-6">
		<SuiInput
			label="Password"
			type={showPassword ? 'text' : 'password'}
			startIcon={LockIcon}
			bind:value={password}
			placeholder="••••••••"
		>
			{#snippet action({ size })}
				<button
					type="button"
					class="text-muted-foreground hover:text-foreground flex items-center"
					onclick={() => (showPassword = !showPassword)}
					aria-label={showPassword ? 'Hide password' : 'Show password'}
				>
					{#if showPassword}
						<EyeOffIcon class="size-4" />
					{:else}
						<EyeIcon class="size-4" />
					{/if}
				</button>
			{/snippet}
		</SuiInput>
		<SuiTextarea label="Bio" placeholder="Tell us about yourself…" bind:value={bio} subText="Markdown supported." />
	</div>
	<div class="mt-8">
		<CodeBlock code={actionCode} />
	</div>
</Section>

<Section title="Sizes" description="Same height scale as buttons and selects.">
	<div class="grid max-w-lg gap-5">
		{#each sizes as { size } (size)}
			<SuiInput label="Size {size}" placeholder="placeholder" {size} />
		{/each}
	</div>
</Section>

<Section title="Skeletons" description="Every form control has a skeleton with an optional label row (on by default here).">
	<div class="grid max-w-lg gap-6">
		<SuiInputSkeleton size="sm" label={true} />
		<SuiInputSkeleton size="md" label={true} />
		<SuiTextareaSkeleton label={true} rows={3} />
	</div>
</Section>
