<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import type { SuiSchemaLike } from '../form/schema.js';
	import type { SuiFieldVariant, SuiIconComponent, SuiItem, SuiSize } from '../types.js';
	import type { SuiSource } from '../pagination.js';
	import type { SuiValidateOn } from '../zod.js';
	import type { SuiFieldHandle } from '../form/index.js';

	export type SuiMultiSelectProps<V extends string = string> = Omit<
		HTMLButtonAttributes,
		'value' | 'size' | 'class'
	> & {
		/** Static option list. Omit when using `source`. */
		items?: SuiItem<V>[];
		/** Async page loader — enables server search + infinite scroll. */
		source?: SuiSource<SuiItem<V>>;
		pageSize?: number;
		itemKey?: (item: SuiItem<V>) => string | number;
		label?: string | Snippet;
		subText?: string;
		size?: SuiSize;
		variant?: SuiFieldVariant;
		startIcon?: SuiIconComponent;
		action?: Snippet;
		searchPlaceholder?: string;
		placeholder?: string;
		searchable?: boolean;
		searchDebounce?: number;
		/** zod v4 schema validated on change. */
		schema?: SuiSchemaLike;
		/** When to run `schema`. Default `both` (every selection + blur). */
		validateOn?: SuiValidateOn;
		errors?: string[];
		/**
		 * Schema-driven form handle (`form.fields.topics` from
		 * `createSuiForm`): value, validation timing and error
		 * display are wired automatically.
		 */
		field?: SuiFieldHandle<V[] | undefined>;
		required?: boolean;
		clearable?: boolean;
		/**
		 * How many selected chips stay fully visible before the rest collapse
		 * into a “+n” badge:
		 * - `'responsive'` (default) — as many chips as the trigger width
		 *   allows (Ant Design `maxTagCount="responsive"` behaviour)
		 * - a number — a fixed cap (e.g. `3`)
		 */
		maxDisplay?: number | 'responsive';
		emptyText?: string;
		errorText?: string;
		/**
		 * Native form `name` (one hidden input per selected value carries
		 * the selection for `FormData` / progressive enhancement) — and the
		 * schema path a form-level submitter (`createSuiSubmitter`) maps it
		 * to. Defaults to the `field` handle's path.
		 */
		name?: string;
		/** Accessible id — a hydration-safe one is generated when omitted. */
		id?: string;
		class?: string;
		/** Selected values (two-way bindable). */
		value?: V[];
		/**
		 * Items behind initial values that are not in the first loaded page
		 * (edit forms over server-paginated options) — label their chips
		 * instead of the raw values. Items the user picks are remembered
		 * automatically, across searches.
		 */
		selectedItems?: SuiItem<V>[];
		onSelect?: (value: V[], items: SuiItem<V>[]) => void;
	};
</script>

