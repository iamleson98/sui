<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import type { SuiFieldVariant, SuiIconComponent, SuiItem, SuiSize } from '../types.js';
	import type { SuiSource } from '../pagination.js';
	import type { SuiValidateOn } from '../zod.js';
	import type { SuiFieldHandle } from '../form/index.js';
	import type { SuiSchemaLike } from '../form/schema.js';

	export type SuiSelectProps<V extends string = string> = Omit<
		HTMLButtonAttributes,
		'value' | 'size' | 'class'
	> & {
		/** Static option list. Omit when using `source`. */
		items?: SuiItem<V>[];
		/** Async page loader — enables infinite scroll via REST pagination. */
		source?: SuiSource<SuiItem<V>>;
		/** Page size for `source`. Default `25`. */
		pageSize?: number;
		/** Key used to de-duplicate infinite pages. Default: `item.value`. */
		itemKey?: (item: SuiItem<V>) => string | number;
		/** Field label rendered above the trigger. */
		label?: string | Snippet;
		subText?: string;
		size?: SuiSize;
		variant?: SuiFieldVariant;
		/** Icon at the start of the trigger. */
		startIcon?: SuiIconComponent;
		/** Icon at the end of the trigger (before the chevron). */
		endIcon?: SuiIconComponent;
		/** Interactive snippet at the end of the trigger. */
		action?: Snippet;
		/** Placeholder shown before a value is selected. Default `"Select…"`. */
		placeholder?: string;
		/** zod v4 or Standard Schema v1 schema validated on selection and blur. */
		schema?: SuiSchemaLike;
		/** When to run `schema`. Default `both` (every selection + blur). */
		validateOn?: SuiValidateOn;
		errors?: string[];
		required?: boolean;
		/**
		 * Schema-driven form handle (`form.fields.role` from
		 * `createSuiForm`): value, validation timing and error
		 * display are wired automatically.
		 */
		field?: SuiFieldHandle<V | undefined>;
		/** Allow clearing the selection (shows a clear button). Default `false`. */
		clearable?: boolean;
		/** Text when no options exist. Default `"No options"`. */
		emptyText?: string;
		/** Error message shown when a `source` request fails. */
		errorText?: string;
		/**
		 * Schema path this field maps to when a form-level submitter
		 * (`createSuiSubmitter`) orchestrates the form. Ignored when `field`
		 * is set — `createSuiForm` drives those.
		 */
		name?: string;
		id?: string;
		class?: string;
		/** Selected value (two-way bindable). */
		value?: V;
		/** Fires whenever the selection changes. */
		onSelect?: (value: V | undefined, item: SuiItem<V> | undefined) => void;
	};
</script>

