<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { SuiFieldVariant, SuiIconComponent, SuiSize } from '../types.js';
	import type { SuiValidateOn } from '../zod.js';
	import type { SuiFieldHandle } from '../form/index.js';
	import type { SuiSchemaLike } from '../form/schema.js';
	import type { SuiTimeGranularity } from './iso.js';

	export type SuiDatePickerProps = {
		/** Field label rendered above the control. */
		label?: string | Snippet;
		/** Helper text below the field — stays visible (and associated) when errors appear. */
		subText?: string;
		/** sui size — heights match all other sui controls. Default `md`. */
		size?: SuiSize;
		/** Semantic color variant. Default `info`. */
		variant?: SuiFieldVariant;
		/** Icon at the start of the field. */
		startIcon?: SuiIconComponent;
		/**
		 * The value as an ISO string (two-way bindable): `'2026-10-11'`
		 * (`SuiDateTimePicker`: `'2026-10-11T14:30'`). Empty → `undefined`.
		 */
		value?: string;
		/** Earliest allowed date, ISO. Earlier days are disabled in the calendar. */
		min?: string;
		/** Latest allowed date, ISO. Later days are disabled in the calendar. */
		max?: string;
		/** Days that exist but can't be booked (struck through): receives an ISO date. */
		isDateUnavailable?: (date: string) => boolean;
		/** Days that can't be selected at all (dimmed): receives an ISO date. */
		isDateDisabled?: (date: string) => boolean;
		/**
		 * Show the calendar button + popover. Default `true`. Turn it off for
		 * memorable dates (date of birth, issue dates) — typing is faster and
		 * GOV.UK / USWDS research advises against calendars there.
		 */
		calendar?: boolean;
		/** `'dropdown'` adds month/year selects to the calendar for distant dates. Default `'label'`. */
		captionLayout?: 'label' | 'dropdown';
		/** First day of the week (0 = Sunday). Default: the locale's. */
		weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
		/** BCP 47 locale (segment order, names). Default: `setSuiStrings({ locale })`, else `en-US`. */
		locale?: string;
		/** Show a "Today" shortcut under the calendar. Default `true`. */
		showToday?: boolean;
		/** Allow clearing the value (✕ button). Default `false`. */
		clearable?: boolean;
		/** zod v4 / Standard Schema — validates the ISO string (`z.iso.date()` etc.). Ignored when `field` is set. */
		schema?: SuiSchemaLike;
		/** When to run `schema`. Default `both` (every completed date + blur). */
		validateOn?: SuiValidateOn;
		/** External (server) errors — shown until the field is edited. */
		errors?: string[];
		/** Schema-driven form handle (`form.fields.startDate` from `createSuiForm`). */
		field?: SuiFieldHandle<string | null | undefined>;
		/**
		 * Native form `name` (a hidden input posts the ISO value) — and the
		 * schema path `createSuiSubmitter` maps it to. Defaults to the
		 * `field` handle's path.
		 */
		name?: string;
		required?: boolean;
		disabled?: boolean;
		readonly?: boolean;
		/** Accessible id — a hydration-safe one is generated when omitted. */
		id?: string;
		/** Extra classes for the root. */
		class?: string;
		/** Fires with the new ISO value (or `undefined` when cleared). */
		onValueChange?: (value: string | undefined) => void;
		/** @internal — `SuiDateTimePicker` renders this component in `'datetime'` mode. */
		mode?: 'date' | 'datetime';
		/** `SuiDateTimePicker`: time precision, `'minute'` (default) or `'second'`. */
		granularity?: SuiTimeGranularity;
		/** `SuiDateTimePicker`: 12- or 24-hour clock. Default: the locale's. */
		hourCycle?: 12 | 24;
		/** `SuiDateTimePicker`: minutes between the time slots next to the calendar. Default `30`. */
		step?: number;
		/** Extra content in the calendar footer (next to "Today"). */
		footer?: Snippet;
	};
</script>

