<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import type { SuiSchemaLike } from '../form/schema.js';
	import type { SuiFieldVariant, SuiIconComponent, SuiItem, SuiSize } from '../types.js';
	import type { SuiSource } from '../pagination.js';
	import type { SuiValidateOn } from '../zod.js';
	import type { SuiFieldHandle } from '../form/index.js';

	export type SuiComboboxProps<V extends string = string> = Omit<
		HTMLButtonAttributes,
		'value' | 'size' | 'class'
	> & {
		/** Static option list. Omit when using `source`. */
		items?: SuiItem<V>[];
		/** Async page loader — enables server search + infinite scroll. */
		source?: SuiSource<SuiItem<V>>;
		/** Page size for `source`. Default `25`. */
		pageSize?: number;
		/** Key used to de-duplicate infinite pages. Default: `item.value`. */
		itemKey?: (item: SuiItem<V>) => string | number;
		label?: string | Snippet;
		subText?: string;
		size?: SuiSize;
		variant?: SuiFieldVariant;
		startIcon?: SuiIconComponent;
		endIcon?: SuiIconComponent;
		action?: Snippet;
		/** Search input placeholder. Default `"Search…"`. */
		searchPlaceholder?: string;
		placeholder?: string;
		/** Enable the search input. Default `true`. */
		searchable?: boolean;
		/**
		 * Debounce (ms) for server-side search when using `source`. Default `250`.
		 */
		searchDebounce?: number;
		schema?: SuiSchemaLike;
		/** When to run `schema`. Default `both` (every selection + blur). */
		validateOn?: SuiValidateOn;
		errors?: string[];
		/**
		 * Schema-driven form handle (`form.fields.role` from
		 * `createSuiForm`): value, validation timing and error
		 * display are wired automatically.
		 */
		field?: SuiFieldHandle<V | undefined>;
		required?: boolean;
		clearable?: boolean;
		emptyText?: string;
		errorText?: string;
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
		value?: V;
		/**
		 * The item behind an initial `value` that is not in the first loaded
		 * page (edit forms over server-paginated options) — labels the
		 * trigger instead of the raw value. Items the user picks are
		 * remembered automatically, across searches.
		 */
		selectedItem?: SuiItem<V>;
		onSelect?: (value: V | undefined, item: SuiItem<V> | undefined) => void;
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
	import { observeSentinel } from '../intersection.js';
	import { suiMobileQuery } from '../mobile.svelte.js';
	import { getSuiStrings } from '../strings.js';
	import { SvelteMap } from 'svelte/reactivity';
	import {
		suiEffectiveVariant,
		SUI_CHEVRON_PIN,
		SUI_CLEAR_END,
		SUI_CLEAR_PE,
		SUI_CLEAR_SIZE,
		SUI_CONTROL,
		SUI_FIELD_LABEL,
		SUI_FIELD_TEXT,
		SUI_FIELD_TRIGGER,
		SUI_ICON,
		SUI_LABEL,
		SUI_SUBTEXT
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
		endIcon,
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
		emptyText,
		errorText,
		class: className = '',
		id = `sui-combobox-${uid}`,
		value = $bindable<V | undefined>(undefined),
		selectedItem,
		onSelect,
		onblur,
		...rest
	}: SuiComboboxProps<V> = $props();

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
	// mobile: options render in a drag-to-dismiss bottom sheet (vaul)
	const isMobile = suiMobileQuery();

	// fresh external errors (new `errors` prop reference) re-take the
	// display; re-passing an unchanged list never resurrects cleared ones
	$effect(() => fieldState.syncExternal(externalErrors));

	// report the DOM id for form-level error summaries (unregistered on unmount)
	$effect(() => f?.registerControl(id));

	// keep the bound shadow in sync with programmatic form changes
	// (reset, setValues)
	$effect(() => {
		if (f) value = f.value as V | undefined;
	});
	const listboxId = $derived(`${id}-listbox`);

	const infinite = $derived(source !== undefined);
	// svelte-ignore state_referenced_locally
	const list = new SuiInfiniteList<SuiItem<V>>(
		source ?? (async () => ({ items: [], hasMore: false })),
		{ pageSize, itemKey }
	);

	const resolvedItems = $derived(staticItems ?? list.items);
	const current = $derived((f ? f.value : value) as V | undefined);
	// Items seen as the selection, so a value keeps its label once the
	// loaded pages no longer contain it — reopening resets a server search
	// to page one, which may not include an item picked from page three.
	const remembered = new SvelteMap<V, SuiItem<V>>();
	$effect(() => {
		if (current === undefined) return;
		const item = resolvedItems.find((candidate) => candidate.value === current);
		if (item && remembered.get(current) !== item) remembered.set(current, item);
	});
	const selected = $derived(
		current === undefined
			? undefined
			: (resolvedItems.find((item) => item.value === current) ??
					remembered.get(current) ??
					(selectedItem?.value === current ? selectedItem : undefined))
	);
	const hasValue = $derived(current !== undefined && current !== '');
	// the form wins the `name` by default (native form data)
	const formName = $derived(name ?? f?.name);
	const placeholderText = $derived(placeholder ?? strings.selectPlaceholder);

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
	let triggerRef: HTMLButtonElement | null = $state(null);

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

	// (re)initialize when the source changes identity
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

	// server-side search: debounced reset + first page
	$effect(() => {
		if (!infinite || !open) return;
		const q = query;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			void list.search(q);
		}, searchDebounce);
		return () => clearTimeout(searchTimer);
	});

	// sentinel wiring for infinite scroll — after a failed request, stop
	// auto-loading on scroll; the error row offers an explicit retry
	$effect(() => {
		if (!infinite || !sentinel || !open) return;
		return observeSentinel(sentinel, () => {
			if (!list.error) void list.loadMore();
		});
	});

	/** Undefined (nothing selected) is validated as '' so `z.string().min(1, 'msg')` works. */
	function validateSelection(candidate: V | undefined) {
		if (f) return; // the form engine validated via change()
		fieldState.validate(candidate ?? '', schema, 'change', validateOn);
	}

	function select(next: V) {
		const item = resolvedItems.find((candidate) => candidate.value === next);
		if (item) remembered.set(next, item);
		if (f) {
			f.change(next, 'discrete');
		} else {
			value = next;
		}
		open = false;
		query = '';
		validateSelection(next);
		onSelect?.(next, item);
	}

	/** Shared by the popover and the mobile bottom sheet. */
	function handleOpenChange(next: boolean) {
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
			else fieldState.validate(value ?? '', schema, 'blur', validateOn);
		}
	}

	function clear() {
		if (f) {
			f.change(undefined, 'discrete');
		} else {
			value = undefined;
		}
		validateSelection(undefined);
		onSelect?.(undefined, undefined);
		// keep keyboard focus on the trigger after clearing
		triggerRef?.focus();
	}

	export function validate(): string[] {
		if (f) return f.validate();
		return fieldState.forceValidate(value ?? '', schema);
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
	data-sui-field="combobox"
	data-sui-size={size}
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
				<!-- visual marker only: the trigger's aria-required announces it -->
				<span class="text-destructive" aria-hidden="true">*</span>
			{/if}
		</label>
	{/if}

	<!-- bind:clientWidth keeps the dropdown exactly as wide as the trigger -->
	<div class="relative w-full" bind:clientWidth={triggerWidth}>
		<!-- The trigger button is identical in both modes — only the host
                changes: anchored Popover on desktop, bottom-sheet Drawer on
                phones. Element delegation passes each host's props onto our
                button (click toggling, aria-expanded, data-state…). -->
		{#snippet triggerButton(props: Record<string, unknown>)}
			<!-- role="combobox" (the shadcn combobox pattern) gives the trigger
			     combobox semantics — value, expanded state, aria-invalid and
			     aria-required are all valid on it -->
			<button
				{...props}
				bind:this={triggerRef}
				{id}
				type="button"
				role="combobox"
				data-sui-combobox
				data-sui-trigger
				data-sui-size={size}
				data-sui-variant={effVariant}
				data-invalid={invalid || undefined}
				aria-invalid={invalid || undefined}
				aria-required={required || undefined}
				aria-haspopup="listbox"
				aria-controls={listboxId}
				class={cn(
					'relative flex w-full cursor-pointer items-center rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-3 dark:bg-input/30 dark:focus-visible:bg-input/50',
					SUI_CONTROL[size],
					SUI_FIELD_TRIGGER[effVariant],
					// reserve the ✕ zone and pin the chevron far-right inside it
					clearable && hasValue && SUI_CLEAR_PE[size],
					clearable && hasValue && SUI_CHEVRON_PIN,
					className
				)}
				{...rest as Record<string, unknown>}
				aria-describedby={describedBy}
				onblur={(event: FocusEvent) => {
					onblur?.(event as never);
					// internal focus move (search input / sheet taking
					// focus) or pointer dismissal — peeking, not leaving
					if (dismiss.shouldSwallowBlur(event, contentRef)) return;
					if (f) {
						f.blur();
						return;
					}
					fieldState.validate(value ?? '', schema, 'blur', validateOn);
				}}
			>
				{#if startIcon}
					<span class="pointer-events-none shrink-0 text-muted-foreground">
						<SuiIcon icon={startIcon} {size} />
					</span>
				{/if}
				{#if hasValue}
					<span class="flex-1 truncate text-left">{selected?.label ?? current}</span>
				{:else}
					<span class="flex-1 truncate text-left text-muted-foreground">{placeholderText}</span>
				{/if}
				{#if endIcon}
					<span class="pointer-events-none shrink-0 text-muted-foreground">
						<SuiIcon icon={endIcon} {size} />
					</span>
				{/if}
				{#if action}
					<!-- A click shield: interactive content inside must not toggle the popover. -->
					<span
						data-sui-action
						role="presentation"
						class="flex shrink-0 items-center"
						onpointerdown={(e) => e.stopPropagation()}
						onclick={(e) => e.stopPropagation()}
						onkeydown={(e) => e.stopPropagation()}
					>
						{@render action()}
					</span>
				{/if}
				<ChevronDownIcon
					class="pointer-events-none text-muted-foreground {SUI_ICON[
						size
					]} shrink-0 transition-transform duration-150 {open ? 'rotate-180' : ''}"
					aria-hidden="true"
				/>
			</button>
		{/snippet}

		<!-- The option list is shared verbatim between popover and drawer. -->
		{#snippet listbox(listHeightClass: string)}
			<!-- Selection is handled by each Command.Item's onSelect; a controlled
                                     `value` on Command.Root makes bits-ui reconcile on mount, which
                                     immediately re-selects and closes the popover. -->
			<Command.Root data-sui-combobox-command shouldFilter={infinite ? false : searchable}>
				{#if searchable}
					<div class="mb-1 border-b border-border px-0.5 pb-2.5">
						<Command.Input
							bind:value={query}
							placeholder={searchPlaceholder ?? strings.searchPlaceholder}
							aria-label={searchPlaceholder ?? strings.searchPlaceholder}
							aria-expanded="true"
							aria-controls={listboxId}
							data-sui-combobox-input
						/>
					</div>
				{/if}
				<Command.List id={listboxId} data-sui-combobox-list class="{listHeightClass} px-0.5">
					{#if infinite && list.error}
						<div
							class="flex items-center justify-center gap-2 px-2.5 py-3 text-sm text-destructive"
							data-sui-combobox-error
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
						<Command.Empty data-sui-combobox-empty class="py-8"
							>{emptyText ?? strings.noResults}</Command.Empty
						>
					{/if}
					{#each resolvedItems as item (item.value)}
						<!-- `class` hides the wrapper's built-in trailing check icon (bits-ui never
                                                             sets its data-checked) — sui renders its own leading check. -->
						<Command.Item
							value={item.value}
							keywords={[item.label, item.description ?? '']}
							data-sui-option
							data-disabled={item.disabled || undefined}
							disabled={item.disabled || undefined}
							onSelect={() => select(item.value)}
							class="gap-2.5 rounded-md px-2.5 py-2 [&>svg:last-of-type]:hidden"
						>
							<CheckIcon
								class="{SUI_ICON[size]} shrink-0 transition-opacity {item.value === current
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
							data-sui-combobox-loading
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
						{@render triggerButton(props as Record<string, unknown>)}
					{/snippet}
				</Drawer.Trigger>
				<Drawer.Content
					bind:ref={contentRef}
					class="sui-combobox-sheet mx-0 max-h-[85dvh] gap-0 px-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
					data-sui-combobox-content
					onEscapeKeydown={() => dismiss.keyboard()}
					onpointerdown={() => dismiss.pointer()}
					onCloseAutoFocus={(event: Event) => {
						if (dismiss.cause() === 'pointer') event.preventDefault();
					}}
				>
					<Drawer.Title class="sr-only"
						>{typeof label === 'string' ? label : placeholderText}</Drawer.Title
					>
					<Drawer.Description class="sr-only">{strings.chooseOption}</Drawer.Description>
					{@render listbox('max-h-[60dvh]')}
				</Drawer.Content>
			</Drawer.Root>
		{:else}
			<Popover.Root bind:open onOpenChange={handleOpenChange}>
				<!-- Element delegation: bits-ui merges its own aria-haspopup="dialog"
                             after consumer props, so we spread its props onto our button and
                             override the combobox semantics afterwards. -->
				<Popover.Trigger>
					{#snippet child({ props })}
						{@render triggerButton(props as Record<string, unknown>)}
					{/snippet}
				</Popover.Trigger>
				<Popover.Content
					bind:ref={contentRef}
					class="sui-combobox-content z-50 w-(--sui-trigger-width) gap-0 p-1.5"
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

		{#if clearable && hasValue}
			<!-- Clear affordance rendered OUTSIDE the trigger button (nested
                             interactive elements are invalid HTML; a sibling overlay keeps
                             the click, focus and keyboard behavior clean). -->
			<button
				type="button"
				data-sui-clear
				class="{SUI_CLEAR_END[size]} {SUI_CLEAR_SIZE[
					size
				]} absolute top-1/2 z-10 flex -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
				aria-label={strings.clearSelection}
				onclick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					clear();
				}}
			>
				<SuiIcon icon={XIcon} size="xs" />
			</button>
		{/if}
		{#if formName}
			<!-- native form data (FormData, progressive enhancement) -->
			<input type="hidden" name={formName} value={current ?? ''} data-sui-hidden-input />
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
