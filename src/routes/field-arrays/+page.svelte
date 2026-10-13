<script lang="ts">
	import { z } from 'zod';
	import Seo from '$lib/demo/seo.svelte';
	import Section from '$lib/demo/section.svelte';
	import CodeBlock from '$lib/demo/code-block.svelte';
	import { SuiForm, createSuiForm } from '$lib/sui/form/index.js';
	import { SuiInput } from '$lib/sui/input/index.js';
	import { SuiButton, SuiIconButton } from '$lib/sui/button/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TrashIcon from '@lucide/svelte/icons/trash';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';

	const schema = z.object({
		customer: z.string().min(2, 'Enter the customer name'),
		emails: z.array(z.email('Enter a valid email')).min(1, 'Add at least one email'),
		lines: z
			.array(
				z.object({
					sku: z.string().min(1, 'Enter a SKU'),
					qty: z.number('Enter a quantity').int().min(1, 'At least 1')
				})
			)
			.min(1, 'Add at least one line')
	});

	let result = $state<z.output<typeof schema> | null>(null);

	const form = createSuiForm(schema, {
		initialValues: {
			emails: ['ada@example.com'],
			lines: [{ sku: 'KB-01', qty: 2 }]
		},
		onsubmit: async (data) => {
			await new Promise((resolve) => setTimeout(resolve, 300));
			result = data;
		}
	});

	const emails = form.array('emails');
	const lines = form.array('lines');

	const code = `const form = createSuiForm(schema, { initialValues: { emails: [''] } });
const emails = form.array('emails');            // typed: items are string[]
const lines = form.array('lines');              // items are { sku, qty }[]

{#each emails.entries as item (item.key)}       <!-- stable keys: DOM moves, never re-creates -->
  <SuiInput field={item.field()} label="Email {item.index + 1}" />
  <SuiIconButton icon={TrashIcon} label="Remove" onclick={() => emails.remove(item.index)} />
{/each}
<SuiButton onclick={() => emails.push()}>Add email</SuiButton>   <!-- schema default item -->

{#each lines.entries as item (item.key)}
  <SuiInput field={item.field('sku')} label="SKU" />
  <SuiInput field={item.field('qty')} label="Qty" type="number" />
{/each}

// errors, touched and dirty state follow each item through
// insert / remove / move / swap — and remove() moves focus to a neighbour`;
</script>

<Seo path="/field-arrays" />

<h1 class="mb-8 text-3xl font-bold tracking-tight">Field arrays</h1>

<Section
	title="Dynamic lists"
	description="Add, remove and reorder items. Keys are stable, per-item errors follow the item they describe, removing an item moves focus to its neighbour, and everything is typed from the schema."
>
	<div class="grid gap-6 lg:grid-cols-[1fr_18rem]">
		<SuiForm {form} showFormErrors class="grid max-w-xl gap-6">
			<SuiInput field={form.fields.customer} label="Customer" required />

			<fieldset class="grid gap-3">
				<legend class="mb-1 text-sm font-medium">Emails</legend>
				{#each emails.entries as item (item.key)}
					<div class="flex items-start gap-2" data-testid="email-row">
						<SuiInput
							class="flex-1"
							field={item.field<string>()}
							label="Email {item.index + 1}"
							type="email"
						/>
						<SuiIconButton
							class="mt-7"
							icon={TrashIcon}
							label="Remove email {item.index + 1}"
							variant="outline"
							onclick={() => emails.remove(item.index)}
						/>
					</div>
				{/each}
				{#if form.field('emails').errors.length > 0}
					<p class="text-xs text-destructive" role="alert">
						{form.field('emails').errors.join(' ')}
					</p>
				{/if}
				<div>
					<SuiButton variant="outline" startIcon={PlusIcon} onclick={() => emails.push()}>
						Add email
					</SuiButton>
				</div>
			</fieldset>

			<fieldset class="grid gap-3">
				<legend class="mb-1 text-sm font-medium">Order lines</legend>
				{#each lines.entries as item (item.key)}
					<div class="flex items-start gap-2" data-testid="line-row">
						<SuiInput
							class="flex-1"
							field={item.field<string>('sku')}
							label="SKU {item.index + 1}"
						/>
						<SuiInput class="w-24" field={item.field<number>('qty')} label="Qty" type="number" />
						<div class="mt-7 flex gap-1">
							<SuiIconButton
								icon={ArrowUpIcon}
								label="Move line {item.index + 1} up"
								variant="outline"
								disabled={item.index === 0}
								onclick={() => lines.move(item.index, item.index - 1)}
							/>
							<SuiIconButton
								icon={ArrowDownIcon}
								label="Move line {item.index + 1} down"
								variant="outline"
								disabled={item.index === lines.length - 1}
								onclick={() => lines.move(item.index, item.index + 1)}
							/>
							<SuiIconButton
								icon={TrashIcon}
								label="Remove line {item.index + 1}"
								variant="outline"
								onclick={() => lines.remove(item.index)}
							/>
						</div>
					</div>
				{/each}
				<div>
					<SuiButton variant="outline" startIcon={PlusIcon} onclick={() => lines.push()}>
						Add line
					</SuiButton>
				</div>
			</fieldset>

			<div class="flex gap-2">
				<SuiButton type="submit" loading={form.isSubmitting}>Save order</SuiButton>
				<SuiButton variant="ghost" onclick={() => form.reset()}>Reset</SuiButton>
			</div>
		</SuiForm>

		<div class="rounded-lg border bg-muted/30 p-4 text-sm">
			<p class="mb-2 font-medium">Parsed result</p>
			<!-- a scrollable region must be keyboard-reachable (WCAG 2.1.1) -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<pre tabindex="0" class="overflow-x-auto text-xs" data-testid="array-result">{result
					? JSON.stringify(result, null, 2)
					: 'Submit the form to see the parsed values.'}</pre>
			<p class="mt-3 text-xs text-muted-foreground">
				Unsaved changes: <strong>{form.isDirty ? 'yes' : 'no'}</strong>
			</p>
		</div>
	</div>
	<div class="mt-8">
		<CodeBlock {code} />
	</div>
</Section>
