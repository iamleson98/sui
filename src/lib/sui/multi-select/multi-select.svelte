<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import type { ZodType } from 'zod';
	import type { SuiFieldVariant, SuiIconComponent, SuiItem, SuiSize } from '../types.js';
	import type { SuiSource } from '../pagination.js';

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
		schema?: ZodType;
		errors?: string[];
		required?: boolean;
		clearable?: boolean;
		/** Fully visible selected badges before collapsing into “+n”. Default `3`. */
		maxDisplay?: number;
		emptyText?: string;
		errorText?: string;
		id?: string;
		class?: string;
		/** Selected values (two-way bindable). */
		value?: V[];
		onSelect?: (value: V[], items: SuiItem<V>[]) => void;
	};
</script>

<script lang="ts" generics="V extends string = string">
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import SuiIcon from '../sui-icon.svelte';
	import { SuiFieldState } from '../field.svelte.js';
	import { SuiInfiniteList } from '../infinite-list.svelte.js';
	import { observeSentinel } from '../intersection.js';
	import {
		suiEffectiveVariant,
		SUI_CONTROL,
		SUI_FIELD_CONTROL,
		SUI_FIELD_TEXT,
		SUI_LABEL,
		SUI_SUBTEXT
	} from '../styles.js';
	import { cn } from '$lib/utils.js';
	import XIcon from '@lucide/svelte/icons/x';
	import CheckIcon from '@lucide/svelte/icons/check';

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
		searchPlaceholder = 'Search…',
		placeholder = 'Select…',
		searchable = true,
		searchDebounce = 250,
		schema,
		errors: externalErrors = [],
		required = false,
		clearable = false,
		maxDisplay = 3,
		emptyText = 'No results',
		errorText = 'Failed to load options',
		class: className = '',
		id = `sui-multi-select-${crypto.randomUUID()}`,
		value = $bindable<V[]>([]),
		onSelect,
		onblur,
		...rest
	}: SuiMultiSelectProps<V> = $props();

	const field = new SuiFieldState();

	const infinite = $derived(source !== undefined);
	// svelte-ignore state_referenced_locally
	const list = new SuiInfiniteList<SuiItem<V>>(
		source ?? (async () => ({ items: [], hasMore: false })),
		{ pageSize, itemKey }
	);

	const resolvedItems = $derived(staticItems ?? list.items);

	// Badge labels resolve from the loaded items, falling back to the raw value
	// when an option is not (yet) loaded — common with server-paginated data.
	// The cache is intentionally NOT reactive: it only grows monotonically so a
	// value selected on page 3 keeps its label after pages are re-fetched.
	const labelCache = new Map<V, string>();
	const selected = $derived(
		value.map((v) => {
			const item = resolvedItems.find((i) => i.value === v);
			const label = item?.label ?? labelCache.get(v) ?? v;
			if (item) labelCache.set(v, item.label);
			return { value: v, label };
		})
	);
	const visible = $derived(selected.slice(0, maxDisplay));
	const overflow = $derived(selected.length - visible.length);

	// deduped: the same message can arrive from both the `errors` prop (server)
	// and the local zod validation — duplicate keys would break {#each (error)}
	const allErrors = $derived([...new Set([...externalErrors, ...field.errors])]);
	const invalid = $derived(allErrors.length > 0);
	const effVariant = $derived(suiEffectiveVariant(variant, invalid ? allErrors : undefined));
	const messageId = $derived(`${id}-message`);
	const describedBy = $derived(invalid || subText ? messageId : undefined);

	/** Badge sizes step down as the control size steps up. */
	const BADGE_SIZE: Record<SuiSize, string> = {
		xs: 'text-[10px] px-1 py-0',
		sm: 'text-[11px] px-1.5 py-0',
		md: 'text-xs px-2 py-0',
		lg: 'text-xs px-2 py-0.5',
		xl: 'text-sm px-2 py-0.5'
	};

	let open = $state(false);
	let query = $state('');
	let sentinel: HTMLElement | undefined = $state();
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	let triggerWidth = $state(0);

	let loadedSource = $state<SuiSource<SuiItem<V>> | undefined>(undefined);
	$effect(() => {
		if (source === undefined) return;
		list.source = source;
		if (source === loadedSource) return;
		loadedSource = source;
		list.reset();
		void list.loadMore();
	});

	$effect(() => {
		if (!infinite || !open) return;
		const q = query;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			void list.search(q);
		}, searchDebounce);
		return () => clearTimeout(searchTimer);
	});

	$effect(() => {
		if (!infinite || !sentinel || !open) return;
		return observeSentinel(sentinel, () => void list.loadMore());
	});

	function isSelected(v: V): boolean {
		return value.includes(v);
	}

	function toggle(item: SuiItem<V>) {
		if (item.disabled) return;
		const next = isSelected(item.value) ? value.filter((v) => v !== item.value) : [...value, item.value];
		value = next;
		field.validate(next, schema, 'change', 'change');
		const selectedItems = next.map((v) => resolvedItems.find((i) => i.value === v) ?? { value: v, label: v });
		onSelect?.(next, selectedItems);
	}

	function remove(v: V, event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		const next = value.filter((x) => x !== v);
		value = next;
		field.validate(next, schema, 'change', 'change');
		const selectedItems = next.map((x) => resolvedItems.find((i) => i.value === x) ?? { value: x, label: x });
		onSelect?.(next, selectedItems);
	}

	function clearAll(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		value = [];
		field.validate([], schema, 'change', 'change');
		onSelect?.([], []);
	}

	export function validate(): string[] {
		return field.forceValidate(value, schema);
	}

	export function reset(): void {
		field.reset();
	}
</script>

