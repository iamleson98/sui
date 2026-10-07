<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import type { ZodType } from 'zod';
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
		schema?: ZodType;
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
		 * Schema path this field maps to when a form-level submitter
		 * (`createSuiSubmitter`) orchestrates the form. Ignored when `field`
		 * is set — `createSuiForm` drives those.
		 */
		name?: string;
		id?: string;
		class?: string;
		value?: V;
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
	import {
		suiEffectiveVariant,
		SUI_CHEVRON_PIN,
		SUI_CLEAR_END,
		SUI_CLEAR_PE,
		SUI_CLEAR_SIZE,
		SUI_CONTROL,
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
		searchPlaceholder = 'Search…',
		placeholder = 'Select…',
		searchable = true,
		searchDebounce = 250,
		schema,
		validateOn = 'both',
		errors: externalErrors = [],
		name,
		field: f,
		required = false,
		clearable = false,
		emptyText = 'No results',
		errorText = 'Failed to load options',
		class: className = '',
		id = `sui-combobox-${crypto.randomUUID()}`,
		value = $bindable<V | undefined>(undefined),
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

	// report the DOM id for form-level error summaries
	$effect(() => {
		f?.registerControl(id);
	});

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
	const selected = $derived(resolvedItems.find((item) => item.value === current));
	const hasValue = $derived(current !== undefined && current !== '');

	const allErrors = $derived(f ? f.errors : fieldState.displayed);
	const invalid = $derived(allErrors.length > 0);
	const effVariant = $derived(suiEffectiveVariant(variant, invalid ? allErrors : undefined));
	const messageId = $derived(`${id}-message`);
	const describedBy = $derived(invalid || subText ? messageId : undefined);

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

	// sentinel wiring for infinite scroll
	$effect(() => {
		if (!infinite || !sentinel || !open) return;
		return observeSentinel(sentinel, () => void list.loadMore());
	});

	/** Undefined (nothing selected) is validated as '' so `z.string().min(1, 'msg')` works. */
	function validateSelection(candidate: V | undefined) {
		if (f) return; // the form engine validated via change()
		fieldState.validate(candidate ?? '', schema, 'change', validateOn);
	}

	function select(next: V) {
		if (f) {
			f.change(next, 'discrete');
		} else {
			value = next;
		}
		open = false;
		query = '';
		validateSelection(next);
		onSelect?.(
			next,
			resolvedItems.find((item) => item.value === next)
		);
	}

	/** Shared by the popover and the mobile bottom sheet. */
	function handleOpenChange(next: boolean) {
		open = next;
		if (next) {
			dismiss.open();
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

	<!-- bind:clientWidth keeps the dropdown exactly as wide as the trigger -->
	<div class="relative w-full" bind:clientWidth={triggerWidth}>
		<!-- The trigger button is identical in both modes — only the host
                changes: anchored Popover on desktop, bottom-sheet Drawer on
                phones. Element delegation passes each host's props onto our
                button (click toggling, aria-expanded, data-state…). -->
		{#snippet triggerButton(props: Record<string, unknown>)}
			<!-- aria-invalid on a trigger button mirrors the shadcn-svelte
                                             select-trigger pattern; the checker is stricter than ARIA-in-HTML
                                             consumers expect here. -->
			<!-- svelte-ignore a11y_role_supports_aria_props_implicit -->
			<button
				{...props}
				bind:this={triggerRef}
				{id}
				type="button"
				data-sui-combobox
				data-sui-trigger
				data-sui-size={size}
				data-sui-variant={effVariant}
				data-invalid={invalid || undefined}
				aria-invalid={invalid || undefined}
				aria-describedby={describedBy}
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
					<span class="flex-1 truncate text-left">{selected?.label ?? value}</span>
				{:else}
					<span class="flex-1 truncate text-left text-muted-foreground">{placeholder}</span>
				{/if}
				{#if endIcon}
					<span class="pointer-events-none shrink-0 text-muted-foreground">
						<SuiIcon icon={endIcon} {size} />
					</span>
				{/if}
				{#if action}
					<!-- A click shield: interactive content inside must not toggle the popover. -->
					<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
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
							placeholder={searchPlaceholder}
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
							{errorText}
						</div>
					{/if}
					{#if !(infinite && (list.loading || list.loadingMore))}
						<Command.Empty data-sui-combobox-empty class="py-8">{emptyText}</Command.Empty>
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
								class="{SUI_ICON[size]} shrink-0 transition-opacity {item.value === value
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
							{list.loading ? 'Loading…' : 'Loading more…'}
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
						>{typeof label === 'string' ? label : placeholder}</Drawer.Title
					>
					<Drawer.Description class="sr-only">Choose an option</Drawer.Description>
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
				aria-label="Clear selection"
				onclick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					clear();
				}}
			>
				<SuiIcon icon={XIcon} size="xs" />
			</button>
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
