<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import type { SuiSchemaLike } from '../form/schema.js';
	import type { SuiFieldVariant, SuiSize } from '../types.js';
	import type { SuiFieldHandle } from '../form/index.js';

	export type SuiSwitchProps = Omit<HTMLInputAttributes, 'size' | 'value' | 'class'> & {
		label?: string | Snippet;
		subText?: string | Snippet;
		size?: SuiSize;
		variant?: SuiFieldVariant;
		/** zod v4 schema (typically `z.boolean()`). Ignored when `field` is set. */
		schema?: SuiSchemaLike;
		/** When to run `schema`. Default `both` (change + blur). */
		validateOn?: 'auto' | 'change' | 'blur' | 'both' | 'none';
		errors?: string[];
		/** Schema-driven form handle (`form.fields.enabled` from `createSuiForm`). */
		field?: SuiFieldHandle<boolean | undefined>;
		required?: boolean;
		/**
		 * Schema path this field maps to when a form-level submitter
		 * (`createSuiSubmitter`) orchestrates the form. Ignored when `field`
		 * is set — `createSuiForm` drives those.
		 */
		name?: string;
		id?: string;
		class?: string;
		checked?: boolean;
	};
</script>

<script lang="ts">
	import Switch from '$lib/components/ui/switch/switch.svelte';
	import { SuiFieldState } from '../field.svelte.js';
	import { registerSuiField } from '../form/field-registry.js';
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
		name,
		field: f,
		required = false,
		class: className = '',
		id = `sui-switch-${crypto.randomUUID()}`,
		checked = $bindable(false),
		disabled,
		onblur,
		...rest
	}: SuiSwitchProps = $props();

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
			get: () => checked,
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
		if (f) checked = !!f.value;
	});

	const TRACK_SIZE: Record<SuiSize, string> = {
		xs: 'h-3.5 w-6 [&_span]:size-2.5',
		sm: 'h-4 w-7 [&_span]:size-3',
		md: 'h-5 w-9 [&_span]:size-4',
		lg: 'h-6 w-11 [&_span]:size-5',
		xl: 'h-7 w-13 [&_span]:size-6'
	};

	const allErrors = $derived(f ? f.errors : fieldState.displayed);
	const invalid = $derived(allErrors.length > 0);
	const effVariant = $derived(
		suiEffectiveVariant(f?.rewardValid ? 'success' : variant, invalid ? allErrors : undefined)
	);
	const hintId = $derived(`${id}-hint`);
	const messageId = $derived(`${id}-message`);
	// hint + error coexist in the description (GOV.UK pattern; the old
	// derivation pointed at a non-existent id whenever only a hint showed)
	const describedBy = $derived(
		[subText ? hintId : undefined, invalid ? messageId : undefined].filter(Boolean).join(' ') ||
			undefined
	);

	export function validate(): string[] {
		if (f) return f.validate();
		return fieldState.forceValidate(checked, schema);
	}

	export function reset(): void {
		if (f) return f.clear();
		fieldState.reset();
	}
</script>

<div
	bind:this={fieldRoot}
	class={cn('flex w-full items-start justify-between gap-3', className)}
	data-sui-control="switch"
	data-sui-size={size}
	data-invalid={invalid || undefined}
>
	<div class="flex w-full flex-col">
		{#if label}
			<label
				for={id}
				data-sui-label
				class="{SUI_LABEL[size]} {SUI_FIELD_TEXT[effVariant]} leading-none font-medium {disabled
					? 'opacity-50'
					: ''}"
			>
				{#if typeof label === 'string'}{label}{:else}{@render label()}{/if}
				{#if required}
					<span class="text-destructive" aria-hidden="true">*</span>
					<span class="sr-only">(required)</span>
				{/if}
			</label>
		{/if}
		{#if subText}
			<div
				id={hintId}
				data-sui-field-hint
				class="{SUI_SUBTEXT[size]} {SUI_FIELD_TEXT[effVariant]} mt-0.5"
			>
				{#if typeof subText === 'string'}{subText}{:else}{@render subText()}{/if}
			</div>
		{/if}
		<!-- Persistent live region: mounted before any message appears, so the
		     first announcement is not silently dropped. Collapses to zero height
		     while empty. -->
		<div
			id={messageId}
			data-sui-field-message={invalid || undefined}
			class="{SUI_SUBTEXT[size]} {SUI_FIELD_TEXT[effVariant]}"
			class:mt-0.5={invalid}
			aria-live="polite"
		>
			{#each allErrors as error (error)}
				<div>{error}</div>
			{/each}
		</div>
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
			if (f) {
				f.change(value, 'discrete');
				return;
			}
			fieldState.validate(value, schema, 'change', validateOn);
		}}
		onblur={(event) => {
			onblur?.(event as never);
			if (f) {
				f.blur();
				return;
			}
			fieldState.validate(checked, schema, 'blur', validateOn);
		}}
		{...rest as Record<string, unknown>}
	/>
</div>
