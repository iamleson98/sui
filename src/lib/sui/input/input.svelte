<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import type { SuiActionSnippet, SuiFieldVariant, SuiIconComponent, SuiSize } from '../types.js';
	import type { SuiValidateOn } from '../zod.js';
	import type { SuiFieldHandle } from '../form/index.js';
	import type { SuiSchemaLike } from '../form/schema.js';

	export type SuiInputProps = Omit<HTMLInputAttributes, 'size' | 'value' | 'class'> & {
		/** Field label rendered above the control. */
		label?: string | Snippet;
		/** Helper text rendered below the control — stays visible (and associated) when errors appear. */
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
		/** zod v4 schema or any Standard Schema v1 schema — validated on blur (then on change once touched), errors render below. Ignored when `field` is set. */
		schema?: SuiSchemaLike;
		/** When to run `schema`. Default `auto` (blur first, then every change). */
		validateOn?: SuiValidateOn;
		/** Manually supplied error messages (shown in addition to schema errors). */
		errors?: string[];
		/**
		 * Schema-driven form handle (`form.fields.email` from `createSuiForm`):
		 * the value, validation timing and error display are wired
		 * automatically — no `bind:value`, `schema` or `errors` needed.
		 * With `type="number"` the field holds a `number` (`undefined` while
		 * empty), so `z.number()` schemas work as-is.
		 */
		field?: SuiFieldHandle<string | number | null | undefined>;
		/** Mark the label with a required indicator. */
		required?: boolean;
		/** Debounce (ms) applied to change validation. Default `0`. */
		validateDebounce?: number;
		/**
		 * The input's `name` (native form data, browser autofill) — and the
		 * schema path a form-level submitter (`createSuiSubmitter`) maps it
		 * to. Defaults to the `field` handle's path.
		 */
		name?: string;
		/** Accessible id — a hydration-safe one is generated when omitted. */
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
	import { registerSuiField } from '../form/field-registry.js';
	import {
		suiEffectiveVariant,
		SUI_CONTROL,
		SUI_FIELD_CONTROL,
		SUI_FIELD_LABEL,
		SUI_FIELD_TEXT,
		SUI_LABEL,
		SUI_SUBTEXT
	} from '../styles.js';
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
		startIcon,
		endIcon,
		action,
		schema,
		validateOn = 'auto',
		errors: externalErrors = [],
		name,
		field: f,
		required = false,
		validateDebounce = 0,
		class: className = '',
		id = `sui-input-${uid}`,
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

	// `fieldState` backs standalone usage (`schema` prop); a `field` handle
	// from createSuiForm takes over values, timing and error display
	const fieldState = new SuiFieldState();

	// `type="number"`: schemas validate (and submitters collect) a number —
	// `undefined` while empty — never the raw string ('' would coerce to 0)
	const isNumber = $derived(type === 'number');
	function parseNumber(raw: string): number | undefined {
		if (raw.trim() === '') return undefined;
		const n = Number(raw);
		return Number.isFinite(n) ? n : undefined;
	}
	/** The value schemas and submitters see for a raw input string. */
	function schemaValue(raw: string): unknown {
		return isNumber ? parseNumber(raw) : raw;
	}

	// form-level submitter wiring: register the live value + error channel
	// on the field root so `createSuiSubmitter` can orchestrate this control
	let fieldRoot = $state<HTMLElement | null>(null);
	$effect(() => {
		if (f || !name || !fieldRoot) return;
		return registerSuiField(fieldRoot, {
			name,
			get: () => schemaValue(value),
			setSubmitErrors: (errors) => fieldState.setSubmitErrors(errors),
			clearSubmitErrors: () => fieldState.clearSubmitErrors()
		});
	});

	// stop a pending debounced validation once the field is gone
	$effect(() => () => clearTimeout(validateTimer));

	// fresh external errors (new `errors` prop reference) re-take the
	// display; re-passing an unchanged list never resurrects cleared ones
	$effect(() => fieldState.syncExternal(externalErrors));

	let validateTimer: ReturnType<typeof setTimeout> | undefined;
	let pendingValue = '';

	function scheduleValidate(current: string) {
		pendingValue = current;
		clearTimeout(validateTimer);
		if (validateDebounce <= 0) {
			fieldState.validate(schemaValue(current), schema, 'change', validateOn);
			return;
		}
		validateTimer = setTimeout(() => {
			fieldState.validate(schemaValue(pendingValue), schema, 'change', validateOn);
		}, validateDebounce);
	}

	// report the DOM id for form-level error summaries (unregistered on unmount)
	$effect(() => f?.registerControl(id));

	// The DOM value goes through Svelte's own `bind:value` machinery (with
	// function bindings) rather than a one-way `value=` + `oninput`: it
	// keeps text typed BEFORE hydration on prerendered pages, never
	// rewrites a focused input mid-edit, converts `type="number"` to
	// `number | null` and leaves half-typed numbers ("1.", "-") alone.
	function readValue(): string | number | null {
		if (isNumber) {
			const stored = f ? f.value : parseNumber(value);
			return typeof stored === 'number' ? stored : null;
		}
		return (f ? f.value : value) ?? '';
	}

	function writeValue(next: unknown) {
		if (isNumber) {
			const n = typeof next === 'number' && Number.isFinite(next) ? next : undefined;
			if (f) f.change(n, 'text');
			else {
				value = n === undefined ? '' : String(n);
				scheduleValidate(value);
			}
			return;
		}
		const text = typeof next === 'string' ? next : '';
		if (f) f.change(text, 'text');
		else {
			value = text;
			scheduleValidate(text);
		}
	}

	// the form wins the `name` by default (autofill + native form data)
	const inputName = $derived(name ?? f?.name);

	const allErrors = $derived(f ? f.errors : fieldState.displayed);
	const invalid = $derived(allErrors.length > 0);
	// reward early: a revealed, valid, answered field earns the success ring
	const effVariant = $derived(
		suiEffectiveVariant(f?.rewardValid ? 'success' : variant, invalid ? allErrors : undefined)
	);
	const hintId = $derived(`${id}-hint`);
	const messageId = $derived(`${id}-message`);
	const checking = $derived(!!f?.isValidating && !invalid);
	const checkingText = $derived(f?.checkingMessage ?? strings.checking);
	// hint + error coexist in the description (GOV.UK: the hint must stay
	// associated when errors appear — errors never replace instructions);
	// a consumer's own aria-describedby is kept, not overwritten
	const describedBy = $derived(
		[
			(rest as { 'aria-describedby'?: string })['aria-describedby'],
			subText ? hintId : undefined,
			invalid ? messageId : undefined
		]
			.filter(Boolean)
			.join(' ') || undefined
	);

	/** Programmatically validate (e.g. on submit). */
	export function validate(): string[] {
		if (f) return f.validate();
		clearTimeout(validateTimer);
		return fieldState.forceValidate(schemaValue(value), schema);
	}

	/** Reset validation fieldState. */
	export function reset(): void {
		if (f) return f.clear();
		fieldState.reset();
	}
</script>

<!-- Single root: the field never leaks layout primitives into the parent,
     so external grid/flex gaps can't separate label, control and message. -->
<div
	bind:this={fieldRoot}
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
			class="{SUI_LABEL[size]} {SUI_FIELD_LABEL[
				effVariant
			]} mb-2 flex items-center gap-0.5 font-medium"
		>
			{#if typeof label === 'string'}{label}{:else}{@render label()}{/if}
			{#if required}
				<!-- visual marker only: the input's `required` already announces it -->
				<span class="text-destructive" aria-hidden="true">*</span>
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
			'relative flex w-full items-center rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] outline-none focus-within:ring-3 dark:bg-input/30 dark:focus-within:bg-input/50',
			SUI_CONTROL[size],
			SUI_FIELD_CONTROL[effVariant]
		)}
	>
		{#if startIcon}
			<span class="pointer-events-none shrink-0 text-muted-foreground">
				<SuiIcon icon={startIcon} {size} />
			</span>
		{/if}

		<input
			bind:this={ref}
			{id}
			name={inputName}
			bind:value={readValue, writeValue}
			{type}
			{...autoAttrs}
			{disabled}
			{placeholder}
			{required}
			data-sui-input
			class="w-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
			aria-invalid={invalid || undefined}
			{...rest}
			aria-describedby={describedBy}
			oninput={(event) => oninput?.(event)}
			onchange={(event) => {
				onchange?.(event);
				const next = event.currentTarget.value;
				if (f) return;
				clearTimeout(validateTimer);
				fieldState.validate(schemaValue(next), schema, 'change', validateOn);
			}}
			onblur={(event) => {
				onblur?.(event);
				if (f) {
					f.blur();
					return;
				}
				clearTimeout(validateTimer);
				fieldState.validate(schemaValue(event.currentTarget.value), schema, 'blur', validateOn);
			}}
		/>

		{#if endIcon}
			<span class="pointer-events-none shrink-0 text-muted-foreground">
				<SuiIcon icon={endIcon} {size} />
			</span>
		{/if}
		{#if action}
			<span data-sui-action class="flex shrink-0 items-center">
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
             first announcement is not silently dropped (a live region created
             together with its content is frequently not announced). Collapses to
             zero height while empty. -->
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
