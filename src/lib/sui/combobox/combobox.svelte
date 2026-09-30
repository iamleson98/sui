<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import type { ZodType } from 'zod';
	import type { SuiFieldVariant, SuiIconComponent, SuiItem, SuiSize } from '../types.js';
	import type { SuiSource } from '../pagination.js';
	import type { SuiValidateOn } from '../zod.js';

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
		required?: boolean;
		clearable?: boolean;
		emptyText?: string;
		errorText?: string;
		id?: string;
		class?: string;
		value?: V;
		onSelect?: (value: V | undefined, item: SuiItem<V> | undefined) => void;
	};
</script>

<script lang="ts" generics="V extends string = string">
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import SuiIcon from '../sui-icon.svelte';
	import { SuiFieldState } from '../field.svelte.js';
	import { SuiInfiniteList } from '../infinite-list.svelte.js';
	import { observeSentinel } from '../intersection.js';
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

	const field = new SuiFieldState();

	// fresh external errors (new `errors` prop reference) re-take the
	// display; re-passing an unchanged list never resurrects cleared ones
	$effect(() => field.syncExternal(externalErrors));
	const listboxId = $derived(`${id}-listbox`);

	const infinite = $derived(source !== undefined);
	// svelte-ignore state_referenced_locally
	const list = new SuiInfiniteList<SuiItem<V>>(
		source ?? (async () => ({ items: [], hasMore: false })),
		{ pageSize, itemKey }
	);

	const resolvedItems = $derived(staticItems ?? list.items);
	const selected = $derived(resolvedItems.find((item) => item.value === value));
	const hasValue = $derived(value !== undefined && value !== '');

	// deduped: the same message can arrive from both the `errors` prop (server)
	// and the local zod validation — duplicate keys would break {#each (error)}
	const allErrors = $derived(field.displayed);
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

	// bits-ui's FocusScope returns DOM focus to the trigger whenever the
	// content unmounts. That is right for Esc / keyboard selection, but
	// after an outside-CLICK dismissal the focus should follow the pointer
	// out of the field — otherwise the trigger keeps the focused look
	// forever. Tracked here and honored in `onCloseAutoFocus` below.
	let dismissedByPointer = false;

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
		field.validate(candidate ?? '', schema, 'change', validateOn);
	}

	function select(next: V) {
		value = next;
		open = false;
		query = '';
		validateSelection(next);
		onSelect?.(next, resolvedItems.find((item) => item.value === next));
	}

	function clear() {
		value = undefined;
		validateSelection(undefined);
		onSelect?.(undefined, undefined);
		// keep keyboard focus on the trigger after clearing
		triggerRef?.focus();
	}

	export function validate(): string[] {
		return field.forceValidate(value ?? '', schema);
	}

	export function reset(): void {
		field.reset();
	}
</script>

