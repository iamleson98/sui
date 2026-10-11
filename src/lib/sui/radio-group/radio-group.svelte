<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import type { SuiSchemaLike } from '../form/schema.js';
	import type { SuiFieldVariant, SuiItem, SuiSize } from '../types.js';
	import type { SuiFieldHandle } from '../form/index.js';

	export type SuiRadioItem = SuiItem<string>;

	export type SuiRadioGroupProps = Omit<
		HTMLInputAttributes,
		'size' | 'value' | 'class' | 'onchange'
	> & {
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
		 * Native form `name` (a hidden input carries the value for
		 * `FormData` / progressive enhancement) — and the schema path a
		 * form-level submitter (`createSuiSubmitter`) maps it to. Defaults
		 * to the `field` handle's path.
		 */
		name?: string;
		/** Accessible id — a hydration-safe one is generated when omitted. */
		id?: string;
		class?: string;
		value?: string;
		/** Fires when the user picks an option. */
		onValueChange?: (value: string) => void;
	};
</script>

<script lang="ts">
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import { SuiFieldState } from '../field.svelte.js';
	import { registerSuiField } from '../form/field-registry.js';
	import { suiEffectiveVariant, SUI_FIELD_TEXT, SUI_LABEL, SUI_SUBTEXT } from '../styles.js';
	import { getSuiStrings } from '../strings.js';
	import { cn } from '$lib/utils.js';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';

	const uid = $props.id();
	const strings = getSuiStrings();

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
		id = `sui-radio-${uid}`,
		value = $bindable(''),
		disabled,
		onValueChange,
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

	// report the DOM id for form-level error summaries (unregistered on unmount)
	$effect(() => f?.registerControl(id));

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
	const checkingText = $derived(f?.checkingMessage ?? strings.checking);
	// hint + error coexist in the description (GOV.UK pattern); a
	// consumer's own aria-describedby is kept, not overwritten
	const describedBy = $derived(
		[
			(rest as { 'aria-describedby'?: string })['aria-describedby'],
			subText ? hintId : undefined,
			invalid ? messageId : undefined
		]
			.filter(Boolean)
			.join(' ') || undefined
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
				<!-- visual marker only: the group's aria-required already announces it -->
				<span class="text-destructive" aria-hidden="true">*</span>
			{/if}
		</div>
	{/if}

	<RadioGroup.Root
		{id}
		aria-labelledby={label ? `${id}-label` : undefined}
		bind:value
		name={name ?? f?.name}
		disabled={disabled || undefined}
		required={required || undefined}
		data-sui-radio-group
		class={cn(
			'grid gap-2',
			orientation === 'horizontal' ? 'auto-cols-max grid-flow-col' : 'grid-cols-1'
		)}
		aria-invalid={invalid || undefined}
		{...rest as Record<string, unknown>}
		aria-describedby={describedBy}
		onValueChange={(next: string) => {
			if (f) f.change(next, 'discrete');
			else fieldState.validate(next, schema, 'change', validateOn);
			onValueChange?.(next);
		}}
		onfocusout={(event: FocusEvent & { currentTarget: HTMLElement }) => {
			// the radiogroup itself never holds focus (its options do) and
			// `blur` does not bubble: validate when focus LEAVES the group,
			// not when it moves between options
			const next = event.relatedTarget;
			if (next instanceof Node && event.currentTarget.contains(next)) return;
			onblur?.(event as never);
			if (f) {
				f.blur();
				return;
			}
			fieldState.validate(value, schema, 'blur', validateOn);
		}}
	>
		{#each items as item, index (item.value)}
			<!-- index-based ids: option values may contain spaces or symbols -->
			<label
				for={`${id}-option-${index}`}
				class="flex w-full cursor-pointer items-start gap-2 {item.disabled || disabled
					? 'cursor-not-allowed opacity-50'
					: ''}"
			>
				<RadioGroup.Item
					id={`${id}-option-${index}`}
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