<script lang="ts" generics="V extends string = string">
	import * as Select from '$lib/components/ui/select/index.js';
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
		SUI_ICON,
		SUI_FIELD_TEXT,
		SUI_FIELD_TRIGGER,
		SUI_LABEL,
		SUI_SUBTEXT
	} from '../styles.js';
	import { cn } from '$lib/utils.js';
	import XIcon from '@lucide/svelte/icons/x';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';

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
		placeholder = 'Select…',
		schema,
		validateOn = 'both',
		errors: externalErrors = [],
		name,
		field: f,
		required = false,
		clearable = false,
		emptyText = 'No options',
		errorText = 'Failed to load options',
		class: className = '',
		id = `sui-select-${crypto.randomUUID()}`,
		value = $bindable<V | undefined>(undefined),
		onSelect,
		onblur,
		...rest
	}: SuiSelectProps<V> = $props();

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

	// keep the bound shadow in sync with programmatic form changes
	// (reset, setValues) — bits-ui reads it for item highlighting
	$effect(() => {
		if (f) value = f.value as V | undefined;
	});

	const infinite = $derived(source !== undefined);
	// svelte-ignore state_referenced_locally
	const list = new SuiInfiniteList<SuiItem<V>>(
		source ?? (async () => ({ items: [], hasMore: false })),
		{ pageSize, itemKey }
	);

	// (re)load the first page whenever a source appears or changes identity
	let loadedSource = $state<SuiSource<SuiItem<V>> | undefined>(undefined);
	$effect(() => {
		if (source === undefined) return;
		list.source = source;
		if (source === loadedSource) return;
		loadedSource = source;
		list.reset();
		void list.loadMore();
	});

	const resolvedItems = $derived(staticItems ?? list.items);
	const current = $derived((f ? f.value : value) as V | undefined);
	const selected = $derived(resolvedItems.find((item) => item.value === current));
	const hasValue = $derived(current !== undefined && current !== '');

	// deduped: the same message can arrive from both the `errors` prop (server)
	// and the local zod validation — duplicate keys would break {#each (error)}
	const allErrors = $derived(f ? f.errors : fieldState.displayed);
	const invalid = $derived(allErrors.length > 0);
	const effVariant = $derived(
		suiEffectiveVariant(f?.rewardValid ? 'success' : variant, invalid ? allErrors : undefined)
	);
	const hintId = $derived(`${id}-hint`);
	const messageId = $derived(`${id}-message`);
	const listboxId = $derived(`${id}-listbox`);
	const checking = $derived(!!f?.isValidating && !invalid);
	const checkingText = $derived(f?.checkingMessage ?? 'Checking…');
	// hint + error coexist in the description (GOV.UK pattern)
	const describedBy = $derived(
		[subText ? hintId : undefined, invalid ? messageId : undefined].filter(Boolean).join(' ') ||
			undefined
	);

	// sentinel wiring for infinite scroll
	let sentinel: HTMLElement | null = $state(null);
	// popup dismissal + blur contract (see popup-blur.ts): pointer/Escape
	// dismissal is peeking — it must not run blur validation or yank focus
	// back; a keyboard dismissal returns focus to the trigger
	const dismiss = new SuiPopupDismiss();
	// whichever popup host is mounted (desktop content / mobile sheet)
	let contentRef = $state<HTMLElement | null>(null);
	let triggerRef: HTMLButtonElement | null = $state(null);
	$effect(() => {
		if (!infinite || !sentinel) return;
		// measure against the actual scroll port when we can — the bits-ui
		// select viewport is the element that scrolls
		return observeSentinel(sentinel, () => void list.loadMore());
	});

	/** Undefined (nothing selected) is validated as '' so `z.string().min(1, 'msg')` works. */
	$effect(() => {
		if (!(desktopOpen || mobileOpen)) return;
		const onDown = (e: PointerEvent) => {
			const t = e.target as Node | null;
			if (!t) return;
			// presses on the popup or the trigger are not dismissals
			if (contentRef?.contains(t) || triggerRef?.contains(t)) return;
			dismiss.pointer();
		};
		document.addEventListener('pointerdown', onDown, true);
		return () => document.removeEventListener('pointerdown', onDown, true);
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
		// desktop: bits-ui Select closes itself; mobile: the vaul sheet has
		// no such auto-close — selecting commits and dismisses
		mobileOpen = false;
		validateSelection(next);
		onSelect?.(
			next,
			resolvedItems.find((item) => item.value === next)
		);
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
	// bits-ui owns the desktop open state internally — mirror it so the
	// document pointerdown watcher below only runs while a popup is open
	let desktopOpen = $state(false);

	// mobile: options render in a drag-to-dismiss bottom sheet (vaul)
	const isMobile = suiMobileQuery();
	let mobileOpen = $state(false);

	/** Mobile drawer open/close — mirrors the Select.Root contract. */
	function handleMobileOpen(next: boolean) {
		mobileOpen = next;
		if (next) {
			dismiss.open();
			// pre-load the first page when the sheet opens for the first time
			if (infinite && list.items.length === 0 && !list.loading) void list.loadMore();
		} else {
			// pointer (overlay tap / drag) and Escape dismissals are peeks —
			// the field validates on the eventual genuine blur or on submit
			if (dismiss.shouldSkipValidation()) return;
			if (f) f.blur();
			else fieldState.validate(value ?? '', schema, 'blur', validateOn);
		}
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

<!-- Single root: the field never leaks layout primitives into the parent,
        so external grid/flex gaps can't separate label, control and message. -->
<div
	bind:this={fieldRoot}
	class={cn('flex w-full flex-col', className)}
	data-sui-field="select"
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

	<div class="relative w-full">
		{#snippet triggerInner()}
			{#if startIcon}
				<span class="pointer-events-none shrink-0 text-muted-foreground">
					<SuiIcon icon={startIcon} {size} />
				</span>
			{/if}
			{#if hasValue}
				<span class="flex min-w-0 flex-1 items-center gap-2 text-left">
					<span class="truncate">{selected?.label ?? current}</span>
				</span>
			{:else}
				<span class="flex-1 truncate text-left text-muted-foreground">{placeholder}</span>
			{/if}
			{#if endIcon}
				<span class="pointer-events-none shrink-0 text-muted-foreground">
					<SuiIcon icon={endIcon} {size} />
				</span>
			{/if}
			{#if action}
				<!-- A click shield: interactive content inside must not toggle the select. -->
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
		{/snippet}

		{#if isMobile.current}
			<!-- Mobile: platform-native picker pattern — full-width bottom sheet
                                with drag-to-dismiss, body scroll lock and safe-area padding. -->
			<Drawer.Root bind:open={mobileOpen} onOpenChange={handleMobileOpen}>
				<Drawer.Trigger>
					{#snippet child({ props })}
						<!-- aria-invalid mirrors the shadcn-svelte select-trigger pattern;
                                                        the checker is stricter than ARIA-in-HTML consumers expect here. -->
						<!-- svelte-ignore a11y_role_supports_aria_props_implicit -->
						<button
							{...props as Record<string, unknown>}
							{id}
							type="button"
							data-sui-select
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
								clearable && hasValue && SUI_CLEAR_PE[size],
								clearable && hasValue && SUI_CHEVRON_PIN,
								className
							)}
							{...rest as Record<string, unknown>}
							onblur={(event: FocusEvent) => {
								onblur?.(event as never);
								if (dismiss.shouldSwallowBlur(event, contentRef)) return;
								if (f) {
									f.blur();
									return;
								}
								fieldState.validate(value ?? '', schema, 'blur', validateOn);
							}}
						>
							{@render triggerInner()}
							<ChevronDownIcon
								class="pointer-events-none text-muted-foreground {SUI_ICON[
									size
								]} shrink-0 transition-transform duration-150 {mobileOpen ? 'rotate-180' : ''}"
								aria-hidden="true"
							/>
						</button>
					{/snippet}
				</Drawer.Trigger>
				<Drawer.Content
					bind:ref={contentRef}
					class="sui-select-sheet mx-0 max-h-[85dvh] gap-0 px-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
					data-sui-select-content
					onCloseAutoFocus={(event: Event) => {
						if (dismiss.cause() === 'pointer') event.preventDefault();
					}}
					onInteractOutside={() => dismiss.pointer()}
					onEscapeKeydown={() => dismiss.keyboard()}
					onpointerdown={() => dismiss.pointer()}
				>
					<Drawer.Title class="sr-only"
						>{typeof label === 'string' ? label : placeholder}</Drawer.Title
					>
					<Drawer.Description class="sr-only">Choose an option</Drawer.Description>
					<Command.Root data-sui-select-command>
						<Command.List id={listboxId} data-sui-select-list class="max-h-[60dvh] px-1">
							{#if infinite && list.error}
								<div
									class="flex items-center justify-center gap-2 px-2.5 py-3 text-sm text-destructive"
									data-sui-select-error
									role="alert"
								>
									{errorText}
								</div>
							{/if}
							{#each resolvedItems as item (item.value)}
								<Command.Item
									value={item.value}
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
							{#if resolvedItems.length === 0 && !(infinite && list.loading)}
								<div
									class="px-2.5 py-6 text-center text-sm text-muted-foreground"
									data-sui-select-empty
								>
									{emptyText}
								</div>
							{/if}
							{#if infinite && (list.loading || list.loadingMore)}
								<div
									class="flex items-center justify-center gap-2 px-2.5 py-3 text-sm text-muted-foreground"
									data-sui-select-loading
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
				</Drawer.Content>
			</Drawer.Root>
		{:else}
			<Select.Root
				type="single"
				bind:value={value as never}
				required={required || undefined}
				onValueChange={(next) => {
					if (next !== undefined && next !== null && next !== '') select(next as V);
				}}
				onOpenChange={(open) => {
					desktopOpen = open;
					if (open) dismiss.open();
					// pre-load the first page when the menu opens for the first time
					if (open && infinite && list.items.length === 0 && !list.loading) void list.loadMore();
				}}
			>
				<Select.Trigger
					bind:ref={triggerRef}
					{id}
					data-sui-select
					data-sui-trigger
					data-sui-size={size}
					data-sui-variant={effVariant}
					data-invalid={invalid || undefined}
					aria-invalid={invalid || undefined}
					aria-describedby={describedBy}
					class={cn(
						'relative flex w-full items-center rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-3 dark:bg-input/30 dark:focus-visible:bg-input/50',
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
						<span class="flex min-w-0 flex-1 items-center gap-2 text-left">
							<span class="truncate">{selected?.label ?? current}</span>
						</span>
					{:else}
						<span class="flex-1 truncate text-left text-muted-foreground">{placeholder}</span>
					{/if}
					{#if endIcon}
						<span class="pointer-events-none shrink-0 text-muted-foreground">
							<SuiIcon icon={endIcon} {size} />
						</span>
					{/if}
					{#if action}
						<!-- A click shield: interactive content inside must not toggle the select. -->
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
				</Select.Trigger>
				<!-- onInteractOutside is deliberately NOT wired: bits-ui debounces
                                                        it ~10ms, re-stamping the pointer cause AFTER the trigger blur
                                                        consumed it. The document pointerdown watcher (script) marks
                                                        pointer dismissals synchronously; Escape stays here — it is
                                                        not debounced. -->
				<Select.Content
					bind:ref={contentRef}
					class="sui-select-content z-50 p-1"
					onEscapeKeydown={() => dismiss.keyboard()}
				>
					{#if infinite && list.error}
						<div
							class="flex items-center justify-center gap-2 px-2.5 py-3 text-sm text-destructive"
							data-sui-select-error
							role="alert"
						>
							{errorText}
						</div>
					{/if}
					{#each resolvedItems as item (item.value)}
						<Select.Item
							value={item.value}
							label={item.label}
							disabled={item.disabled || undefined}
							data-sui-option
							data-disabled={item.disabled || undefined}
							class="gap-2.5 rounded-md py-2 pr-9 pl-2.5"
						>
							<span class="flex min-w-0 flex-1 flex-col items-start gap-1">
								<span class="truncate">{item.label}</span>
								{#if item.description}
									<span class="w-full truncate text-xs leading-snug text-muted-foreground">
										{item.description}
									</span>
								{/if}
							</span>
						</Select.Item>
					{/each}
					{#if resolvedItems.length === 0}
						{#if !infinite}
							<div
								class="px-2.5 py-6 text-center text-sm text-muted-foreground"
								data-sui-select-empty
							>
								{emptyText}
							</div>
						{:else if !list.loading && !list.loadingMore && !list.error}
							<div
								class="px-2.5 py-6 text-center text-sm text-muted-foreground"
								data-sui-select-empty
							>
								{emptyText}
							</div>
						{/if}
					{/if}
					{#if infinite && (list.loading || list.loadingMore)}
						<div
							class="flex items-center justify-center gap-2 px-2.5 py-3 text-sm text-muted-foreground"
							data-sui-select-loading
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
				</Select.Content>
			</Select.Root>
		{/if}

		{#if clearable && hasValue}
			<!-- Clear affordance rendered OUTSIDE the trigger button (nested
                                                interactive elements are invalid HTML and bits-ui opens the menu
                                                on pointerdown, before any click could be intercepted). -->
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
