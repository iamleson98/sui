<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import type { ZodType } from 'zod';
	import type { SuiActionSnippet, SuiFieldVariant, SuiIconComponent, SuiSize } from '../types.js';

	export type SuiTextareaProps = Omit<HTMLTextareaAttributes, 'size' | 'value' | 'class'> & {
		label?: string | Snippet;
		subText?: string;
		/** sui size — controls height baseline and text size. Default `md`. */
		size?: SuiSize;
		variant?: SuiFieldVariant;
		startIcon?: SuiIconComponent;
		action?: SuiActionSnippet;
		schema?: ZodType;
		validateOn?: 'change' | 'blur' | 'both' | 'none';
		errors?: string[];
		required?: boolean;
		id?: string;
		class?: string;
		value?: string;
		ref?: HTMLTextAreaElement | null;
	};
</script>

<script lang="ts">
	import SuiIcon from '../sui-icon.svelte';
	import { SuiFieldState } from '../field.svelte.js';
	import {
		suiEffectiveVariant,
		SUI_CONTROL,
		SUI_FIELD_CONTROL,
		SUI_FIELD_TEXT,
		SUI_LABEL,
		SUI_SUBTEXT
	} from '../styles.js';
	import { cn } from '$lib/utils.js';

	let {
		label,
		subText,
		size = 'md',
		variant = 'info',
		startIcon,
		action,
		schema,
		validateOn = 'both',
		errors: externalErrors = [],
		required = false,
		class: className = '',
		id = `sui-textarea-${crypto.randomUUID()}`,
		value = $bindable(''),
		ref = $bindable<HTMLTextAreaElement | null>(null),
		disabled,
		placeholder,
		rows = 4,
		oninput,
		onchange,
		onblur,
		...rest
	}: SuiTextareaProps = $props();

	const field = new SuiFieldState();

	const allErrors = $derived([...externalErrors, ...field.errors]);
	const invalid = $derived(allErrors.length > 0);
	const effVariant = $derived(suiEffectiveVariant(variant, invalid ? allErrors : undefined));
	const messageId = $derived(`${id}-message`);
	const describedBy = $derived(invalid || subText ? messageId : undefined);

	export function validate(): string[] {
		return field.forceValidate(value, schema);
	}

	export function reset(): void {
		field.reset();
	}
</script>

{#if label}
	<label for={id} data-sui-label class="{SUI_LABEL[size]} text-foreground mb-1.5 flex items-center gap-0.5 font-medium">
		{#if typeof label === 'string'}{label}{:else}{@render label()}{/if}
		{#if required}
			<span class="text-destructive" aria-hidden="true">*</span>
			<span class="sr-only">(required)</span>
		{/if}
	</label>
{/if}

<div
	data-sui-control="textarea"
	data-sui-size={size}
	data-sui-variant={effVariant}
	data-invalid={invalid || undefined}
	class={cn(
		'border-input bg-transparent dark:bg-input/30 dark:focus-within:bg-input/50 focus-within:ring-3 shadow-xs relative flex w-full rounded-md border transition-[color,box-shadow] outline-none',
		SUI_CONTROL[size],
		SUI_FIELD_CONTROL[effVariant],
		className
	)}
>
	{#if startIcon}
		<span class="text-muted-foreground pointer-events-none ps-3 shrink-0 self-start pt-[0.6em]">
			<SuiIcon icon={startIcon} {size} />
		</span>
	{/if}
	<textarea
		bind:this={ref}
		{id}
		bind:value
		{disabled}
		{placeholder}
		{required}
		{rows}
		data-sui-textarea
		class="placeholder:text-muted-foreground disabled:cursor-not-allowed dark:bg-input/30 bg-transparent w-full min-w-0 flex-1 resize-y px-3 py-2 outline-none"
		aria-invalid={invalid || undefined}
		aria-describedby={describedBy}
		oninput={(event) => {
			oninput?.(event);
			field.validate(event.currentTarget.value, schema, 'change', validateOn);
		}}
		onchange={(event) => {
			onchange?.(event);
			field.validate(event.currentTarget.value, schema, 'change', validateOn);
		}}
		onblur={(event) => {
			onblur?.(event);
			field.validate(event.currentTarget.value, schema, 'blur', validateOn);
		}}
		{...rest}
	></textarea>
	{#if action}
		<span data-sui-action class="flex shrink-0 items-center self-start pt-1 pe-1">
			{@render action({ size })}
		</span>
	{/if}
</div>

{#if invalid || subText}
	<div
		id={messageId}
		data-sui-field-message
		data-sui-variant={invalid ? effVariant : undefined}
		class="{SUI_SUBTEXT[size]} mt-1 {invalid ? SUI_FIELD_TEXT[effVariant] : 'text-muted-foreground'}"
		aria-live="polite"
	>
		{#if invalid}
			{#each allErrors as error (error)}
				<div>{error}</div>
			{/each}
		{:else}
			{subText}
		{/if}
	</div>
{/if}
