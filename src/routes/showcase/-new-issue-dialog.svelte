<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { SuiInput, SuiTextarea } from '$lib/sui/input/index.js';
	import { SuiSelect } from '$lib/sui/select/index.js';
	import { SuiMultiSelect } from '$lib/sui/multi-select/index.js';
	import { SuiRadioGroup } from '$lib/sui/radio-group/index.js';
	import { SuiCheckbox } from '$lib/sui/checkbox/index.js';
	import { SuiSwitch } from '$lib/sui/switch/index.js';
	import { SuiButton } from '$lib/sui/button/index.js';
	import { SuiErrorSummary, focusFirstInvalid } from '$lib/sui/index.js';
	import { z } from 'zod';
	import { tick } from 'svelte';
	import { toast } from 'svelte-sonner';

	import { showcase } from './-state.svelte';
	import {
		PEOPLE,
		LABEL_KEYS,
		LABELS,
		PRIORITY_LABEL,
		type LabelKey,
		type Priority
	} from './-data.svelte';

	import PlusIcon from '@lucide/svelte/icons/plus';

	const schema = z.object({
		title: z
			.string()
			.min(8, 'Give the issue a real title — at least 8 characters')
			.max(120, 'Keep the title under 120 characters'),
		description: z.string().max(280, 'Keep it under 280 characters'),
		priority: z.enum(['urgent', 'high', 'medium', 'low'], 'Pick a priority'),
		labels: z
			.array(z.enum(['bug', 'feature', 'chore', 'design', 'infra', 'docs']))
			.min(1, 'Add at least one label'),
		assignees: z.array(z.string()),
		points: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(5), z.literal(8)]),
		notify: z.boolean(),
		block: z.boolean()
	});

	let title = $state('');
	let description = $state('');
	let priority = $state<string | undefined>(undefined);
	let labels = $state<string[]>([]);
	let assignees = $state<string[]>([]);
	let points = $state<string>('3');
	let notify = $state(true);
	let block = $state(false);
	let submitting = $state(false);
	let serverErrors = $state<Record<string, string[]>>({});

	let formEl = $state<HTMLFormElement | null>(null);
	let titleRef: SuiInput | undefined = $state();
	let priorityRef: SuiSelect | undefined = $state();
	let labelsRef: SuiMultiSelect | undefined = $state();

	const priorityItems = (Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => ({
		value: p,
		label: PRIORITY_LABEL[p]!
	}));
	const labelItems = LABEL_KEYS.map((k) => ({ value: k, label: LABELS[k]!.label }));
	const peopleItems = PEOPLE.map((p) => ({ value: p.id, label: p.name, description: p.role }));

	function reset() {
		title = '';
		description = '';
		priority = undefined;
		labels = [];
		assignees = [];
		points = '3';
		notify = true;
		block = false;
		serverErrors = {};
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const candidate = {
			title: title.trim(),
			description: description.trim(),
			priority,
			labels: labels as LabelKey[],
			assignees,
			points: Number(points),
			notify,
			block
		};
		const result = schema.safeParse(candidate);
		titleRef?.validate();
		priorityRef?.validate();
		labelsRef?.validate();
		if (!result.success) {
			const flat = z.flattenError(result.error);
			serverErrors = flat.fieldErrors as Record<string, string[]>;
			await tick();
			focusFirstInvalid((event.currentTarget as HTMLFormElement) ?? formEl!);
			return;
		}
		submitting = true;
		await new Promise((r) => setTimeout(r, 550)); // simulate the API round-trip
		submitting = false;
		const issue = showcase.addIssue(result.data);
		toast.success(`${issue.id} filed to Backlog`, {
			description: notify ? 'Watchers will be pinged.' : 'Created silently — watchers not notified.'
		});
		reset();
		showcase.issueDialogOpen = false;
	}
</script>

<Dialog.Root bind:open={showcase.issueDialogOpen}>
	<Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-xl">
		<Dialog.Header>
			<Dialog.Title>New issue</Dialog.Title>
			<Dialog.Description>
				Every field below is a sui one-liner with a zod v4 schema wired in — labels, sub-text and
				validation errors come for free.
			</Dialog.Description>
		</Dialog.Header>

		<form class="mt-2 grid gap-4" bind:this={formEl} onsubmit={submit} novalidate>
			<SuiErrorSummary
				errors={[
					...(serverErrors.title ?? []).map((m) => ({ fieldId: 'sc-issue-title', message: m })),
					...(serverErrors.priority ?? []).map((m) => ({
						fieldId: 'sc-issue-priority',
						message: m
					})),
					...(serverErrors.labels ?? []).map((m) => ({ fieldId: 'sc-issue-labels', message: m }))
				]}
			/>

			<SuiInput
				bind:this={titleRef}
				id="sc-issue-title"
				label="Title"
				placeholder="Edge cache purges take >30s in eu-west-1"
				schema={schema.shape.title}
				errors={serverErrors.title}
				bind:value={title}
				required
			/>

			<SuiTextarea
				label="Description"
				subText="Context, repro steps, links — optional."
				placeholder="Since the 2.4 rollout…"
				schema={schema.shape.description}
				errors={serverErrors.description}
				bind:value={description}
				rows={3}
			/>

			<div class="grid gap-4 sm:grid-cols-2">
				<SuiSelect
					bind:this={priorityRef}
					id="sc-issue-priority"
					label="Priority"
					placeholder="Choose…"
					items={priorityItems}
					schema={schema.shape.priority}
					errors={serverErrors.priority}
					bind:value={priority}
					required
				/>
				<SuiMultiSelect
					bind:this={labelsRef}
					id="sc-issue-labels"
					label="Labels"
					placeholder="Pick labels…"
					items={labelItems}
					schema={schema.shape.labels}
					errors={serverErrors.labels}
					bind:value={labels}
					maxDisplay={2}
					required
				/>
			</div>

			<SuiMultiSelect
				label="Assignees"
				subText="Optional — the issue can start unassigned."
				placeholder="Search people…"
				items={peopleItems}
				bind:value={assignees}
			/>

			<SuiRadioGroup
				label="Story points"
				orientation="horizontal"
				items={[
					{ value: '1', label: '1' },
					{ value: '2', label: '2' },
					{ value: '3', label: '3' },
					{ value: '5', label: '5' },
					{ value: '8', label: '8' }
				]}
				bind:value={points}
			/>

			<div class="grid gap-3">
				<SuiCheckbox
					label="Notify watchers"
					subText="Pings everyone watching the component this issue is filed under."
					bind:checked={notify}
				/>
				<SuiSwitch
					label="Block until deploy hooks pass"
					subText="The issue cannot move to Done while pre-flight hooks are red."
					bind:checked={block}
				/>
			</div>

			<Dialog.Footer class="mt-2">
				<SuiButton variant="ghost" type="button" onclick={() => (showcase.issueDialogOpen = false)}
					>Cancel</SuiButton
				>
				<SuiButton type="submit" loading={submitting} startIcon={PlusIcon}>File issue</SuiButton>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
