<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import type { ZodType } from 'zod';
	import type { SuiFieldVariant, SuiSize } from '../types.js';

	export type SuiSwitchProps = Omit<HTMLInputAttributes, 'size' | 'value' | 'class'> & {
		label?: string | Snippet;
		subText?: string | Snippet;
		size?: SuiSize;
		variant?: SuiFieldVariant;
		schema?: ZodType;
		validateOn?: 'change' | 'blur' | 'both' | 'none';
		errors?: string[];
		required?: boolean;
		id?: string;
		class?: string;
		checked?: boolean;
	};
</script>

<script lang="ts">
	import Switch from '$lib/components/ui/switch/switch.svelte';
	import { SuiFieldState } from '../field.svelte.js';
	import { suiEffectiveVariant, SUI_FIELD_TEXT, SUI_LABEL, SUI_SUBTEXT } from '../styles.js';
	import { cn } from '$lib/utils.js';

	let {
		label,
		subText,
		size = 'md',
		variant = 'info',
		schema,
		validateOn = 'change',
		errors: externalErrors = [],
		required = false,
		class: className = '',
		id = `sui-switch-${crypto.randomUUID()}`,
		checked = $bindable(false),
		disabled,
		onblur,
		...rest
	}: SuiSwitchProps = $props();

	const field = new SuiFieldState();

	const TRACK_SIZE: Record<SuiSize, string> = {
		xs: 'h-3.5 w-6 [&_span]:size-2.5',
		sm: 'h-4 w-7 [&_span]:size-3',
		md: 'h-5 w-9 [&_span]:size-4',
		lg: 'h-6 w-11 [&_span]:size-5',
		xl: 'h-7 w-13 [&_span]:size-6'
	};

	const allErrors = $derived([...externalErrors, ...field.errors]);
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

<div class={cn('flex w-full items-start justify-between gap-3', className)} data-sui-control="switch" data-sui-size={size} data-invalid={invalid || undefined}>
	<div class="flex flex-col gap-0.5">
		{#if label}
			<label for={id} data-sui-label class="{SUI_LABEL[size]} text-foreground leading-none font-medium {disabled ? 'opacity-50' : ''}">
				{#if typeof label === 'string'}{label}{:else}{@render label()}{/if}
				{#if required}
					<span class="text-destructive" aria-hidden="true">*</span>
					<span class="sr-only">(required)</span>
				{/if}
			</label>
		{/if}
		{#if subText}
			<div class="text-muted-foreground {SUI_SUBTEXT[size]}">
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
	<Switch
		{id}
		bind:checked
		disabled={disabled || undefined}
		required={required || undefined}
		data-sui-switch
		class="{TRACK_SIZE[size]} {invalid ? 'data-checked:bg-red-600' : ''}"
		aria-invalid={invalid || undefined}
		aria-describedby={describedBy}
		onCheckedChange={(value: boolean) => {
			field.validate(value, schema, 'change', validateOn);
		}}
		onblur={(event) => {
			onblur?.(event as never);
			field.validate(checked, schema, 'blur', validateOn);
		}}
		{...(rest as Record<string, unknown>)}
	/>
</div>
