<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import type { SuiSchemaLike } from '../form/schema.js';
	import type { SuiFieldVariant, SuiItem, SuiSize } from '../types.js';
	import type { SuiFieldHandle } from '../form/index.js';

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
		/** zod v4 schema. Ignored when `field` is set. */
		schema?: SuiSchemaLike;
		/** When to run `schema`. Default `both` (change + blur). */
		validateOn?: 'auto' | 'change' | 'blur' | 'both' | 'none';
		errors?: string[];
		/** Schema-driven form handle (`form.fields.plan` from `createSuiForm`). */
		field?: SuiFieldHandle<string | undefined>;
		required?: boolean;
		/**
		 * Schema path this field maps to when a form-level submitter
		 * (`createSuiSubmitter`) orchestrates the form. Ignored when `field`
		 * is set — `createSuiForm` drives those.
		 */
		name?: string;
		id?: string;
		class?: string;
		value?: string;
	};
</script>

<script lang="ts">
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import { SuiFieldState } from '../field.svelte.js';
	import { registerSuiField } from '../form/field-registry.js';
	import { suiEffectiveVariant, SUI_FIELD_TEXT, SUI_LABEL, SUI_SUBTEXT } from '../styles.js';
	import { cn } from '$lib/utils.js';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';

	let {
		label,
		subText,
		size = 'md',
		variant = 'info',
		items,
		orientation = 'vertical',
		schema,
		validateOn = 'both',
		errors: externalErrors = [],
		name,
		field: f,
		required = false,
		class: className = '',
		id = `sui-radio-${crypto.randomUUID()}`,
		value = $bindable(''),
		disabled,
		onchange,
		onblur,
		...rest
	}: SuiRadioGroupProps = $props();

	// `fieldState` backs standalone usage; a `field` handle from
	// createSuiForm takes over values, timing and error display
	const fieldState = new SuiFieldState();

	// form-level submitter wiring: register the live value + error channel
	// on the field root so `createSuiSubmitter` can orchestrate this control
	let fieldRoot = $state<HTMLElement | null>(null);
	$effect(() => {
		if (f || !name || !fieldRoot) return;
		return registerSuiField(fieldRoot, {
			name,
			get: () => value,
			setSubmitErrors: (errors) => fieldState.setSubmitErrors(errors),
			clearSubmitErrors: () => fieldState.clearSubmitErrors()
		});
	});

	// fresh external errors (new `errors` prop reference) re-take the
	// display; re-passing an unchanged list never resurrects cleared ones
	$effect(() => fieldState.syncExternal(externalErrors));

	// report the DOM id for form-level error summaries
	$effect(() => {
		f?.registerControl(id);
	});

	// keep the bound shadow in sync with programmatic form changes (reset, setValues)
	$effect(() => {
		if (f) value = (f.value ?? '') as string;
	});

	const DOT_SIZE: Record<SuiSize, string> = {
		xs: 'size-3',
		sm: 'size-3.5',
		md: 'size-4',
		lg: 'size-[18px]',
		xl: 'size-5'
	};

	const allErrors = $derived(f ? f.errors : fieldState.displayed);
	const invalid = $derived(allErrors.length > 0);
	const effVariant = $derived(
		suiEffectiveVariant(f?.rewardValid ? 'success' : variant, invalid ? allErrors : undefined)
	);
	const hintId = $derived(`${id}-hint`);
	const messageId = $derived(`${id}-message`);
	const checking = $derived(!!f?.isValidating && !invalid);
	const checkingText = $derived(f?.checkingMessage ?? 'Checking…');
	// hint + error coexist in the description (GOV.UK pattern)
	const describedBy = $derived(
		[subText ? hintId : undefined, invalid ? messageId : undefined].filter(Boolean).join(' ') ||
			undefined
	);

	export function validate(): string[] {
		if (f) return f.validate();
		return fieldState.forceValidate(value, schema);
	}

	export function reset(): void {
		if (f) return f.clear();
		fieldState.reset();
	}
</script>

<div
	bind:this={fieldRoot}
	class={cn('flex w-full flex-col', className)}
	data-sui-control="radio-group"
	data-sui-size={size}
	data-invalid={invalid || undefined}
>
	{#if label}
		<div
			id="{id}-label"
			class="{SUI_FIELD_TEXT[effVariant]} mb-2 flex items-center gap-0.5 font-medium {SUI_LABEL[
				size
			]}"
			data-sui-label
		>
			{#if typeof label === 'string'}{label}{:else}{@render label()}{/if}
			{#if required}
				<span class="text-destructive" aria-hidden="true">*</span>
				<span class="sr-only">(required)</span>
			{/if}
		</div>
	{/if}

	<RadioGroup.Root
		{id}
		aria-labelledby={label ? `${id}-label` : undefined}
		bind:value
		disabled={disabled || undefined}
		required={required || undefined}
		data-sui-radio-group
		class={cn(
			'grid gap-2',
			orientation === 'horizontal' ? 'auto-cols-max grid-flow-col' : 'grid-cols-1'
		)}
		aria-invalid={invalid || undefined}
		aria-describedby={describedBy}
		onValueChange={(next: string) => {
			if (f) {
				f.change(next, 'discrete');
			} else {
				fieldState.validate(next, schema, 'change', validateOn);
			}
			onchange?.(next as never);
		}}
		onblur={(event) => {
			onblur?.(event as never);
			if (f) {
				f.blur();
				return;
			}
			fieldState.validate(value, schema, 'blur', validateOn);
		}}
		{...rest as Record<string, unknown>}
	>
		{#each items as item (item.value)}
			<label
				for={`${id}-${item.value}`}
				class="flex w-full cursor-pointer items-start gap-2 {item.disabled || disabled
					? 'cursor-not-allowed opacity-50'
					: ''}"
			>
				<RadioGroup.Item
					id={`${id}-${item.value}`}
					value={item.value}
					disabled={item.disabled}
					data-sui-radio-item
					class="{DOT_SIZE[size]} mt-0.5"
				/>
				<span class="flex flex-col gap-0.5">
					<span class="{SUI_LABEL[size]} leading-none font-medium text-foreground"
						>{item.label}</span
					>
					{#if item.description}
						<span class="text-muted-foreground {SUI_SUBTEXT[size]}">{item.description}</span>
					{/if}
				</span>
			</label>
		{/each}
	</RadioGroup.Root>

	{#if subText}
		<!-- GOV.UK pattern: the hint stays visible and associated when errors appear -->
		<div
			id={hintId}
			data-sui-field-hint
			class="{SUI_SUBTEXT[size]} {SUI_FIELD_TEXT[effVariant]} mt-1.5"
		>
			{subText}
		</div>
	{/if}
	<!-- Persistent live region: mounted before any message appears, so the
	     first announcement is not silently dropped. Collapses to zero height
	     while empty. -->
	<div
		id={messageId}
		data-sui-field-message={invalid || checking || undefined}
		data-sui-variant={effVariant}
		class="{SUI_SUBTEXT[size]} {SUI_FIELD_TEXT[effVariant]}"
		class:mt-1.5={invalid || checking}
		aria-live="polite"
	>
		{#if invalid}
			{#each allErrors as error (error)}
				<div>{error}</div>
			{/each}
		{:else if checking}
			<div class="flex items-center gap-1.5 text-muted-foreground">
				<LoaderCircleIcon class="size-3 animate-spin" aria-hidden="true" />
				{checkingText}
			</div>
		{/if}
	</div>
</div>
