<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import type { ZodType } from 'zod';
	import type { SuiActionSnippet, SuiFieldVariant, SuiIconComponent, SuiSize } from '../types.js';
	import type { SuiValidateOn } from '../zod.js';

	export type SuiInputProps = Omit<HTMLInputAttributes, 'size' | 'value' | 'class'> & {
		/** Field label rendered above the control. */
		label?: string | Snippet;
		/** Helper text rendered below the control (replaced by error messages when invalid). */
		subText?: string;
		/** sui size — heights match all other sui controls. Default `md`. */
		size?: SuiSize;
		/** Semantic color variant. Default `info` (blue). */
		variant?: SuiFieldVariant;
		/** Icon rendered at the start of the control. */
		startIcon?: SuiIconComponent;
		/** Icon rendered at the end of the control. */
		endIcon?: SuiIconComponent;
		/** Interactive snippet rendered at the end (buttons, toggles…). */
		action?: SuiActionSnippet;
		/** zod v4 schema — validated on blur (then on change once touched), errors render below. */
		schema?: ZodType;
		/** When to run `schema`. Default `auto` (blur first, then every change). */
		validateOn?: SuiValidateOn;
		/** Manually supplied error messages (shown in addition to schema errors). */
		errors?: string[];
		/** Mark the label with a required indicator. */
		required?: boolean;
		/** Debounce (ms) applied to change validation. Default `0`. */
		validateDebounce?: number;
		/** Accessible id — one is generated automatically when omitted. */
		id?: string;
		/** Extra classes for the control wrapper. */
		class?: string;
		/** The input value (two-way bindable). */
		value?: string;
		/** Access to the underlying `<input>` element. */
		ref?: HTMLInputElement | null;
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
		endIcon,
		action,
		schema,
		validateOn = 'auto',
		errors: externalErrors = [],
		required = false,
		validateDebounce = 0,
		class: className = '',
		id = `sui-input-${crypto.randomUUID()}`,
		value = $bindable(''),
		ref = $bindable<HTMLInputElement | null>(null),
		disabled,
		placeholder,
		type = 'text',
		oninput,
		onchange,
		onblur,
		...rest
	}: SuiInputProps = $props();

	// Mobile-first virtual keyboard: derive `inputmode` from `type` when
	// the consumer has not set one (email → email keyboard, number →
	// decimal pad…), and keep email fields from auto-capitalizing. One
	// object — never a union — so the element spread stays one shape.
	const autoAttrs = $derived.by(() => {
		const attrs: {
			inputmode?: HTMLInputAttributes['inputmode'];
			autocapitalize?: HTMLInputAttributes['autocapitalize'];
			autocorrect?: HTMLInputAttributes['autocorrect'];
		} = {};
		if (type === 'email') {
			attrs.autocapitalize = 'none';
			attrs.autocorrect = 'off';
		}
		const derived: HTMLInputAttributes['inputmode'] =
			type === 'email'
				? 'email'
				: type === 'tel'
				? 'tel'
				: type === 'url'
				? 'url'
				: type === 'number'
				? 'decimal'
				: undefined;
		attrs.inputmode =
			(rest as { inputmode?: HTMLInputAttributes['inputmode'] }).inputmode ?? derived;
		return attrs;
	});

	const field = new SuiFieldState();

	// fresh external errors (new `errors` prop reference) re-take the
	// display; re-passing an unchanged list never resurrects cleared ones
	$effect(() => field.syncExternal(externalErrors));

	let validateTimer: ReturnType<typeof setTimeout> | undefined;
	let pendingValue = '';

	function scheduleValidate(current: string) {
		pendingValue = current;
		clearTimeout(validateTimer);
		if (validateDebounce <= 0) {
			field.validate(current, schema, 'change', validateOn);
			return;
		}
		validateTimer = setTimeout(() => {
			field.validate(pendingValue, schema, 'change', validateOn);
		}, validateDebounce);
	}

	// deduped: the same message can arrive from both the `errors` prop (server)
	// and the local zod validation — duplicate keys would break {#each (error)}
	const allErrors = $derived(field.displayed);
	const invalid = $derived(allErrors.length > 0);
	const effVariant = $derived(suiEffectiveVariant(variant, invalid ? allErrors : undefined));
	const messageId = $derived(`${id}-message`);
	const describedBy = $derived(invalid || subText ? messageId : undefined);

	/** Programmatically validate (e.g. on submit). */
	export function validate(): string[] {
		clearTimeout(validateTimer);
		return field.forceValidate(value, schema);
	}

	/** Reset validation state. */
	export function reset(): void {
		field.reset();
	}
</script>

<!-- Single root: the field never leaks layout primitives into the parent,
     so external grid/flex gaps can't separate label, control and message. -->
<div
	class={cn('flex w-full flex-col', className)}
	data-sui-field="input"
	data-sui-size={size}
	data-sui-variant={effVariant}
	data-invalid={invalid || undefined}
	data-disabled={disabled || undefined}
>
	{#if label}
		<label
			for={id}
			data-sui-label
			class="{SUI_LABEL[size]} {SUI_FIELD_TEXT[effVariant]} mb-2 flex items-center gap-0.5 font-medium"
		>
			{#if typeof label === 'string'}{label}{:else}{@render label()}{/if}
			{#if required}
				<span class="text-destructive" aria-hidden="true">*</span>
				<span class="sr-only">(required)</span>
			{/if}
		</label>
	{/if}

	<div
		data-sui-control="input"
		data-sui-size={size}
		data-sui-variant={effVariant}
		data-invalid={invalid || undefined}
		data-disabled={disabled || undefined}
		class={cn(
			'border-input bg-transparent dark:bg-input/30 dark:focus-within:bg-input/50 focus-within:ring-3 shadow-xs relative flex w-full items-center rounded-md border transition-[color,box-shadow] outline-none',
			SUI_CONTROL[size],
			SUI_FIELD_CONTROL[effVariant]
		)}
	>
	{#if startIcon}
		<span class="text-muted-foreground pointer-events-none shrink-0">
			<SuiIcon icon={startIcon} {size} />
		</span>
	{/if}

	<input
		bind:this={ref}
		{id}
		bind:value
		{type}
		{...autoAttrs}
		{disabled}
		{placeholder}
		{required}
		data-sui-input
		class="placeholder:text-muted-foreground disabled:cursor-not-allowed w-full min-w-0 flex-1 bg-transparent outline-none"
		aria-invalid={invalid || undefined}
		aria-describedby={describedBy}
		oninput={(event) => {
			oninput?.(event);
			scheduleValidate(event.currentTarget.value);
		}}
		onchange={(event) => {
			onchange?.(event);
			clearTimeout(validateTimer);
			field.validate(event.currentTarget.value, schema, 'change', validateOn);
		}}
		onblur={(event) => {
			onblur?.(event);
			clearTimeout(validateTimer);
			field.validate(event.currentTarget.value, schema, 'blur', validateOn);
		}}
		{...rest}
	/>

	{#if endIcon}
		<span class="text-muted-foreground pointer-events-none shrink-0">
			<SuiIcon icon={endIcon} {size} />
		</span>
	{/if}
	{#if action}
		<span data-sui-action class="flex shrink-0 items-center">
			{@render action({ size })}
		</span>
	{/if}
	</div>

	{#if invalid || subText}
		<div
			id={messageId}
			data-sui-field-message
			data-sui-variant={effVariant}
			class="{SUI_SUBTEXT[size]} {SUI_FIELD_TEXT[effVariant]} mt-1.5"
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
