<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { SuiFieldVariant, SuiIconComponent, SuiSize } from '../types.js';
	import type { SuiValidateOn } from '../zod.js';
	import type { SuiFieldHandle } from '../form/index.js';
	import type { SuiSchemaLike } from '../form/schema.js';
	import type { SuiTimeGranularity } from './iso.js';

	export type SuiTimePickerProps = {
		label?: string | Snippet;
		subText?: string;
		size?: SuiSize;
		variant?: SuiFieldVariant;
		startIcon?: SuiIconComponent;
		/** The time as an ISO string (two-way bindable): `'14:30'` (`'14:30:05'` with seconds). */
		value?: string;
		/** Earliest allowed time, ISO (`'09:00'`). Also the first slot. */
		min?: string;
		/** Latest allowed time, ISO (`'17:30'`). Also the last slot. */
		max?: string;
		/** Precision: `'minute'` (default) or `'second'`. */
		granularity?: SuiTimeGranularity;
		/** 12- or 24-hour clock. Default: the locale's. */
		hourCycle?: 12 | 24;
		/**
		 * Minutes between the suggested slots in the dropdown. Default `30`.
		 * Typed times are not limited to slots.
		 */
		step?: number;
		/** Show the slot dropdown next to the typed field. Default `true`. */
		slots?: boolean;
		/** BCP 47 locale. Default: `setSuiStrings({ locale })`, else `en-US`. */
		locale?: string;
		clearable?: boolean;
		/** zod v4 / Standard Schema — validates the ISO string (`z.iso.time()`). Ignored when `field` is set. */
		schema?: SuiSchemaLike;
		/** When to run `schema`. Default `both`. */
		validateOn?: SuiValidateOn;
		errors?: string[];
		/** Schema-driven form handle (`form.fields.startsAt`). */
		field?: SuiFieldHandle<string | null | undefined>;
		/** Native form `name` + `createSuiSubmitter` path. Defaults to the `field` path. */
		name?: string;
		required?: boolean;
		disabled?: boolean;
		readonly?: boolean;
		id?: string;
		class?: string;
		onValueChange?: (value: string | undefined) => void;
	};
</script>