<script lang="ts">
	import { DatePicker } from 'bits-ui';
	import { getLocalTimeZone, today, type DateValue } from '@internationalized/date';
	import SuiIcon from '../sui-icon.svelte';
	import DateCalendar from './date-calendar.svelte';
	import { SuiFieldState } from '../field.svelte.js';
	import { registerSuiField } from '../form/field-registry.js';
	import { getSuiStrings } from '../strings.js';
	import { segmentInputBridge } from './segment-input.js';
	import {
		dateTimeToIso,
		dateToIso,
		formatTimeSlot,
		isoToDate,
		isoToDateTime,
		isoToTime,
		timeSlots
	} from './iso.js';
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
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import XIcon from '@lucide/svelte/icons/x';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';

	const uid = $props.id();
	const strings = getSuiStrings();

	let {
		label,
		subText,
		size = 'md',
		variant = 'info',
		startIcon,
		value = $bindable<string | undefined>(undefined),
		min,
		max,
		isDateUnavailable,
		isDateDisabled,
		calendar = true,
		captionLayout = 'label',
		weekStartsOn,
		locale,
		showToday = true,
		clearable = false,
		schema,
		validateOn = 'both',
		errors: externalErrors = [],
		field: f,
		name,
		required = false,
		disabled = false,
		readonly = false,
		id = `sui-date-${uid}`,
		class: className = '',
		onValueChange,
		mode = 'date',
		granularity = 'minute',
		hourCycle,
		step = 30,
		footer
	}: SuiDatePickerProps = $props();

	const withTime = $derived(mode === 'datetime');
	const localeTag = $derived(locale ?? strings.locale);

	// ---- ISO string ⇄ bits-ui DateValue ------------------------------------
	function toValue(iso: string | null | undefined): DateValue | undefined {
		return withTime ? isoToDateTime(iso) : isoToDate(iso);
	}
	function toIso(next: DateValue | undefined): string | undefined {
		return withTime ? dateTimeToIso(next, granularity) : dateToIso(next);
	}

	const current = $derived((f ? f.value : value) ?? undefined) as string | undefined;
	const hasValue = $derived(!!current);

	// the month on display; follows the value when it is set from outside
	let placeholder = $state<DateValue | undefined>(undefined);
	let open = $state(false);

	// ---- validation ------------------------------------------------------------
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
	// report the DOM id for form-level error summaries (unregistered on unmount)
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

	// pastes, IME and Android keyboards → bits-ui's keyboard-driven segments
	const bridge = segmentInputBridge({
		onPaste: (text) => {
			const pasted = withTime ? (isoToDateTime(text) ?? isoToDate(text)) : isoToDate(text);
			if (!pasted) return false;
			commit(pasted);
			return true;
		}
	});

	/** A completed value (typed or picked) — every one is an answer. */
	function commit(next: DateValue | undefined) {
		const iso = toIso(next);
		if (iso === current) return;
		if (f) f.change(iso, 'discrete');
		else {
			value = iso;
			fieldState.validate(iso ?? '', schema, 'change', validateOn);
		}
		onValueChange?.(iso);
	}

	function clear() {
		commit(undefined);
		fieldRoot?.querySelector<HTMLElement>('[data-segment]:not([data-segment="literal"])')?.focus();
	}

	/** Focus left the whole field (segments, buttons and the popover). */
	function onFocusOut(event: FocusEvent & { currentTarget: HTMLElement }) {
		const next = event.relatedTarget;
		if (next instanceof Node) {
			if (event.currentTarget.contains(next)) return;
			// focus moved into this field's own calendar popover — not leaving
			if (next instanceof Element && next.closest(`[data-sui-date-popover="${id}"]`)) return;
		}
		if (open) return;
		if (f) f.blur();
		else fieldState.validate(current ?? '', schema, 'blur', validateOn);
	}

	// the shortcut is only offered when today is actually selectable
	const todayIso = today(getLocalTimeZone()).toString();
	const todayAllowed = $derived(
		(!min || todayIso >= min.slice(0, 10)) &&
			(!max || todayIso <= max.slice(0, 10)) &&
			!isDateUnavailable?.(todayIso) &&
			!isDateDisabled?.(todayIso)
	);

	function pickToday() {
		const now = today(getLocalTimeZone());
		const existing = toValue(current);
		if (withTime && existing && 'hour' in existing) {
			commit(existing.set({ year: now.year, month: now.month, day: now.day }));
		} else {
			commit(withTime ? isoToDateTime(`${now.toString()}T00:00`) : now);
		}
		placeholder = withTime ? isoToDateTime(`${now.toString()}T00:00`) : now;
		if (!withTime) open = false;
	}

	// ---- date-time mode: time slots next to the calendar ----------------------
	const slots = $derived(withTime ? timeSlots(step) : []);
	const currentTime = $derived(withTime ? current?.slice(11, 16) : undefined);
	let slotList = $state<HTMLElement | null>(null);

	function pickTime(slot: string) {
		const time = isoToTime(slot);
		if (!time) return;
		const base = toValue(current) ?? isoToDateTime(`${today(getLocalTimeZone()).toString()}T00:00`);
		if (!base || !('hour' in base)) return;
		commit(base.set({ hour: time.hour, minute: time.minute, second: 0 }));
		open = false;
	}

	// arrow keys walk the slot list (a roving listbox of buttons)
	function onSlotKeydown(event: KeyboardEvent) {
		const buttons = [...(slotList?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
		const index = buttons.indexOf(event.target as HTMLButtonElement);
		if (index < 0) return;
		// up/down in the side column, left/right in the phone row
		const delta =
			event.key === 'ArrowDown' || event.key === 'ArrowRight'
				? 1
				: event.key === 'ArrowUp' || event.key === 'ArrowLeft'
					? -1
					: 0;
		if (event.key === 'Home') buttons[0]?.focus();
		else if (event.key === 'End') buttons.at(-1)?.focus();
		else if (delta) buttons[Math.min(buttons.length - 1, Math.max(0, index + delta))]?.focus();
		else return;
		event.preventDefault();
	}

	// scroll the chosen slot (else 09:00) into view once the popover opens;
	// focus stays with the calendar (bits-ui focuses the selected day)
	$effect(() => {
		if (!open || !slotList) return;
		const target =
			slotList.querySelector<HTMLElement>('[aria-selected="true"]') ??
			slotList.querySelector<HTMLElement>('[data-slot-time="09:00"]');
		if (!target) return;
		// center it in whichever direction the list scrolls (column / phone row)
		slotList.scrollTop = target.offsetTop - slotList.clientHeight / 2;
		slotList.scrollLeft = target.offsetLeft - slotList.clientWidth / 2;
	});

	export function validate(): string[] {
		if (f) return f.validate();
		return fieldState.forceValidate(current ?? '', schema);
	}

	export function reset(): void {
		if (f) return f.clear();
		fieldState.reset();
	}
</script>

<!-- Single root: label, field and message never drift apart in a grid. -->
<div
	bind:this={fieldRoot}
	class={cn('flex w-full flex-col', className)}
	data-sui-field={withTime ? 'date-time-picker' : 'date-picker'}
	data-sui-size={size}
	data-invalid={invalid || undefined}
>
	<DatePicker.Root
		bind:value={() => toValue(current), commit}
		bind:placeholder
		bind:open
		locale={localeTag}
		minValue={toValue(min)}
		maxValue={toValue(max)}
		isDateUnavailable={isDateUnavailable ? (d) => isDateUnavailable(dateToIso(d)!) : undefined}
		isDateDisabled={isDateDisabled ? (d) => isDateDisabled(dateToIso(d)!) : undefined}
		granularity={withTime ? granularity : 'day'}
		{hourCycle}
		{weekStartsOn}
		weekdayFormat="narrow"
		closeOnDateSelect={!withTime}
		calendarLabel={typeof label === 'string' ? label : undefined}
		{disabled}
		{readonly}
		{required}
	>
		{#if label}
			<DatePicker.Label
				id={labelId}
				data-sui-label
				class="{SUI_LABEL[size]} {SUI_FIELD_TEXT[
					effVariant
				]} mb-2 flex items-center gap-0.5 font-medium"
			>
				{#if typeof label === 'string'}{label}{:else}{@render label()}{/if}
				{#if required}
					<!-- visual marker only: the segments' aria-required announce it -->
					<span class="text-destructive" aria-hidden="true">*</span>
				{/if}
			</DatePicker.Label>
		{/if}

		<div
			data-sui-control={withTime ? 'date-time-picker' : 'date-picker'}
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

			<!-- typed entry: one focusable, locale-ordered segment per unit -->
			<DatePicker.Input
				{id}
				data-sui-date-input
				{...bridge}
				aria-invalid={invalid || undefined}
				aria-describedby={describedBy}
				class="flex min-w-0 flex-1 items-center overflow-hidden whitespace-nowrap"
			>
				{#snippet children({ segments })}
					{#each segments as { part, value: text }, i (part + i)}
						<DatePicker.Segment
							{part}
							class={cn(
								'rounded-xs px-px tabular-nums caret-transparent outline-none',
								part === 'literal'
									? 'whitespace-pre text-muted-foreground'
									: 'focus:bg-accent focus:text-accent-foreground aria-[valuetext=Empty]:text-muted-foreground'
							)}
						>
							{text}
						</DatePicker.Segment>
					{/each}
				{/snippet}
			</DatePicker.Input>

			{#if formName}
				<!-- posts exactly the bound ISO value (bits-ui's own input adds :00 seconds) -->
				<input type="hidden" name={formName} value={current ?? ''} data-sui-hidden-input />
			{/if}
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
				<DatePicker.Trigger
					data-sui-date-trigger
					aria-label={strings.openCalendar}
					class="-me-1 flex shrink-0 cursor-pointer items-center justify-center rounded-sm p-1 text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed"
				>
					<CalendarIcon class={SUI_ICON[size]} aria-hidden="true" />
				</DatePicker.Trigger>
			{/if}
		</div>

		{#if calendar}
			<DatePicker.Portal>
				<DatePicker.Content
					sideOffset={4}
					align="end"
					data-sui-date-popover={id}
					class="z-50 flex rounded-md bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 max-sm:flex-col"
				>
					<div class="flex flex-col">
						<DateCalendar bind:placeholder locale={localeTag} {captionLayout} />
						{#if showToday || footer}
							<div class="flex items-center gap-2 border-t px-3 py-2">
								{#if showToday}
									<button
										type="button"
										data-sui-date-today
										disabled={!todayAllowed}
										class="cursor-pointer rounded-md px-2 py-1 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
										onclick={pickToday}
									>
										{strings.today}
									</button>
								{/if}
								{@render footer?.()}
							</div>
						{/if}
					</div>
					{#if withTime}
						<!-- time slots next to the calendar: pick a day, then a time -->
						<div
							bind:this={slotList}
							role="listbox"
							tabindex="-1"
							aria-label={strings.chooseTime}
							data-sui-time-slots
							class="flex max-h-80 w-32 flex-col gap-0.5 overflow-y-auto overscroll-contain border-s p-2 max-sm:w-auto max-sm:max-w-[calc(100vw-2rem)] max-sm:flex-row max-sm:overflow-x-auto max-sm:overflow-y-hidden max-sm:border-s-0 max-sm:border-t"
							onkeydown={onSlotKeydown}
						>
							{#each slots as slot (slot)}
								<button
									type="button"
									role="option"
									aria-selected={slot === currentTime}
									data-slot-time={slot}
									class="shrink-0 cursor-pointer rounded-md px-2 py-1.5 text-start text-sm whitespace-nowrap tabular-nums outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:hover:bg-primary aria-selected:focus-visible:bg-primary"
									onclick={() => pickTime(slot)}
								>
									{formatTimeSlot(slot, localeTag, hourCycle)}
								</button>
							{/each}
						</div>
					{/if}
				</DatePicker.Content>
			</DatePicker.Portal>
		{/if}
	</DatePicker.Root>

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
	<!-- Persistent live region: mounted empty so the first message is announced. -->
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
