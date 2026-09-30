<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import type { ZodType } from 'zod';
	import type { SuiFieldVariant, SuiItem, SuiSize } from '../types.js';

	export type SuiRadioItem = SuiItem<string>;

	export type SuiRadioGroupProps = Omit<HTMLInputAttributes, 'size' | 'value' | 'class'> & {
		/** Group label rendered above the options. */
		label?: string | Snippet;
		subText?: string;
		size?: SuiSize;
		variant?: SuiFieldVariant;
		/** The selectable options. */
		items: SuiRadioItem[];
		/** Layout of the options. Default `vertical`. */
		orientation?: 'vertical' | 'horizontal';
		schema?: ZodType;
		validateOn?: 'change' | 'blur' | 'both' | 'none';
		errors?: string[];
		required?: boolean;
		id?: string;
		class?: string;
		value?: string;
	};
</script>

<script lang="ts">
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import { SuiFieldState } from '../field.svelte.js';
	import { suiEffectiveVariant, SUI_FIELD_TEXT, SUI_LABEL, SUI_SUBTEXT } from '../styles.js';
	import { cn } from '$lib/utils.js';
	
	let {
		label,
		subText,
		size = 'md',
		variant = 'info',
		items,
		orientation = 'vertical',
		schema,
		validateOn = 'change',
		errors: externalErrors = [],
		required = false,
		class: className = '',
		id = `sui-radio-${crypto.randomUUID()}`,
		value = $bindable(''),
		disabled,
		onchange,
		onblur,
		...rest
	}: SuiRadioGroupProps = $props();

	const field = new SuiFieldState();

	const DOT_SIZE: Record<SuiSize, string> = {
		xs: 'size-3',
		sm: 'size-3.5',
		md: 'size-4',
		lg: 'size-[18px]',
		xl: 'size-5'
	};

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

<div class={cn('flex w-full flex-col', className)} data-sui-control="radio-group" data-sui-size={size} data-invalid={invalid || undefined}>
	{#if label}
		<div class="text-foreground mb-1.5 flex items-center gap-0.5 font-medium {SUI_LABEL[size]}" data-sui-label>
			{#if typeof label === 'string'}{label}{:else}{@render label()}{/if}
			{#if required}
				<span class="text-destructive" aria-hidden="true">*</span>
				<span class="sr-only">(required)</span>
			{/if}
		</div>
	{/if}

	<RadioGroup.Root
		{id}
		bind:value
		disabled={disabled || undefined}
		required={required || undefined}
		data-sui-radio-group
		class={cn(
			'grid gap-2',
			orientation === 'horizontal' ? 'grid-flow-col auto-cols-max' : 'grid-cols-1'
		)}
		aria-invalid={invalid || undefined}
		aria-describedby={describedBy}
		onValueChange={(next: string) => {
			field.validate(next, schema, 'change', validateOn);
			onchange?.(next as never);
		}}
		onblur={(event) => {
			onblur?.(event as never);
			field.validate(value, schema, 'blur', validateOn);
		}}
		{...(rest as Record<string, unknown>)}
	>
		{#each items as item (item.value)}
			<label
				for={`${id}-${item.value}`}
				class="flex w-full cursor-pointer items-start gap-2 {item.disabled || disabled ? 'cursor-not-allowed opacity-50' : ''}"
			>
				<RadioGroup.Item
					id={`${id}-${item.value}`}
					value={item.value}
					disabled={item.disabled}
					data-sui-radio-item
					class="{DOT_SIZE[size]} mt-0.5"
				/>
				<span class="flex flex-col gap-0.5">
					<span class="{SUI_LABEL[size]} text-foreground leading-none font-medium">{item.label}</span>
					{#if item.description}
						<span class="text-muted-foreground {SUI_SUBTEXT[size]}">{item.description}</span>
					{/if}
				</span>
			</label>
		{/each}
	</RadioGroup.Root>

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
</div>