<script lang="ts">
	import { TimeField } from 'bits-ui';
	import type { Time } from '@internationalized/date';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import SuiIcon from '../sui-icon.svelte';
	import { SuiFieldState } from '../field.svelte.js';
	import { registerSuiField } from '../form/field-registry.js';
	import { getSuiStrings } from '../strings.js';
	import { segmentInputBridge } from './segment-input.js';
	import { formatTimeSlot, isoToTime, timeSlots, timeToIso } from './iso.js';
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
	import ClockIcon from '@lucide/svelte/icons/clock';
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
		granularity = 'minute',
		hourCycle,
		step = 30,
		slots = true,
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
		id = `sui-time-${uid}`,
		class: className = '',
		onValueChange
	}: SuiTimePickerProps = $props();

	const localeTag = $derived(locale ?? strings.locale);
	const current = $derived((f ? f.value : value) ?? undefined) as string | undefined;
	const hasValue = $derived(!!current);
	let open = $state(false);

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
	const popoverId = $derived(`${id}-slots`);
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
			const pasted = isoToTime(text);
			if (!pasted) return false;
			commit(pasted);
			return true;
		}
	});

	function commit(next: Time | undefined) {
		const iso = timeToIso(next, granularity);
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

	function onFocusOut(event: FocusEvent & { currentTarget: HTMLElement }) {
		const next = event.relatedTarget;
		if (next instanceof Node) {
			if (event.currentTarget.contains(next)) return;
			if (next instanceof Element && next.closest(`[data-sui-time-popover="${id}"]`)) return;
		}
		if (open) return;
		if (f) f.blur();
		else fieldState.validate(current ?? '', schema, 'blur', validateOn);
	}

	// ---- slot dropdown -----------------------------------------------------------
	const slotTimes = $derived(slots ? timeSlots(step, min ?? '00:00', max ?? '23:59') : []);
	const currentSlot = $derived(current?.slice(0, 5));
	let slotList = $state<HTMLElement | null>(null);

	function pickSlot(slot: string) {
		commit(isoToTime(slot));
		open = false;
	}

	function onSlotKeydown(event: KeyboardEvent) {
		const buttons = [...(slotList?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
		const index = buttons.indexOf(event.target as HTMLButtonElement);
		if (index < 0) return;
		const delta = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
		if (event.key === 'Home') buttons[0]?.focus();
		else if (event.key === 'End') buttons.at(-1)?.focus();
		else if (delta) buttons[Math.min(buttons.length - 1, Math.max(0, index + delta))]?.focus();
		else return;
		event.preventDefault();
	}

	/**
	 * Open on the chosen slot (else 09:00, else the first) — scrolled into
	 * view and focused, so keyboard users land in the list and arrow keys
	 * take it from there. Replaces the popover's default "first focusable".
	 */
	function focusSlot(event: Event) {
		event.preventDefault();
		// the popover can re-mount while open (presence / animation): never
		// pull focus back from a slot the user already moved to
		if (slotList?.contains(document.activeElement)) return;
		const target =
			slotList?.querySelector<HTMLElement>('[aria-selected="true"]') ??
			slotList?.querySelector<HTMLElement>('[data-slot-time="09:00"]') ??
			slotList?.querySelector<HTMLElement>('button');
		// scroll only the list — scrollIntoView would scroll the page too
		if (target && slotList) slotList.scrollTop = target.offsetTop - slotList.clientHeight / 2;
		target?.focus({ preventScroll: true });
	}

	export function validate(): string[] {
		if (f) return f.validate();
		return fieldState.forceValidate(current ?? '', schema);
	}

	export function reset(): void {
		if (f) return f.clear();
		fieldState.reset();
	}
</script>

<div
	bind:this={fieldRoot}
	class={cn('flex w-full flex-col', className)}
	data-sui-field="time-picker"
	data-sui-size={size}
	data-invalid={invalid || undefined}
>
	<TimeField.Root
		bind:value={() => isoToTime(current), commit}
		locale={localeTag}
		minValue={isoToTime(min)}
		maxValue={isoToTime(max)}
		{granularity}
		{hourCycle}
		{disabled}
		{readonly}
		{required}
	>
		{#if label}
			<TimeField.Label
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
			</TimeField.Label>
		{/if}

		<div
			data-sui-control="time-picker"
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

			<TimeField.Input
				{id}
				data-sui-time-input
				{...bridge}
				aria-invalid={invalid || undefined}
				aria-describedby={describedBy}
				class="flex min-w-0 flex-1 items-center overflow-hidden whitespace-nowrap"
			>
				{#snippet children({ segments })}
					{#each segments as { part, value: text }, i (part + i)}
						<TimeField.Segment
							{part}
							class={cn(
								'rounded-xs px-px tabular-nums caret-transparent outline-none',
								part === 'literal'
									? 'whitespace-pre text-muted-foreground'
									: 'focus:bg-accent focus:text-accent-foreground aria-[valuetext=Empty]:text-muted-foreground'
							)}
						>
							{text}
						</TimeField.Segment>
					{/each}
				{/snippet}
			</TimeField.Input>

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

			{#if slots}
				<Popover.Root bind:open>
					<Popover.Trigger
						data-sui-time-trigger
						disabled={disabled || readonly}
						aria-label={strings.chooseTime}
						aria-controls={popoverId}
						class="-me-1 flex shrink-0 cursor-pointer items-center justify-center rounded-sm p-1 text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed"
					>
						<ClockIcon class={SUI_ICON[size]} aria-hidden="true" />
					</Popover.Trigger>
					<Popover.Content
						id={popoverId}
						align="end"
						data-sui-time-popover={id}
						onOpenAutoFocus={focusSlot}
						class="w-36 gap-0 p-0"
					>
						<div
							bind:this={slotList}
							role="listbox"
							tabindex="-1"
							aria-label={strings.chooseTime}
							data-sui-time-slots
							class="flex max-h-72 flex-col gap-0.5 overflow-y-auto overscroll-contain p-1.5"
							onkeydown={onSlotKeydown}
						>
							{#each slotTimes as slot (slot)}
								<button
									type="button"
									role="option"
									aria-selected={slot === currentSlot}
									data-slot-time={slot}
									class="shrink-0 cursor-pointer rounded-md px-2.5 py-1.5 text-start text-sm whitespace-nowrap tabular-nums outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:hover:bg-primary aria-selected:focus-visible:bg-primary"
									onclick={() => pickSlot(slot)}
								>
									{formatTimeSlot(slot, localeTag, hourCycle)}
								</button>
							{/each}
						</div>
					</Popover.Content>
				</Popover.Root>
			{/if}
		</div>
	</TimeField.Root>

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