<script lang="ts" generics="V extends string = string">
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Drawer from '$lib/components/ui/drawer/index.js';
	import SuiIcon from '../sui-icon.svelte';
	import { SuiFieldState } from '../field.svelte.js';
	import { registerSuiField } from '../form/field-registry.js';
	import { SuiPopupDismiss } from '../popup-blur.js';
	import { SuiInfiniteList } from '../infinite-list.svelte.js';
	import { fitChipCount } from '../chip-fit.js';
	import { observeSentinel } from '../intersection.js';
	import { suiMobileQuery } from '../mobile.svelte.js';
	import { getSuiStrings } from '../strings.js';
	import { SvelteMap } from 'svelte/reactivity';
	import {
		suiEffectiveVariant,
		SUI_CHIP,
		SUI_CONTROL_MIN,
		SUI_FIELD_LABEL,
		SUI_FIELD_TEXT,
		SUI_FIELD_TRIGGER,
		SUI_ICON,
		SUI_LABEL,
		SUI_SUBTEXT,
		SUI_DISABLED_CONTROL,
		SUI_DISABLED_LABEL
	} from '../styles.js';
	import { cn } from '$lib/utils.js';
	import XIcon from '@lucide/svelte/icons/x';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';

	const uid = $props.id();
	const strings = getSuiStrings();

	let {
		items: staticItems,
		source,
		pageSize = 25,
		itemKey = (item: SuiItem<V>) => item.value,
		label,
		subText,
		size = 'md',
		variant = 'info',
		startIcon,
		action,
		searchPlaceholder,
		placeholder,
		searchable = true,
		searchDebounce = 250,
		schema,
		validateOn = 'both',
		errors: externalErrors = [],
		name,
		field: f,
		required = false,
		clearable = false,
		maxDisplay = 'responsive',
		emptyText,
		errorText,
		class: className = '',
		id = `sui-multi-select-${uid}`,
		value = $bindable<V[]>([]),
		selectedItems,
		onSelect,
		onblur,
		...rest
	}: SuiMultiSelectProps<V> = $props();
	// `disabled` reaches the trigger with the rest; the label fades with it.
	const disabled = $derived(!!(rest as { disabled?: boolean }).disabled);

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
		if (f) value = (f.value ?? []) as V[] as never;
	});

	// the live selection: the form handle owns it when present
	const current = $derived((f ? ((f.value ?? []) as V[]) : value) as V[]);

	const listboxId = $derived(`${id}-listbox`);

	const infinite = $derived(source !== undefined);
	// svelte-ignore state_referenced_locally
	const list = new SuiInfiniteList<SuiItem<V>>(
		source ?? (async () => ({ items: [], hasMore: false })),
		{ pageSize, itemKey }
	);

	const resolvedItems = $derived(staticItems ?? list.items);

	// Chip labels resolve from the loaded items, then from items seen as part
	// of the selection (a value picked on page 3 keeps its label after a new
	// search resets the pages), then from `selectedItems`, then the raw value.
	const remembered = new SvelteMap<V, SuiItem<V>>();
	$effect(() => {
		for (const v of current) {
			const item = resolvedItems.find((candidate) => candidate.value === v);
			if (item && remembered.get(v) !== item) remembered.set(v, item);
		}
	});
	const selected = $derived(
		current.map((v) => {
			const item =
				resolvedItems.find((candidate) => candidate.value === v) ??
				remembered.get(v) ??
				selectedItems?.find((candidate) => candidate.value === v);
			return { value: v, label: item?.label ?? v };
		})
	);
	// the form wins the `name` by default (native form data)
	const formName = $derived(name ?? f?.name);

	// ---- responsive chip overflow -------------------------------------------
	// Ant Design `maxTagCount="responsive"` behaviour: measure every chip in a
	// hidden row that shares the exact chip styles, measure the available
	// trigger width, then fit as many chips as possible while reserving room
	// for the “+n” badge. Falls back to 3 visible chips before measurement
	// (SSR / jsdom have no layout engine).
	let expanded = $state(false);
	let responsiveCount = $state<number | null>(null);
	let measurerEl: HTMLElement | null = $state(null);
	let chipsRowEl: HTMLElement | null = $state(null);

	const FallbackCount = 3;
	const collapsedCount = $derived.by(() => {
		if (maxDisplay === 'responsive')
			return responsiveCount ?? Math.min(FallbackCount, selected.length);
		return Math.min(maxDisplay, selected.length);
	});
	const visibleCount = $derived(expanded ? selected.length : collapsedCount);
	const visible = $derived(selected.slice(0, visibleCount));
	const overflow = $derived(selected.length - collapsedCount);
	const hiddenLabels = $derived(selected.slice(collapsedCount).map((s) => s.label));

	function measure() {
		if (!measurerEl || !chipsRowEl) return;
		const chips = measurerEl.querySelectorAll<HTMLElement>('[data-measure-chip]');
		const badge = measurerEl.querySelector<HTMLElement>('[data-measure-badge]');
		const widths = Array.from(chips, (el) => el.offsetWidth);
		const available = chipsRowEl.clientWidth;
		if (widths.length === 0 || !(available > 0)) {
			responsiveCount = null;
			return;
		}
		responsiveCount = fitChipCount({
			widths,
			available,
			badgeWidth: badge?.offsetWidth ?? 36,
			gap: 4,
			minVisible: 1
		});
	}

	// re-measure when the chip set changes (labels/values/size)
	$effect(() => {
		void selected.map((s) => s.value + s.label).join('\u0000');
		void size;
		measure();
	});

	// re-measure when the trigger width changes (viewport resize, layout shifts)
	$effect(() => {
		if (!chipsRowEl || typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(() => measure());
		observer.observe(chipsRowEl);
		return () => observer.disconnect();
	});

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

	let open = $state(false);
	let query = $state('');
	let sentinel: HTMLElement | null = $state(null);
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	let triggerWidth = $state(0);

	// popup dismissal + blur contract (see popup-blur.ts): pointer and
	// Escape dismissals are peeks — no blur validation; pointer dismissal
	// lets focus follow the pointer out (no stuck focused look), keyboard
	// dismissal returns it to the trigger (a11y contract)
	const dismiss = new SuiPopupDismiss();
	// whichever popup host is mounted (popover content / mobile sheet)
	let contentRef = $state<HTMLElement | null>(null);

	$effect(() => {
		if (!open) return;
		const onDown = (e: PointerEvent) => {
			const t = e.target as Node | null;
			if (!t) return;
			// presses on the popup itself are not dismissals; presses on
			// the trigger toggle-close, which is a peek too — either way
			// nothing to mark
			if (contentRef?.contains(t)) return;
			// bits-ui debounces its onInteractOutside ~10ms, after the
			// blur the outside press produces — mark synchronously instead
			dismiss.pointer();
		};
		document.addEventListener('pointerdown', onDown, true);
		return () => document.removeEventListener('pointerdown', onDown, true);
	});

	// mobile: options render in a drag-to-dismiss bottom sheet (vaul)
	const isMobile = suiMobileQuery();

	/** Shared by the popover and the mobile bottom sheet. */
	function handleOpenChange(next: boolean) {
		// The trigger is a div: nothing native stops a disabled one opening.
		if (disabled && next) {
			open = false;
			return;
		}
		open = next;
		if (next) {
			dismiss.open();
			// a failed first page: opening again is the user asking to retry
			if (infinite && list.error && list.items.length === 0 && !list.loading) {
				void list.loadMore();
			}
		} else {
			query = '';
			// pointer (outside click / drag) and Escape dismissals are
			// peeks — validation waits for a genuine blur or submit
			if (dismiss.shouldSkipValidation()) return;
			if (f) f.blur();
			else fieldState.validate(current, schema, 'blur', validateOn);
		}
	}

	let loadedSource = $state<SuiSource<SuiItem<V>> | undefined>(undefined);
	$effect(() => {
		if (source === undefined) return;
		list.source = source;
		if (source === loadedSource) return;
		loadedSource = source;
		list.reset();
		void list.loadMore();
	});
	// abort an in-flight page request when the field unmounts
	$effect(() => () => list.reset());

	$effect(() => {
		if (!infinite || !open) return;
		const q = query;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			void list.search(q);
		}, searchDebounce);
		return () => clearTimeout(searchTimer);
	});

	// after a failed request, stop auto-loading on scroll — the error row
	// offers an explicit retry
	$effect(() => {
		if (!infinite || !sentinel || !open) return;
		return observeSentinel(sentinel, () => {
			if (!list.error) void list.loadMore();
		});
	});

	function isSelected(v: V): boolean {
		return current.includes(v);
	}

	/** Write a new selection through the bound prop or the form handle. */
	function commit(next: V[]) {
		if (f) {
			f.change(next, 'discrete');
			return;
		}
		value = next;
		fieldState.validate(next, schema, 'change', validateOn);
	}

	/** The full item for a selected value (label fallbacks as for the chips). */
	function itemFor(v: V): SuiItem<V> {
		return (
			resolvedItems.find((candidate) => candidate.value === v) ??
			remembered.get(v) ??
			selectedItems?.find((candidate) => candidate.value === v) ?? { value: v, label: v }
		);
	}

	function toggle(item: SuiItem<V>) {
		if (item.disabled) return;
		remembered.set(item.value, item);
		const next = isSelected(item.value)
			? current.filter((v) => v !== item.value)
			: [...current, item.value];
		commit(next);
		onSelect?.(next, next.map(itemFor));
	}

	function remove(v: V) {
		if (disabled) return;
		const next = current.filter((x) => x !== v);
		commit(next);
		onSelect?.(next, next.map(itemFor));
	}

	function clearAll() {
		if (disabled) return;
		commit([]);
		onSelect?.([], []);
	}

	export function validate(): string[] {
		if (f) return f.validate();
		return fieldState.forceValidate(current, schema);
	}

	export function reset(): void {
		if (f) return f.clear();
		fieldState.reset();
	}