{#if label}
	<label for={id} data-sui-label class="{SUI_LABEL[size]} text-foreground mb-1.5 flex items-center gap-0.5 font-medium">
		{#if typeof label === 'string'}{label}{:else}{@render label()}{/if}
		{#if required}
			<span class="text-destructive" aria-hidden="true">*</span>
			<span class="sr-only">(required)</span>
		{/if}
	</label>
{/if}

<div class="relative w-full" bind:clientWidth={triggerWidth}>
	<Popover.Root bind:open>
		<Popover.Trigger
			{id}
			data-sui-multi-select
			data-sui-trigger
			data-sui-size={size}
			data-sui-variant={effVariant}
			data-invalid={invalid || undefined}
			aria-invalid={invalid || undefined}
			aria-describedby={describedBy}
			aria-haspopup="listbox"
			class={cn(
				'border-input bg-transparent dark:bg-input/30 dark:focus:bg-input/50 focus-visible:ring-3 shadow-xs relative flex w-full items-start rounded-md border transition-[color,box-shadow] outline-none',
				SUI_CONTROL[size],
				SUI_FIELD_CONTROL[effVariant],
				selected.length === 0 && 'items-center',
				className
			)}
			{...(rest as Record<string, unknown>)}
			onblur={(event) => {
				onblur?.(event as never);
				field.validate(value, schema, 'blur', 'both');
			}}
		>
			{#if startIcon}
				<span class="text-muted-foreground pointer-events-none mt-0.5 shrink-0 self-start {selected.length === 0 ? 'self-center' : ''}">
					<SuiIcon icon={startIcon} {size} />
				</span>
			{/if}
			{#if selected.length === 0}
				<span class="text-muted-foreground flex-1 truncate text-left">{placeholder}</span>
			{:else}
				<span class="flex flex-1 flex-wrap gap-1 py-0.5 text-left">
					{#each visible as sel (sel.value)}
						<Badge variant="secondary" data-sui-badge class={BADGE_SIZE[size] + " gap-0.5"} data-value={sel.value}>
							{sel.label}
							<span
								role="button"
								tabindex="-1"
								data-sui-badge-remove
								class="hover:bg-accent -me-1 ms-0.5 flex cursor-pointer items-center rounded-[calc(var(--radius-sm))] px-0.5"
								aria-label="Remove {sel.label}"
								onclick={(event) => remove(sel.value, event)}
								onkeydown={(event) => {
									if (event.key === 'Enter' || event.key === ' ') {
										event.preventDefault();
										remove(sel.value, event as unknown as MouseEvent);
									}
								}}
							>
								<SuiIcon icon={XIcon} size="xs" />
							</span>
						</Badge>
					{/each}
					{#if overflow > 0}
						<Badge variant="secondary" data-sui-badge data-sui-badge-overflow class={BADGE_SIZE[size]}>
							+{overflow}
						</Badge>
					{/if}
				</span>
			{/if}
			{#if action}
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
				<span
					data-sui-action
					role="presentation"
					class="flex shrink-0 items-center"
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => e.stopPropagation()}
				>
					{@render action()}
				</span>
			{/if}
			{#if clearable && selected.length > 0}
				<span
					role="button"
					tabindex="-1"
					data-sui-clear
					class="hover:bg-accent text-muted-foreground hover:text-foreground flex shrink-0 cursor-pointer items-center rounded-sm"
					aria-label="Clear all"
					onclick={clearAll}
					onkeydown={(event) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							clearAll(event as unknown as MouseEvent);
						}
					}}
				>
					<SuiIcon icon={XIcon} {size} />
				</span>
			{/if}
		</Popover.Trigger>
		<Popover.Content
			class="sui-multi-select-content z-50 w-(--sui-trigger-width)"
			style="--sui-trigger-width: {triggerWidth}px"
			align="start"
		>
			<Command.Root data-sui-multi-select-command shouldFilter={infinite ? false : searchable}>
				{#if searchable}
					<Command.Input bind:value={query} placeholder={searchPlaceholder} data-sui-multi-select-input />
				{/if}
				<Command.List data-sui-multi-select-list class="max-h-64">
					{#if infinite && list.error}
						<div class="text-destructive px-3 py-2 text-sm" data-sui-multi-select-error role="alert">{errorText}</div>
					{/if}
					{#if !(infinite && (list.loading || list.loadingMore))}
						<Command.Empty data-sui-multi-select-empty>{emptyText}</Command.Empty>
					{/if}
					{#each resolvedItems as item (item.value)}
						<Command.Item
							value={item.value}
							data-sui-option
							data-selected={isSelected(item.value) || undefined}
							data-disabled={item.disabled || undefined}
							disabled={item.disabled || undefined}
							onSelect={() => toggle(item)}
						>
							<CheckIcon class={cn('size-4 shrink-0', isSelected(item.value) ? 'opacity-100' : 'opacity-0')} />
							<span class="flex min-w-0 flex-1 flex-col items-start gap-0.5">
								<span class="truncate">{item.label}</span>
								{#if item.description}
									<span class="text-muted-foreground truncate text-xs">{item.description}</span>
								{/if}
							</span>
						</Command.Item>
					{/each}
					{#if infinite && (list.loading || list.loadingMore)}
						<div class="text-muted-foreground flex items-center justify-center gap-2 px-3 py-2 text-sm" data-sui-multi-select-loading role="status">
							<span class="animate-spin rounded-full border-2 border-current border-t-transparent size-3.5" aria-hidden="true"></span>
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
</div>

{#if invalid || subText}
	<div
		id={messageId}
		data-sui-field-message
		data-sui-variant={invalid ? effVariant : undefined}
		class="{SUI_SUBTEXT[size]} mt-1 {invalid ? SUI_FIELD_TEXT[effVariant] : 'text-muted-foreground'}"
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
