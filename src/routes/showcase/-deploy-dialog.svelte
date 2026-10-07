<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { SuiInput, SuiTextarea } from '$lib/sui/input/index.js';
	import { SuiSelect } from '$lib/sui/select/index.js';
	import { SuiRadioGroup } from '$lib/sui/radio-group/index.js';
	import { SuiCheckbox } from '$lib/sui/checkbox/index.js';
	import { SuiButton } from '$lib/sui/button/index.js';
	import { z } from 'zod';
	import { toast } from 'svelte-sonner';

	import { showcase } from './-state.svelte';
	import { SERVICES, type Deployment, type Env } from './-data.svelte';

	import CloudUploadIcon from '@lucide/svelte/icons/cloud-upload';

	const schema = z.object({
		service: z.string().min(1, 'Pick a service'),
		version: z
			.string()
			.regex(/^v?\d+\.\d+\.\d+(-[\w.]+)?$/, 'Use semver — e.g. 2.4.1 or 2.5.0-rc.1'),
		env: z.enum(['production', 'staging', 'preview'], 'Pick an environment'),
		strategy: z.enum(['rolling', 'canary', 'blue-green']),
		notes: z.string().max(200, 'Keep notes under 200 characters')
	});

	const serviceItems = SERVICES.map((s) => ({ value: s, label: s }));
	const strategyItems = [
		{ value: 'rolling', label: 'Rolling', description: 'Replace pods one batch at a time' },
		{ value: 'canary', label: 'Canary', description: '5% traffic, promote on green metrics' },
		{ value: 'blue-green', label: 'Blue-green', description: 'Parallel fleet, instant switch' }
	];

	let service = $state<string | undefined>(undefined);
	let version = $state('');
	let env = $state<string>('staging');
	let strategy = $state('canary');
	let notes = $state('');
	let migrations = $state(false);
	let serverErrors = $state<Record<string, string[]>>({});
	let formEl = $state<HTMLFormElement | null>(null);
	let serviceRef: SuiSelect | undefined = $state();
	let versionRef: SuiInput | undefined = $state();

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const candidate = {
			service,
			version: version.trim(),
			env: env as Env,
			strategy,
			notes: notes.trim()
		};
		const result = schema.safeParse(candidate);
		serviceRef?.validate();
		versionRef?.validate();
		if (!result.success) {
			serverErrors = z.flattenError(result.error).fieldErrors as Record<string, string[]>;
			return;
		}
		showcase.issueDialogOpen = false; // ensure palette-adjacent dialogs don't stack
		const dep = showcase.addDeployment({
			service: result.data.service,
			env: result.data.env,
			version: result.data.version.replace(/^v/, ''),
			branch: 'main',
			sha: Math.random().toString(16).slice(2, 9),
			commitMsg: result.data.notes || 'manual deploy from the console',
			authorId: 'ada',
			startedMin: 0,
			started: 'just now',
			durationSec: 0,
			duration: '—',
			status: 'building',
			region: 'iad-1'
		});
		showcase.deployDialogOpen = false;
		toast.promise(
			new Promise<{ id: string }>((resolve) => {
				setTimeout(() => {
					showcase.patchDeployment(dep.id, {
						status: 'success',
						durationSec: 187,
						duration: '3m 7s'
					});
					resolve({ id: dep.id });
				}, 3200);
			}),
			{
				loading: `Building ${result.data.service} ${result.data.version}…`,
				success: () =>
					`Promoted ${result.data.service} ${result.data.version} to ${result.data.env}`,
				error: 'Build failed — check the logs'
			}
		);
		reset();
	}

	function reset() {
		service = undefined;
		version = '';
		env = 'staging';
		strategy = 'canary';
		notes = '';
		migrations = false;
		serverErrors = {};
	}
</script>

<Dialog.Root bind:open={showcase.deployDialogOpen}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Trigger a deployment</Dialog.Title>
			<Dialog.Description>
				Fires the real pipeline stages — build, pre-flight hooks, promote. The new row lands in the
				table immediately and flips from building to success when the build completes.
			</Dialog.Description>
		</Dialog.Header>

		<form class="mt-2 grid gap-4" bind:this={formEl} onsubmit={submit} novalidate>
			<div class="grid gap-4 sm:grid-cols-2">
				<SuiSelect
					bind:this={serviceRef}
					id="sc-deploy-service"
					label="Service"
					placeholder="Pick a service…"
					items={serviceItems}
					schema={schema.shape.service}
					errors={serverErrors.service}
					bind:value={service}
					required
				/>
				<SuiInput
					bind:this={versionRef}
					id="sc-deploy-version"
					label="Version"
					placeholder="2.4.1"
					schema={schema.shape.version}
					errors={serverErrors.version}
					bind:value={version}
					required
				/>
			</div>

			<SuiRadioGroup
				label="Environment"
				orientation="horizontal"
				items={[
					{ value: 'production', label: 'Production' },
					{ value: 'staging', label: 'Staging' },
					{ value: 'preview', label: 'Preview' }
				]}
				bind:value={env}
			/>

			<SuiSelect
				id="sc-deploy-strategy"
				label="Strategy"
				items={strategyItems}
				bind:value={strategy}
				subText="Canary watches p99 for 10 minutes before promoting."
			/>

			<SuiTextarea
				label="Release notes"
				subText="Optional — shown in the digest."
				placeholder="What's riding this build?"
				schema={schema.shape.notes}
				errors={serverErrors.notes}
				bind:value={notes}
				rows={2}
			/>

			<SuiCheckbox
				label="Run database migrations"
				subText="Adds a pre-flight step; the deploy blocks until it exits zero."
				bind:checked={migrations}
			/>

			<Dialog.Footer>
				<SuiButton variant="ghost" type="button" onclick={reset}>Reset</SuiButton>
				<SuiButton type="submit" startIcon={CloudUploadIcon}>Ship it</SuiButton>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
