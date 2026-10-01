<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import type { ZodType } from 'zod';
	import type { SuiFieldVariant, SuiSize } from '../types.js';

	export type SuiCheckboxProps = Omit<HTMLInputAttributes, 'size' | 'value' | 'class'> & {
		/** Label rendered next to the checkbox. */
		label?: string | Snippet;
		/** Helper text rendered below the label. */
		subText?: string | Snippet;
		size?: SuiSize;
		variant?: SuiFieldVariant;
		/** zod v4 schema (typically `z.boolean()`). */
		schema?: ZodType;
		/** When to run `schema`. Default `both` (change + blur). */
		validateOn?: 'auto' | 'change' | 'blur' | 'both' | 'none';
		errors?: string[];
		required?: boolean;
		id?: string;
		class?: string;
		checked?: boolean;
	};
</script>

<script lang="ts">
	import Checkbox from '$lib/components/ui/checkbox/checkbox.svelte';
	import { SuiFieldState } from '../field.svelte.js';
	import { suiEffectiveVariant, SUI_FIELD_TEXT, SUI_LABEL, SUI_SUBTEXT } from '../styles.js';
	import { cn } from '$lib/utils.js';

	let {
		label,
		subText,
		size = 'md',
		variant = 'info',
		schema,
		validateOn = 'both',
		errors: externalErrors = [],
		required = false,
		class: className = '',
		id = `sui-checkbox-${crypto.randomUUID()}`,
		checked = $bindable(false),
		disabled,
		onchange,
		onblur,
		...rest
	}: SuiCheckboxProps = $props();

	const field = new SuiFieldState();

	// fresh external errors (new `errors` prop reference) re-take the
	// display; re-passing an unchanged list never resurrects cleared ones
	$effect(() => field.syncExternal(externalErrors));

	/** Map sui sizes to checkbox sizes (shadcn checkbox has no size scale). */
	const BOX_SIZE: Record<SuiSize, string> = {
		xs: 'size-3',
		sm: 'size-3.5',
		md: 'size-4',
		lg: 'size-[18px]',
		xl: 'size-5'
	};

	// deduped: the same message can arrive from both the `errors` prop (server)
	// and the local zod validation — duplicate keys would break {#each (error)}
	const allErrors = $derived(field.displayed);
	const invalid = $derived(allErrors.length > 0);
	const effVariant = $derived(suiEffectiveVariant(variant, invalid ? allErrors : undefined));
	const messageId = $derived(`${id}-message`);
	const describedBy = $derived(invalid || subText ? messageId : undefined);

	export function validate(): string[] {
		return field.forceValidate(checked, schema);
	}

	export function reset(): void {
		field.reset();
	}
</script>

<div class={cn('flex w-full items-start gap-2', className)} data-sui-control="checkbox" data-sui-size={size} data-invalid={invalid || undefined}>
	<Checkbox
		{id}
		bind:checked
		disabled={disabled || undefined}
		required={required || undefined}
		data-sui-checkbox
		class="{BOX_SIZE[size]} mt-0.5"
		aria-invalid={invalid || undefined}
		aria-describedby={describedBy}
		onCheckedChange={(value: boolean) => {
			// bits-ui fires this for both user and programmatic changes
			field.validate(value, schema, 'change', validateOn);
		}}
		onchange={(event) => {
			onchange?.(event as never);
		}}
		onblur={(event) => {
			onblur?.(event as never);
			field.validate(checked, schema, 'blur', validateOn);
		}}
		{...(rest as Record<string, unknown>)}
	/>
	<div class="flex flex-col gap-0.5">
		{#if label}
			<label
				for={id}
				data-sui-label
				class="{SUI_LABEL[size]} {SUI_FIELD_TEXT[effVariant]} leading-none font-medium {disabled ? 'opacity-50' : ''}"
			>
				{#if typeof label === 'string'}{label}{:else}{@render label()}{/if}
				{#if required}
					<span class="text-destructive" aria-hidden="true">*</span>
					<span class="sr-only">(required)</span>
				{/if}
			</label>
		{/if}
		{#if subText}
			<div class="{SUI_SUBTEXT[size]} {SUI_FIELD_TEXT[effVariant]}">
				{#if typeof subText === 'string'}{subText}{:else}{@render subText()}{/if}
			</div>
		{/if}
		{#if invalid}
			<div id={messageId} data-sui-field-message class="{SUI_SUBTEXT[size]} {SUI_FIELD_TEXT[effVariant]}" aria-live="polite">
				{#each allErrors as error (error)}
					<div>{error}</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
