<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { SuiFieldVariant, SuiIconComponent, SuiSize } from '../types.js';
	import type { SuiValidateOn } from '../zod.js';
	import type { SuiFieldHandle } from '../form/index.js';
	import type { SuiSchemaLike } from '../form/schema.js';

	/** A date range as ISO strings — both ends inclusive, either may be unset. */
	export type SuiDateRange = { start?: string | undefined; end?: string | undefined };

	/** A one-click range ("Last 7 days"). */
	export type SuiDateRangePreset = {
		label: string;
		/** Computed when clicked, so relative presets stay current. */
		range: () => { start: string; end: string };
	};

	export type SuiDateRangePickerProps = {
		label?: string | Snippet;
		subText?: string;
		size?: SuiSize;
		variant?: SuiFieldVariant;
		startIcon?: SuiIconComponent;
		/**
		 * The range as ISO strings (two-way bindable): `{ start: '2026-10-11',
		 * end: '2026-10-14' }`. Only complete ranges (or an empty one) are
		 * written back — a half-picked range never validates mid-selection.
		 */
		value?: SuiDateRange;
		/** Earliest selectable date, ISO. */
		min?: string;
		/** Latest selectable date, ISO. */
		max?: string;
		isDateUnavailable?: (date: string) => boolean;
		isDateDisabled?: (date: string) => boolean;
		/** Show the calendar button + popover. Default `true`. */
		calendar?: boolean;
		/** Months shown side by side on desktop. Default `2` (1 on phones). */
		months?: 1 | 2 | 3;
		/** One-click ranges in the calendar footer. */
		presets?: SuiDateRangePreset[];
		weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
		locale?: string;
		clearable?: boolean;
		/** Validates the `{ start, end }` object. Ignored when `field` is set. */
		schema?: SuiSchemaLike;
		validateOn?: SuiValidateOn;
		errors?: string[];
		/** `form.fields.stay` — a `z.object({ start, end })` field. */
		field?: SuiFieldHandle<SuiDateRange | null | undefined>;
		/** Native form `name`: posts `name.start` and `name.end`. Defaults to the `field` path. */
		name?: string;
		required?: boolean;
		disabled?: boolean;
		readonly?: boolean;
		id?: string;
		class?: string;
		onValueChange?: (value: { start: string | undefined; end: string | undefined }) => void;
	};
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import { DateRangePicker, Portal } from 'bits-ui';
	import type { DateValue } from '@internationalized/date';
	import SuiIcon from '../sui-icon.svelte';
	import DateRangeCalendar from './date-range-calendar.svelte';
	import { SuiFieldState } from '../field.svelte.js';
	import { registerSuiField } from '../form/field-registry.js';
	import { suiMobileQuery } from '../mobile.svelte.js';
	import { getSuiStrings } from '../strings.js';
	import { segmentInputBridge } from './segment-input.js';
	import { dateToIso, isoToDate } from './iso.js';
	import {
		suiEffectiveVariant,
		SUI_CLEAR_SIZE,
		SUI_CONTROL,
		SUI_FIELD_CONTROL,
		SUI_FIELD_TEXT,
		SUI_ICON,
		SUI_LABEL,
		SUI_SUBTEXT
	} from '../styles.js';
	import { cn } from '$lib/utils.js';
	import CalendarIcon from '@lucide/svelte/icons/calendar-range';
	import XIcon from '@lucide/svelte/icons/x';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';

	const uid = $props.id();
	const strings = getSuiStrings();
	const isMobile = suiMobileQuery();

	let {
		label,
		subText,
		size = 'md',
		variant = 'info',
		startIcon,
		value = $bindable<SuiDateRange | undefined>(undefined),
		min,
		max,
		isDateUnavailable,
		isDateDisabled,
		calendar = true,
		months = 2,
		presets,
		weekStartsOn,
		locale,
		clearable = false,
		schema,
		validateOn = 'both',
		errors: externalErrors = [],
		field: f,
		name,
		required = false,
		disabled = false,
		readonly = false,
		id = `sui-date-range-${uid}`,
		class: className = '',
		onValueChange
	}: SuiDateRangePickerProps = $props();

	const localeTag = $derived(locale ?? strings.locale);
	const current = $derived((f ? f.value : value) ?? undefined) as SuiDateRange | undefined;
	const hasValue = $derived(!!current?.start || !!current?.end);

	type Range = { start: DateValue | undefined; end: DateValue | undefined };
	const toRange = (r: SuiDateRange | undefined): Range => ({
		start: isoToDate(r?.start),
		end: isoToDate(r?.end)
	});
	const keyOf = (r: { start?: string | undefined; end?: string | undefined } | undefined) =>
		`${r?.start || ''}|${r?.end || ''}`;

	// What the picker shows. A half-picked range lives only here until it
	// completes; external changes (reset, setValues) replace it.
	let draft = $state<Range>(toRange(untrack(() => current)));
	let lastEmitted = untrack(() => keyOf(current));
	$effect(() => {
		const key = keyOf(current);
		if (key === lastEmitted) return;
		lastEmitted = key;
		draft = toRange(current);
	});

	let placeholder = $state<DateValue | undefined>(undefined);
	let open = $state(false);

	function commitIso(next: { start: string | undefined; end: string | undefined }) {
		const key = keyOf(next);
		if (key === keyOf(current)) return;
		lastEmitted = key;
		const out = { start: next.start || undefined, end: next.end || undefined };
		if (f) f.change(out, 'discrete');
		else {
			value = out;
			fieldState.validate(out, schema, 'change', validateOn);
		}
		onValueChange?.(out);
	}

	function onDraft(next: Range) {
		draft = next;
		const start = dateToIso(next.start);
		const end = dateToIso(next.end);
		// complete (or cleared) ranges are answers; half a range is not
		if ((start && end) || (!start && !end)) commitIso({ start, end });
	}

	function clear() {
		draft = { start: undefined, end: undefined };
		commitIso({ start: undefined, end: undefined });
		fieldRoot?.querySelector<HTMLElement>('[data-segment]:not([data-segment="literal"])')?.focus();
	}

	function applyPreset(preset: SuiDateRangePreset) {
		const r = preset.range();
		draft = toRange(r);
		commitIso(r);
		open = false;
	}

	// ---- validation / form wiring ----------------------------------------------
	const fieldState = new SuiFieldState();
	$effect(() => fieldState.syncExternal(externalErrors));

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
	$effect(() => f?.registerControl(id));

	const allErrors = $derived(f ? f.errors : fieldState.displayed);
	const invalid = $derived(allErrors.length > 0);
	const effVariant = $derived(
		suiEffectiveVariant(f?.rewardValid ? 'success' : variant, invalid ? allErrors : undefined)
	);
	const labelId = $derived(`${id}-label`);
	const hintId = $derived(`${id}-hint`);
	const messageId = $derived(`${id}-message`);
	const checking = $derived(!!f?.isValidating && !invalid);
	const checkingText = $derived(f?.checkingMessage ?? strings.checking);
	const describedBy = $derived(
		[subText ? hintId : undefined, invalid ? messageId : undefined].filter(Boolean).join(' ') ||
			undefined
	);
	const formName = $derived(name ?? f?.name);

	function onFocusOut(event: FocusEvent & { currentTarget: HTMLElement }) {
		const next = event.relatedTarget;
		if (next instanceof Node) {
			if (event.currentTarget.contains(next)) return;
			if (next instanceof Element && next.closest(`[data-sui-date-popover="${id}"]`)) return;
		}
		if (open) return;
		if (f) f.blur();
		else fieldState.validate(current ?? '', schema, 'blur', validateOn);
	}

	// pastes ("2026-10-11 – 2026-10-14", "2026-10-11/2026-10-14"), IME, Android
	const bridge = segmentInputBridge({
		onPaste: (text) => {
			const parts = text.match(/\d{4}-\d{2}-\d{2}/g);
			if (!parts || parts.length !== 2) return false;
			const [start, end] = parts as [string, string];
			if (!isoToDate(start) || !isoToDate(end)) return false;
			const ordered = start <= end ? { start, end } : { start: end, end: start };
			draft = toRange(ordered);
			commitIso(ordered);
			return true;
		}
	});

	export function validate(): string[] {
		if (f) return f.validate();
		return fieldState.forceValidate(current ?? '', schema);
	}

	export function reset(): void {
		if (f) return f.clear();
		fieldState.reset();
	}

	const segmentClass = (part: string) =>
		cn(
			'rounded-xs px-px tabular-nums caret-transparent outline-none',
			part === 'literal'
				? 'whitespace-pre text-muted-foreground'
				: 'focus:bg-accent focus:text-accent-foreground aria-[valuetext=Empty]:text-muted-foreground'
		);