</script>

<!-- Single root: the field never leaks layout primitives into the parent. -->
<div
	bind:this={fieldRoot}
	class={cn('flex w-full flex-col', className)}
	data-sui-field="multi-select"
	data-sui-size={size}
>
	{#if label}
		<label
			for={id}
			id="{id}-label"
			data-sui-label
			class="{SUI_LABEL[size]} {SUI_FIELD_LABEL[effVariant]} {disabled
				? SUI_DISABLED_LABEL
				: ''} mb-2 flex items-center gap-0.5 font-medium"
		>
			{#if typeof label === 'string'}{label}{:else}{@render label()}{/if}
			{#if required}
				<!-- visual marker only: the trigger's aria-required announces it -->
				<span class="text-destructive" aria-hidden="true">*</span>
			{/if}
		</label>
	{/if}

	<div class="relative w-full" bind:clientWidth={triggerWidth}>
		{#snippet triggerDiv(props: Record<string, unknown>)}
			{@const { type: _ignoredType, ...divProps } = props as { type?: string } & Record<
				string,
				unknown
			>}
			<div
				{...divProps}
				{id}
				role="combobox"
				tabindex={disabled ? -1 : 0}
				aria-disabled={disabled || undefined}
				data-disabled={disabled || undefined}
				aria-labelledby={label ? `${id}-label` : undefined}
				data-sui-multi-select
				data-sui-trigger
				data-sui-size={size}
				data-sui-variant={effVariant}
				data-invalid={invalid || undefined}
				aria-invalid={invalid || undefined}
				aria-required={required || undefined}
				aria-haspopup="listbox"
				aria-controls={listboxId}
				class={cn(
					'relative flex w-full cursor-pointer items-start rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-3 dark:bg-input/30 dark:focus-visible:bg-input/50',
					SUI_CONTROL_MIN[size],
					SUI_FIELD_TRIGGER[effVariant],
					// a div, not a button: `disabled` is not a state CSS can see
					disabled && SUI_DISABLED_CONTROL,
					className
				)}
				{...rest as Record<string, unknown>}
				aria-describedby={describedBy}
				onkeydown={(event: KeyboardEvent) => {
					// ArrowDown/ArrowUp open the menu (combobox convention);
					// Enter/Space are delegated to bits-ui's handler below.
					if (disabled) return;
					if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !open) {
						event.preventDefault();
						open = true;
						return;
					}
					(divProps.onkeydown as ((event: KeyboardEvent) => void) | undefined)?.(event);
				}}
				onblur={(event: FocusEvent) => {
					onblur?.(event as never);
					// internal focus move (search input / sheet taking
					// focus) or pointer dismissal — peeking, not leaving
					if (dismiss.shouldSwallowBlur(event, contentRef)) return;
					if (f) {
						f.blur();
						return;
					}
					fieldState.validate(value, schema, 'blur', validateOn);
				}}
			>
				{#if startIcon}
					<span
						class="pointer-events-none shrink-0 text-muted-foreground {expanded
							? 'mt-1.5 self-start'
							: 'self-center'}"
					>
						<SuiIcon icon={startIcon} {size} />
					</span>
				{/if}

				{#if selected.length === 0}
					<span
						class="flex min-w-0 flex-1 items-center self-stretch truncate text-left text-muted-foreground"
					>
						{placeholder ?? strings.selectPlaceholder}
					</span>
				{:else}
					<span
						bind:this={chipsRowEl}
						class="flex min-h-0 min-w-0 flex-1 flex-wrap items-center gap-1 self-stretch overflow-hidden py-0.5"
					>
						{#each visible as sel (sel.value)}
							<span
								class="inline-flex w-fit max-w-full shrink-0 items-center gap-0.5 overflow-hidden bg-secondary text-nowrap text-secondary-foreground {SUI_CHIP[
									size
								]}"
								data-sui-badge
								data-value={sel.value}
							>
								<span class="truncate">{sel.label}</span>
								{#if !disabled}
									<button
										type="button"
										data-sui-badge-remove
										class="flex size-[1.15em] shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors outline-none hover:bg-accent-foreground/15 focus-visible:ring-2"
										aria-label={strings.removeItem(sel.label)}
										onclick={(event) => {
											event.preventDefault();
											event.stopPropagation();
											remove(sel.value);
										}}
										onkeydown={(event) => event.stopPropagation()}
									>
										<SuiIcon icon={XIcon} size="xs" />
									</button>
								{/if}
							</span>
						{/each}
						{#if overflow > 0 && !expanded}
							<button
								type="button"
								data-sui-badge
								data-sui-badge-overflow
								class="inline-flex w-fit shrink-0 cursor-pointer items-center rounded-full bg-secondary text-secondary-foreground transition-colors outline-none hover:bg-accent-foreground/15 focus-visible:ring-2 {SUI_CHIP[
									size
								]}"
								aria-label={strings.showMore(overflow, hiddenLabels)}
								title={hiddenLabels.join(', ')}
								onclick={(event) => {
									event.preventDefault();
									event.stopPropagation();
									expanded = true;
								}}
								onkeydown={(event) => event.stopPropagation()}
							>
								+{overflow}
							</button>
						{/if}
						{#if expanded && collapsedCount < selected.length}
							<button
								type="button"
								data-sui-badge-collapse
								class="inline-flex w-fit shrink-0 cursor-pointer items-center rounded-full px-1 text-xs text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2"
								onclick={(event) => {
									event.preventDefault();
									event.stopPropagation();
									expanded = false;
								}}
								onkeydown={(event) => event.stopPropagation()}
							>
								{strings.showLess}
							</button>
						{/if}
					</span>
				{/if}

				{#if action}
					<!-- A click shield: interactive content inside must not toggle the popover. -->
					<span
						data-sui-action
						role="presentation"
						class="flex shrink-0 {expanded ? 'mt-1.5 self-start' : 'self-center'}"
						onpointerdown={(e) => e.stopPropagation()}
						onclick={(e) => e.stopPropagation()}
						onkeydown={(e) => e.stopPropagation()}
					>
						{@render action()}
					</span>
				{/if}
				{#if clearable && selected.length > 0 && !disabled}
					<button
						type="button"
						data-sui-clear
						class="flex text-muted-foreground hover:bg-accent hover:text-foreground {expanded
							? 'mt-1.5 self-start'
							: 'self-center'} size-6 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2"
						aria-label={strings.clearAll}
						onclick={(event) => {
							event.preventDefault();
							event.stopPropagation();
							clearAll();
						}}
						onkeydown={(event) => event.stopPropagation()}
					>
						<SuiIcon icon={XIcon} size="xs" />
					</button>
				{/if}
				<ChevronDownIcon
					class="pointer-events-none text-muted-foreground {SUI_ICON[
						size
					]} shrink-0 transition-transform duration-150 {expanded
						? 'mt-1.5 self-start'
						: 'self-center'} {open ? 'rotate-180' : ''}"
					aria-hidden="true"
				/>
			</div>
		{/snippet}

		<!-- The option list is shared verbatim between popover and drawer. -->
		{#snippet listbox(listHeightClass: string)}
			<!-- The popover pads the list, as the select's does: no second gutter. -->
			<Command.Root
				class="p-0"
				data-sui-multi-select-command
				shouldFilter={infinite ? false : searchable}
			>
				{#if searchable}
					<div class="mb-1 border-b border-border pb-1">
						<Command.Input
							bind:value={query}
							placeholder={searchPlaceholder ?? strings.searchPlaceholder}
							aria-label={searchPlaceholder ?? strings.searchPlaceholder}
							aria-expanded="true"
							aria-controls={listboxId}
							data-sui-multi-select-input
						/>
					</div>
				{/if}
				<Command.List id={listboxId} data-sui-multi-select-list class={listHeightClass}>
					{#if infinite && list.error}
						<div
							class="flex items-center justify-center gap-2 px-2.5 py-3 text-sm text-destructive"
							data-sui-multi-select-error
							role="alert"
						>
							{errorText ?? strings.loadError}
							<button
								type="button"
								class="cursor-pointer rounded-md px-1.5 py-0.5 font-medium underline underline-offset-2 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
								data-sui-retry
								onclick={() => void list.loadMore()}
							>
								{strings.retry}
							</button>
						</div>
					{/if}
					{#if !(infinite && (list.loading || list.loadingMore || list.error))}
						<Command.Empty data-sui-multi-select-empty class="py-8"
							>{emptyText ?? strings.noResults}</Command.Empty
						>
					{/if}
					{#each resolvedItems as item (item.value)}
						<!-- `class` hides the wrapper's built-in trailing check icon (bits-ui
                                                                never sets its data-checked) — sui renders its own leading check. -->
						<!-- keywords: static search matches the label (and description),
						     not only the value; aria-checked exposes the selection — the
						     command list's aria-selected tracks the highlight -->
						<Command.Item
							value={item.value}
							keywords={[item.label, item.description ?? '']}
							aria-checked={isSelected(item.value)}
							data-sui-option
							data-disabled={item.disabled || undefined}
							disabled={item.disabled || undefined}
							onSelect={() => toggle(item)}
							class="gap-2.5 rounded-md px-2.5 py-2 [&>svg:last-of-type]:hidden"
						>
							<CheckIcon
								class="{SUI_ICON[size]} shrink-0 transition-opacity {isSelected(item.value)
									? 'opacity-100'
									: 'opacity-0'}"
							/>
							<span class="flex min-w-0 flex-1 flex-col items-start gap-1">
								<span class="truncate">{item.label}</span>
								{#if item.description}
									<span class="w-full truncate text-xs leading-snug text-muted-foreground">
										{item.description}
									</span>
								{/if}
							</span>
						</Command.Item>
					{/each}
					{#if infinite && (list.loading || list.loadingMore)}
						<div
							class="flex items-center justify-center gap-2 px-2.5 py-3 text-sm text-muted-foreground"
							data-sui-multi-select-loading
							role="status"
						>
							<span
								class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
								aria-hidden="true"
							></span>
							{list.loading ? strings.loading : strings.loadingMore}
						</div>
					{/if}
					{#if infinite && list.hasMore}
						<div
							bind:this={sentinel}
							data-sui-load-more-sentinel
							class="h-px w-full"
							aria-hidden="true"
						></div>
					{/if}
				</Command.List>
			</Command.Root>
		{/snippet}

		{#if isMobile.current}
			<!-- Mobile: platform-native picker pattern — full-width bottom sheet
                                                with drag-to-dismiss, body scroll lock and safe-area padding. -->
			<Drawer.Root bind:open onOpenChange={handleOpenChange}>
				<Drawer.Trigger>
					{#snippet child({ props })}
						{@render triggerDiv(props as Record<string, unknown>)}
					{/snippet}
				</Drawer.Trigger>
				<Drawer.Content
					bind:ref={contentRef}
					class="sui-multi-select-sheet mx-0 max-h-[85dvh] gap-0 px-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
					data-sui-multi-select-content
					onEscapeKeydown={() => dismiss.keyboard()}
					onpointerdown={() => dismiss.pointer()}
					onCloseAutoFocus={(event: Event) => {
						if (dismiss.cause() === 'pointer') event.preventDefault();
					}}
				>
					<Drawer.Title class="sr-only"
						>{typeof label === 'string'
							? label
							: (placeholder ?? strings.selectPlaceholder)}</Drawer.Title
					>
					<Drawer.Description class="sr-only">{strings.chooseOptions}</Drawer.Description>
					{@render listbox('max-h-[60dvh]')}
				</Drawer.Content>
			</Drawer.Root>
		{:else}
			<Popover.Root bind:open onOpenChange={handleOpenChange}>
				<Popover.Trigger>
					{#snippet child({ props })}
						{@render triggerDiv(props as Record<string, unknown>)}
					{/snippet}
				</Popover.Trigger>
				<Popover.Content
					bind:ref={contentRef}
					class="sui-multi-select-content z-50 w-(--sui-trigger-width) gap-0 border border-border p-1 ring-0"
					style="--sui-trigger-width: {triggerWidth}px"
					align="start"
					onEscapeKeydown={() => dismiss.keyboard()}
					onCloseAutoFocus={(event) => {
						if (dismiss.cause() === 'pointer') event.preventDefault();
					}}
				>
					{@render listbox('max-h-64')}
				</Popover.Content>
			</Popover.Root>
		{/if}

		<!-- Hidden measurer row: mirrors the exact chip markup/styles so the
                                        responsive overflow math measures real rendered widths. -->
		{#if selected.length > 0}
			<div
				bind:this={measurerEl}
				aria-hidden="true"
				class="pointer-events-none invisible absolute top-0 left-0 z-[-1] flex h-0 flex-nowrap overflow-hidden"
			>
				{#each selected as sel (sel.value)}
					<span
						class="inline-flex w-fit shrink-0 items-center gap-0.5 bg-secondary text-nowrap text-secondary-foreground {SUI_CHIP[
							size
						]}"
						data-measure-chip
					>
						{sel.label}
						<XIcon class="size-[1.15em] shrink-0" aria-hidden="true" />
					</span>
				{/each}
				<span
					class="inline-flex w-fit shrink-0 items-center rounded-full bg-secondary text-secondary-foreground {SUI_CHIP[
						size
					]}"
					data-measure-badge
				>
					+{selected.length}
				</span>
			</div>
		{/if}
		{#if formName}
			<!-- native form data: one entry per selected value (FormData.getAll) -->
			{#each current as v (v)}
				<input type="hidden" name={formName} value={v} data-sui-hidden-input />
			{/each}
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
