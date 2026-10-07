<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import type { SuiActionSnippet, SuiFieldVariant, SuiIconComponent, SuiSize } from '../types.js';
	import type { SuiValidateOn } from '../zod.js';
	import type { SuiFieldHandle } from '../form/index.js';
	import type { SuiSchemaLike } from '../form/schema.js';

	export type SuiTextareaProps = Omit<HTMLTextareaAttributes, 'size' | 'value' | 'class'> & {
		label?: string | Snippet;
		subText?: string;
		/** sui size — controls height baseline and text size. Default `md`. */
		size?: SuiSize;
		variant?: SuiFieldVariant;
		startIcon?: SuiIconComponent;
		action?: SuiActionSnippet;
		/** zod v4 schema or any Standard Schema v1 schema. Ignored when `field` is set. */
		schema?: SuiSchemaLike;
		/** When to run `schema`. Default `auto` (blur first, then every change). */
		validateOn?: SuiValidateOn;
		errors?: string[];
		/** Schema-driven form handle (`form.fields.bio` from `createSuiForm`). */
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
		ref?: HTMLTextAreaElement | null;
	};
</script>

<script lang="ts">
	import SuiIcon from '../sui-icon.svelte';
	import { SuiFieldState } from '../field.svelte.js';
	import { registerSuiField } from '../form/field-registry.js';
	import {
		suiEffectiveVariant,
		SUI_FIELD_CONTROL,
		SUI_FIELD_TEXT,
		SUI_LABEL,
		SUI_SUBTEXT,
		SUI_TEXTAREA
	} from '../styles.js';
	import { cn } from '$lib/utils.js';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';

	let {
		label,
		subText,
		size = 'md',
		variant = 'info',
		startIcon,
		action,
		schema,
		validateOn = 'auto',
		errors: externalErrors = [],
		name,
		field: f,
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

	// controlled value: the form handle owns it when present
	const current = $derived(f ? f.value : value);

	const allErrors = $derived(f ? f.errors : fieldState.displayed);
	const invalid = $derived(allErrors.length > 0);
	// reward early: a revealed, valid, answered field earns the success ring
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

<!-- Single root: the field never leaks layout primitives into the parent.
     The wrapper has no fixed height and no horizontal padding — the inner
     <textarea
                {name} rows> drives the height and owns its px-3 py-2 padding, so the
     field renders as a real multi-line box instead of a one-line input. -->
<div
	bind:this={fieldRoot}
	class={cn('flex w-full flex-col', className)}
	data-sui-field="textarea"
	data-sui-size={size}
>
	{#if label}
		<label
			for={id}
			data-sui-label
			class="{SUI_LABEL[size]} {SUI_FIELD_TEXT[
				effVariant
			]} mb-2 flex items-center gap-0.5 font-medium"
		>
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
			'relative flex w-full rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] outline-none focus-within:ring-3 dark:bg-input/30 dark:focus-within:bg-input/50',
			SUI_TEXTAREA[size],
			SUI_FIELD_CONTROL[effVariant]
		)}
	>
		{#if startIcon}
			<span class="pointer-events-none shrink-0 self-start ps-3 pt-[0.6em] text-muted-foreground">
				<SuiIcon icon={startIcon} {size} />
			</span>
		{/if}
		<textarea
			bind:this={ref}
			{id}
			value={current}
			{disabled}
			{placeholder}
			{required}
			{rows}
			data-sui-textarea
			class="w-full min-w-0 flex-1 resize-y bg-transparent px-3 py-2 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed dark:bg-input/30"
			aria-invalid={invalid || undefined}
			aria-describedby={describedBy}
			oninput={(event) => {
				oninput?.(event);
				const next = event.currentTarget.value;
				if (f) f.change(next, 'text');
				else {
					value = next;
					fieldState.validate(next, schema, 'change', validateOn);
				}
			}}
			onchange={(event) => {
				onchange?.(event);
				if (f) return;
				fieldState.validate(event.currentTarget.value, schema, 'change', validateOn);
			}}
			onblur={(event) => {
				onblur?.(event);
				if (f) {
					f.blur();
					return;
				}
				fieldState.validate(event.currentTarget.value, schema, 'blur', validateOn);
			}}
			{...rest}></textarea>
		{#if action}
			<span data-sui-action class="flex shrink-0 items-center self-start pe-2.5 pt-2">
				{@render action({ size })}
			</span>
		{/if}
	</div>

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