</script>

<div
	bind:this={fieldRoot}
	class={cn('flex w-full flex-col', className)}
	data-sui-field="date-range-picker"
	data-sui-size={size}
	data-invalid={invalid || undefined}
>
	<DateRangePicker.Root
		bind:value={() => draft, onDraft}
		bind:placeholder
		bind:open
		locale={localeTag}
		minValue={isoToDate(min)}
		maxValue={isoToDate(max)}
		isDateUnavailable={isDateUnavailable ? (d) => isDateUnavailable(dateToIso(d)!) : undefined}
		isDateDisabled={isDateDisabled ? (d) => isDateDisabled(dateToIso(d)!) : undefined}
		{weekStartsOn}
		weekdayFormat="narrow"
		numberOfMonths={isMobile.current ? 1 : months}
		calendarLabel={typeof label === 'string' ? label : undefined}
		{disabled}
		{readonly}
		{required}
	>
		{#if label}
			<DateRangePicker.Label
				id={labelId}
				data-sui-label
				class="{SUI_LABEL[size]} {SUI_FIELD_TEXT[
					effVariant
				]} mb-2 flex items-center gap-0.5 font-medium"
			>
				{#if typeof label === 'string'}{label}{:else}{@render label()}{/if}
				{#if required}
					<span class="text-destructive" aria-hidden="true">*</span>
				{/if}
			</DateRangePicker.Label>
		{/if}

		<div
			data-sui-control="date-range-picker"
			data-sui-size={size}
			data-sui-variant={effVariant}
			data-invalid={invalid || undefined}
			data-disabled={disabled || undefined}
			class={cn(
				'relative flex w-full items-center rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] outline-none focus-within:ring-3 dark:bg-input/30 dark:focus-within:bg-input/50',
				SUI_CONTROL[size],
				SUI_FIELD_CONTROL[effVariant],
				disabled && 'cursor-not-allowed opacity-50'
			)}
			onfocusout={onFocusOut}
		>
			{#if startIcon}
				<span class="pointer-events-none shrink-0 text-muted-foreground">
					<SuiIcon icon={startIcon} {size} />
				</span>
			{/if}

			{#if formName}
				<input
					type="hidden"
					name="{formName}.start"
					value={current?.start ?? ''}
					data-sui-hidden-input
				/>
				<input
					type="hidden"
					name="{formName}.end"
					value={current?.end ?? ''}
					data-sui-hidden-input
				/>
			{/if}

			<div
				class="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden whitespace-nowrap"
				data-sui-date-input
				{id}
				role="presentation"
				aria-describedby={describedBy}
			>
				{#each ['start', 'end'] as const as type (type)}
					<DateRangePicker.Input
						{type}
						{...bridge}
						aria-invalid={invalid || undefined}
						class="flex items-center"
					>
						{#snippet children({ segments })}
							{#each segments as { part, value: text }, i (part + i)}
								<DateRangePicker.Segment {part} class={segmentClass(part)}>
									{text}
								</DateRangePicker.Segment>
							{/each}
						{/snippet}
					</DateRangePicker.Input>
					{#if type === 'start'}
						<span class="text-muted-foreground" aria-hidden="true">–</span>
					{/if}
				{/each}
			</div>

			{#if clearable && hasValue && !disabled && !readonly}
				<button
					type="button"
					data-sui-clear
					class="{SUI_CLEAR_SIZE[
						size
					]} flex shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
					aria-label={strings.clearSelection}
					onclick={clear}
				>
					<SuiIcon icon={XIcon} size="xs" />
				</button>
			{/if}

			{#if calendar}
				<DateRangePicker.Trigger
					data-sui-date-trigger
					aria-label={strings.openCalendar}
					class="-me-1 flex shrink-0 cursor-pointer items-center justify-center rounded-sm p-1 text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed"
				>
					<CalendarIcon class={SUI_ICON[size]} aria-hidden="true" />
				</DateRangePicker.Trigger>
			{/if}
		</div>

		{#if calendar}
			<Portal>
				<DateRangePicker.Content
					sideOffset={4}
					align="end"
					data-sui-date-popover={id}
					class="z-50 flex max-w-[calc(100vw-1rem)] flex-col rounded-md bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
				>
					<DateRangeCalendar bind:placeholder locale={localeTag} />
					{#if presets?.length}
						<div class="flex flex-wrap items-center gap-1 border-t px-3 py-2">
							{#each presets as preset (preset.label)}
								<button
									type="button"
									data-sui-date-preset
									class="cursor-pointer rounded-md px-2 py-1 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
									onclick={() => applyPreset(preset)}
								>
									{preset.label}
								</button>
							{/each}
						</div>
					{/if}
				</DateRangePicker.Content>
			</Portal>
		{/if}
	</DateRangePicker.Root>

	{#if subText}
		<div
			id={hintId}
			data-sui-field-hint
			class="{SUI_SUBTEXT[size]} {SUI_FIELD_TEXT[effVariant]} mt-1.5"
		>
			{subText}
		</div>
	{/if}
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