<!-- Single root: the field never leaks layout primitives into the parent. -->
<div class={cn('flex w-full flex-col', className)} data-sui-field="combobox" data-sui-size={size}>
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

	<!-- bind:clientWidth keeps the dropdown exactly as wide as the trigger -->
	<div class="relative w-full" bind:clientWidth={triggerWidth}>
		<Popover.Root
			bind:open
			onOpenChange={(next) => {
				open = next;
				if (next) {
					dismissedByPointer = false;
				} else {
					query = '';
					field.validate(value ?? '', schema, 'blur', validateOn);
				}
			}}
		>
			<!-- Element delegation: bits-ui merges its own aria-haspopup="dialog"
			     after consumer props, so we spread its props onto our button and
			     override the combobox semantics afterwards. -->
			<Popover.Trigger>
				{#snippet child({ props })}
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
							'border-input bg-transparent dark:bg-input/30 dark:focus-visible:bg-input/50 focus-visible:ring-3 shadow-xs relative flex w-full cursor-pointer items-center rounded-md border transition-[color,box-shadow] outline-none',
							SUI_CONTROL[size],
							SUI_FIELD_TRIGGER[effVariant],
							// reserve the ✕ zone and pin the chevron far-right inside it
							clearable && hasValue && SUI_CLEAR_PE[size],
							clearable && hasValue && SUI_CHEVRON_PIN,
							className
						)}
						{...(rest as Record<string, unknown>)}
						onblur={(event: FocusEvent) => {
							onblur?.(event as never);
							field.validate(value ?? '', schema, 'blur', validateOn);
						}}
					>
						{#if startIcon}
							<span class="text-muted-foreground pointer-events-none shrink-0">
								<SuiIcon icon={startIcon} {size} />
							</span>
						{/if}
						{#if hasValue}
							<span class="flex-1 truncate text-left">{selected?.label ?? value}</span>
						{:else}
							<span class="text-muted-foreground flex-1 truncate text-left">{placeholder}</span>
						{/if}
						{#if endIcon}
							<span class="text-muted-foreground pointer-events-none shrink-0">
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
							class="text-muted-foreground pointer-events-none {SUI_ICON[size]} shrink-0 transition-transform duration-150 {open ? 'rotate-180' : ''}"
							aria-hidden="true"
						/>
					</button>
				{/snippet}
			</Popover.Trigger>
			<Popover.Content
				class="sui-combobox-content z-50 w-(--sui-trigger-width) gap-0 p-1.5"
				style="--sui-trigger-width: {triggerWidth}px"
				align="start"
				onInteractOutside={() => (dismissedByPointer = true)}
				onEscapeKeydown={() => (dismissedByPointer = false)}
				onCloseAutoFocus={(event) => {
					if (dismissedByPointer) event.preventDefault();
				}}
			>
				<!-- Selection is handled by each Command.Item's onSelect; a controlled
				     `value` on Command.Root makes bits-ui reconcile on mount, which
				     immediately re-selects and closes the popover. -->
				<Command.Root
					data-sui-combobox-command
					shouldFilter={infinite ? false : searchable}
				>
					{#if searchable}
						<div class="border-b border-border px-0.5 pb-2.5 mb-1">
							<Command.Input
								bind:value={query}
								placeholder={searchPlaceholder}
								data-sui-combobox-input
							/>
						</div>
					{/if}
					<Command.List id={listboxId} data-sui-combobox-list class="max-h-64 px-0.5">
						{#if infinite && list.error}
							<div
								class="text-destructive flex items-center justify-center gap-2 px-2.5 py-3 text-sm"
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
									class="{SUI_ICON[size]} shrink-0 transition-opacity {item.value === value ? 'opacity-100' : 'opacity-0'}"
								/>
								<span class="flex min-w-0 flex-1 flex-col items-start gap-1">
									<span class="truncate">{item.label}</span>
									{#if item.description}
										<span class="text-muted-foreground w-full truncate text-xs leading-snug">
											{item.description}
										</span>
									{/if}
								</span>
							</Command.Item>
						{/each}
						{#if infinite && (list.loading || list.loadingMore)}
							<div
								class="text-muted-foreground flex items-center justify-center gap-2 px-2.5 py-3 text-sm"
								data-sui-combobox-loading
								role="status"
							>
								<span class="animate-spin rounded-full border-2 border-current border-t-transparent size-4" aria-hidden="true"></span>
								{list.loading ? 'Loading…' : 'Loading more…'}
							</div>
						{/if}
						{#if infinite && list.hasMore}
							<div bind:this={sentinel} data-sui-load-more-sentinel class="h-px w-full" aria-hidden="true"></div>
						{/if}
					</Command.List>
				</Command.Root>
			</Popover.Content>
		</Popover.Root>

		{#if clearable && hasValue}
			<!-- Clear affordance rendered OUTSIDE the trigger button (nested
			     interactive elements are invalid HTML; a sibling overlay keeps
			     the click, focus and keyboard behavior clean). -->
			<button
				type="button"
				data-sui-clear
				class="{SUI_CLEAR_END[size]} {SUI_CLEAR_SIZE[size]} text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring/50 absolute top-1/2 z-10 flex -translate-y-1/2 cursor-pointer items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2"
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
