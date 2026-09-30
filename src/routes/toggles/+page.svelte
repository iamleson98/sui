<script lang="ts">
	import { SuiCheckbox, SuiSwitch, SuiRadioGroup, SuiCheckboxSkeleton, SuiRadioSkeleton, SuiSwitchSkeleton } from '$lib/sui';
	import CodeBlock from '$lib/demo/code-block.svelte';
	import Section from '$lib/demo/section.svelte';
	import { z } from 'zod';

	let marketing = $state(true);
	let newsletter = $state(false);
	let twoFactor = $state(true);
	let plan = $state('pro');
	let enableAnalytics = $state(true);

	const termsSchema = z.literal(true, { error: 'You must accept the terms' });
	const planSchema = z.string().min(1, 'Choose a plan');

	let terms = $state(false);
	let termsTouchedManually = $state<string[] | undefined>(undefined);

	const plans = [
		{ value: 'free', label: 'Hobby', description: 'Side projects, community support' },
		{ value: 'pro', label: 'Pro', description: 'For growing teams, priority support' },
		{ value: 'enterprise', label: 'Enterprise', description: 'SSO, SLAs, dedicated support' }
	];

	const checkboxCode = `<SuiCheckbox
  label="Accept the terms"
  subText="You can withdraw at any time."
  schema={z.literal(true, { error: 'You must accept the terms' })}
  bind:checked={terms}
/>`;

	const radioCode = `<SuiRadioGroup
  label="Plan"
  items={plans}
  orientation="vertical"
  schema={z.string().min(1, 'Choose a plan')}
  bind:value={plan}
/>`;
</script>

<svelte:head><title>Toggles · sui</title></svelte:head>

<h1 class="mb-8 text-3xl font-bold tracking-tight">Checkbox · Switch · Radio</h1>

<Section title="Checkbox" description="Label, sub-text and zod validation (use z.boolean() / z.literal(true) schemas). Indeterminate states are supported by the underlying primitive.">
	<div class="grid max-w-lg gap-5">
		<SuiCheckbox label="Accept the terms and conditions" subText="You can withdraw consent at any time." schema={termsSchema} bind:checked={terms} required />
		<SuiCheckbox label="Send me marketing emails" bind:checked={marketing} />
		<SuiCheckbox label="Disabled option" checked={true} disabled />
	</div>
	<div class="mt-8">
		<CodeBlock code={checkboxCode} />
	</div>
</Section>

<Section title="Switch" description="Ideal for instant-apply settings. Same label/subText/validation API.">
	<div class="grid max-w-lg gap-6">
		<SuiSwitch label="Two-factor authentication" subText="Require a security key or TOTP code at sign-in." bind:checked={twoFactor} />
		<SuiSwitch label="Anonymous analytics" subText="Help us improve sui." bind:checked={enableAnalytics} />
		<SuiSwitch label="Disabled switch" checked={true} disabled />
	</div>
</Section>

<Section title="Radio group" description="Options with descriptions, horizontal or vertical layout, zod validated.">
	<div class="grid max-w-lg gap-6">
		<SuiRadioGroup label="Plan" items={plans} schema={planSchema} bind:value={plan} required />
		<SuiRadioGroup label="Billing" orientation="horizontal" items={[{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly (−20%)' }]} value={undefined} />
	</div>
	<div class="mt-8">
		<CodeBlock code={radioCode} />
	</div>
</Section>

<Section title="Skeletons">
	<div class="grid max-w-lg gap-6">
		<SuiCheckboxSkeleton label={true} />
		<SuiRadioSkeleton label={true} count={3} />
		<SuiSwitchSkeleton label={true} />
	</div>
</Section>
