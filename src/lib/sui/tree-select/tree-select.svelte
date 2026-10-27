<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import type { SuiSchemaLike } from '../form/schema.js';
	import type { SuiFieldVariant, SuiIconComponent, SuiSize } from '../types.js';
	import type { SuiValidateOn } from '../zod.js';
	import type { SuiFieldHandle } from '../form/index.js';
	import type { SuiTreeItem, SuiTreeSelectable } from '../tree.js';

	export type SuiTreeSelectProps<V extends string = string> = Omit<
		HTMLButtonAttributes,
		'value' | 'size' | 'class'
	> & {
		/** The options, as a tree: each may hold more in `children`. */
		items: SuiTreeItem<V>[];
		/**
		 * Which nodes can be chosen. `any` (default): a branch is a choice too,
		 * standing for everything below it — what a filter wants. `leaf`: only
		 * nodes without children, for filing something under the most specific
		 * level; branches just open.
		 */
		selectable?: SuiTreeSelectable;
		/** Show the chosen node with the names above it, "Math › Grade 1". Default `true`. */
		showPath?: boolean;
		/**
		 * How the options open. `cascade` (default): a menu whose branches fly out
		 * their children when hovered (or opened with Right / Enter), as in
		 * desktop menus; phones get the inline tree in a bottom sheet, since touch
		 * cannot hover. `inline`: the tree with chevrons, everywhere, with a search
		 * box (a menu cannot hold one: it owns items only).
		 */
		display?: 'cascade' | 'inline';
		/** Inline tree: open every branch when the list opens. Default: only the way to the chosen node. */
		expandAll?: boolean;
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
		/** Inline tree: show the search input. Default `true`. A cascade menu has none; its type-ahead finds items by typing. */
		searchable?: boolean;
		schema?: SuiSchemaLike;
		/** When to run `schema`. Default `both` (every selection + blur). */
		validateOn?: SuiValidateOn;
		errors?: string[];
		/** Schema-driven form handle (`form.fields.subject` from `createSuiForm`). */
		field?: SuiFieldHandle<V | undefined>;
		required?: boolean;
		clearable?: boolean;
		emptyText?: string;
		/** Native form `name` (a hidden input carries the value for `FormData`). */
		name?: string;
		/** Accessible id — a hydration-safe one is generated when omitted. */
		id?: string;
		class?: string;
		value?: V;
		/** `path` lists the names from the top level down to the chosen node. */
		onSelect?: (
			value: V | undefined,
			item: SuiTreeItem<V> | undefined,
			path: SuiTreeItem<V>[]
		) => void;
	};
</script>

<script lang="ts" generics="V extends string = string">
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Drawer from '$lib/components/ui/drawer/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as InputGroup from '$lib/components/ui/input-group/index.js';
	import { containedScrollDelta } from '$lib/components/ui/command/contained-scroll-into-view.js';
	import SuiIcon from '../sui-icon.svelte';
	import { SuiFieldState } from '../field.svelte.js';
	import { registerSuiField } from '../form/field-registry.js';
	import { SuiPopupDismiss } from '../popup-blur.js';
	import { suiMobileQuery } from '../mobile.svelte.js';
	import { getSuiStrings } from '../strings.js';
	import {
		SUI_TREE_SEPARATOR,
		SuiTreeIndex,
		treeKey,
		type SuiTreeNode,
		type SuiTreeRow
	} from '../tree.js';
	import { SvelteSet } from 'svelte/reactivity';
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
		SUI_SUBTEXT,
		SUI_DISABLED_LABEL,
		SUI_DISABLED_TRIGGER
	} from '../styles.js';
	import { cn } from '$lib/utils.js';
	import XIcon from '@lucide/svelte/icons/x';
	import CheckIcon from '@lucide/svelte/icons/check';
	import SearchIcon from '@lucide/svelte/icons/search';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';

	const uid = $props.id();
	const strings = getSuiStrings();

	let {
		items,
		selectable = 'any',
		showPath = true,
		display = 'cascade',
		expandAll = false,
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
		schema,
		validateOn = 'both',
		errors: externalErrors = [],
		name,
		field: f,
		required = false,
		clearable = false,
		emptyText,
		class: className = '',
		id = `sui-tree-select-${uid}`,
		value = $bindable<V | undefined>(undefined),
		onSelect,
		onblur,
		...rest
	}: SuiTreeSelectProps<V> = $props();
	// `disabled` reaches the trigger with the rest; the label fades with it.
	const disabled = $derived(!!(rest as { disabled?: boolean }).disabled);

	const fieldState = new SuiFieldState();

	// form-level submitter wiring (see the combobox)
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
	// mobile: the list renders in a drag-to-dismiss bottom sheet
	const isMobile = suiMobileQuery();
	// Hovering needs a pointer: phones get the inline tree whatever `display` says.
	const cascade = $derived(display === 'cascade' && !isMobile.current);

	$effect(() => fieldState.syncExternal(externalErrors));
	$effect(() => f?.registerControl(id));
	// keep the bound shadow in sync with programmatic form changes
	$effect(() => {
		if (f) value = f.value as V | undefined;
	});

	const treeId = $derived(`${id}-tree`);
	const index = $derived(new SuiTreeIndex<V>(items));
	const current = $derived((f ? f.value : value) as V | undefined);
	const selectedNode = $derived(index.get(current));
	const hasValue = $derived(current !== undefined && current !== '');
	const triggerText = $derived(
		selectedNode
			? showPath
				? index
						.path(current)
						.map((node) => node.item.label)
						.join(SUI_TREE_SEPARATOR)
				: selectedNode.item.label
			: undefined
	);
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
	let triggerWidth = $state(0);
	let triggerRef: HTMLButtonElement | null = $state(null);

	// Browsing shows the tree with its open branches; a search shows what
	// matches as a flat list, each with the names above it.
	const searching = $derived(query.trim() !== '');
	const expanded = new SvelteSet<V>();
	const rows = $derived(
		searching ? index.search(query, selectable) : index.rows(expanded, selectable)
	);
	let active = $state<V | undefined>(undefined);
	// the highlighted row follows the list: it stays while it is shown,
	// otherwise the first row takes it
	$effect(() => {
		if (rows.some((row) => row.node.item.value === active)) return;
		active = rows[0]?.node.item.value;
	});
	// Keeps the highlighted row in view by moving the list only: a native
	// scrollIntoView can move the page under a fixed popup (see
	// contained-scroll-into-view.ts).
	let listRef = $state<HTMLElement | null>(null);
	$effect(() => {
		if (!open || !listRef || active === undefined) return;
		const node = index.get(active);
		const row = node && listRef.ownerDocument.getElementById(rowId(node.seq));
		if (!row) return;
		const delta = containedScrollDelta(
			row.getBoundingClientRect(),
			listRef.getBoundingClientRect(),
			'nearest'
		);
		if (delta !== 0) listRef.scrollTop += delta;
	});

	const rowId = (seq: number) => `${id}-n${seq}`;
	const activeDescendant = $derived.by(() => {
		const node = index.get(active);
		return node ? rowId(node.seq) : undefined;
	});

	// popup dismissal + blur contract (see popup-blur.ts)
	const dismiss = new SuiPopupDismiss();
	// whichever popup host is mounted (popover content / mobile sheet)
	let contentRef = $state<HTMLElement | null>(null);

	$effect(() => {
		if (!open) return;
		const onDown = (e: PointerEvent) => {
			const t = e.target as Node | null;
			if (!t) return;
			if (contentRef?.contains(t)) return;
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
		open = false;
		query = '';
		validateSelection(next);
		const path = index.path(next);
		onSelect?.(
			next,
			path.at(-1)?.item,
			path.map((node) => node.item)
		);
	}

	function toggle(row: SuiTreeRow<V>) {
		const v = row.node.item.value;
		if (expanded.has(v)) expanded.delete(v);
		else expanded.add(v);
	}

	/** A click or Enter on a row: choose it, or open it when it is only a branch. */
	function activate(row: SuiTreeRow<V>) {
		if (row.selectable) select(row.node.item.value);
		else if (row.expandable) toggle(row);
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || (event.key === ' ' && !searchable)) {
			const row = rows.find((candidate) => candidate.node.item.value === active);
			if (row) {
				event.preventDefault();
				activate(row);
			}
			return;
		}
		// a search owns the caret; the tree keys that fold rows are for browsing
		if (searching && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) return;
		const move = treeKey(rows, active, event.key);
		if (move.kind === 'none') return;
		event.preventDefault();
		if (move.kind === 'highlight') active = move.value as V;
		else if (move.kind === 'expand') expanded.add(move.value as V);
		else expanded.delete(move.value as V);
	}

	/** Opening starts from the chosen node, shown, or from the top. */
	function reveal() {
		expanded.clear();
		for (const v of expandAll ? index.branches() : index.ancestors(current)) expanded.add(v);
		const shown = index.rows(expanded, selectable);
		active = shown.some((row) => row.node.item.value === current)
			? current
			: shown[0]?.node.item.value;
	}

	/** Shared by the popover and the mobile bottom sheet. */
	function handleOpenChange(next: boolean) {
		open = next;
		if (next) {
			dismiss.open();
			reveal();
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
		onSelect?.(undefined, undefined, []);
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
	data-sui-field="tree-select"
	data-sui-size={size}
>
	{#if label}
		<label
			for={id}
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
				data-sui-tree-select
				data-sui-trigger
				data-sui-size={size}
				data-sui-variant={effVariant}
				data-invalid={invalid || undefined}
				aria-invalid={invalid || undefined}
				aria-required={required || undefined}
				aria-haspopup={cascade ? 'menu' : 'tree'}
				aria-controls={treeId}
				class={cn(
					'relative flex w-full cursor-pointer items-center rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-3 dark:bg-input/30 dark:focus-visible:bg-input/50',
					SUI_CONTROL[size],
					SUI_FIELD_TRIGGER[effVariant],
					SUI_DISABLED_TRIGGER,
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
					<span class="flex-1 truncate text-left" title={triggerText}>{triggerText ?? current}</span>
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

		<!-- One line of the list; browsing and searching share it. -->
		{#snippet treeRow(row: SuiTreeRow<V>)}
			{@const item = row.node.item}
			{@const choosable = row.selectable}
			<!-- Keyboard use is on the search box (or the tree itself), which keeps focus
			     and points at the highlighted row; the row's click is for pointers. -->
			<div
				id={rowId(row.node.seq)}
				role={searching ? 'option' : 'treeitem'}
				aria-selected={item.value === current}
				aria-expanded={!searching && row.expandable ? row.expanded : undefined}
				aria-level={searching ? undefined : row.node.level}
				aria-setsize={searching ? undefined : row.node.siblings}
				aria-posinset={searching ? undefined : row.node.index + 1}
				aria-disabled={!choosable && !row.expandable ? true : undefined}
				data-sui-option
				data-sui-tree-row
				data-active={item.value === active || undefined}
				data-disabled={!choosable && !row.expandable ? true : undefined}
				class="flex cursor-pointer items-center gap-1 rounded-md py-1.5 pr-2.5 text-sm outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-active:bg-accent data-active:text-accent-foreground"
				style="padding-left: {searching ? 0.625 : 0.25 + (row.node.level - 1) * 1.25}rem"
				onclick={() => activate(row)}
				onpointermove={() => (active = item.value)}
			>
				{#if !searching}
					{#if row.expandable}
						<button
							type="button"
							tabindex="-1"
							data-sui-tree-toggle
							aria-label={row.expanded
								? strings.collapseNode(item.label)
								: strings.expandNode(item.label)}
							class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
							onclick={(event) => {
								event.stopPropagation();
								toggle(row);
							}}
						>
							<ChevronRightIcon
								class="size-4 transition-transform duration-150 {row.expanded ? 'rotate-90' : ''}"
							/>
						</button>
					{:else}
						<span class="size-7 shrink-0" aria-hidden="true"></span>
					{/if}
				{/if}
				<span class="flex min-w-0 flex-1 flex-col items-start gap-0.5 py-0.5">
					<span class="w-full line-clamp-2 break-words" title={item.label}>{item.label}</span>
					{#if searching && row.trail}
						<span class="w-full truncate text-xs leading-snug text-muted-foreground">
							{row.trail}
						</span>
					{:else if item.description}
						<span class="w-full truncate text-xs leading-snug text-muted-foreground">
							{item.description}
						</span>
					{/if}
				</span>
				{#if item.badge !== undefined}
					<span class="shrink-0 text-xs text-muted-foreground tabular-nums">{item.badge}</span>
				{/if}
				<CheckIcon
					class="{SUI_ICON[size]} shrink-0 transition-opacity {item.value === current
						? 'opacity-100'
						: 'opacity-0'}"
				/>
			</div>
		{/snippet}

		<!-- The list is shared verbatim between popover and drawer. -->
		{#snippet listbox(listHeightClass: string)}
			<div data-sui-tree-select-panel>
				{#if searchable}
					<div class="mb-1 border-b border-border pb-1">
						<div data-slot="command-input-wrapper" class="p-1 pb-0">
							<InputGroup.Root
								class="h-8! rounded-lg! border-input/30 bg-input/30 shadow-none! *:data-[slot=input-group-addon]:pl-2!"
							>
								<InputGroup.Input
									bind:value={query}
									placeholder={searchPlaceholder ?? strings.searchPlaceholder}
									aria-label={searchPlaceholder ?? strings.searchPlaceholder}
									role="combobox"
									aria-expanded="true"
									aria-haspopup="tree"
									aria-autocomplete="list"
									aria-controls={treeId}
									aria-activedescendant={activeDescendant}
									autocomplete="off"
									data-sui-tree-select-input
									onkeydown={onKeydown}
								/>
								<InputGroup.Addon>
									<SearchIcon class="size-4 shrink-0 opacity-50" />
								</InputGroup.Addon>
							</InputGroup.Root>
						</div>
					</div>
				{/if}
				<!-- Without a search box the list itself takes the focus and the keys. -->
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<div
					bind:this={listRef}
					id={treeId}
					role={searching ? 'listbox' : 'tree'}
					aria-label={typeof label === 'string' ? label : placeholderText}
					tabindex={searchable ? undefined : 0}
					aria-activedescendant={searchable ? undefined : activeDescendant}
					data-sui-tree-select-list
					class="{listHeightClass} overflow-x-hidden overflow-y-auto outline-none"
					onkeydown={searchable ? undefined : onKeydown}
				>
					{#each rows as row (row.node.seq)}
						{@render treeRow(row)}
					{/each}
					{#if rows.length === 0}
						<div
							class="px-2.5 py-8 text-center text-sm text-muted-foreground"
							data-sui-tree-select-empty
							role="status"
						>
							{emptyText ?? (searching ? strings.noResults : strings.noOptions)}
						</div>
					{/if}
				</div>
			</div>
		{/snippet}

		<!-- One line of the cascade: a name, what sits under it, a count and a check. -->
		{#snippet entry(item: SuiTreeItem<V>, trail = '')}
			<span class="flex min-w-0 flex-1 flex-col items-start gap-0.5">
				<span class="w-full line-clamp-2 break-words" title={item.label}>{item.label}</span>
				{#if trail}
					<span class="w-full truncate text-xs leading-snug text-muted-foreground">{trail}</span>
				{:else if item.description}
					<span class="w-full truncate text-xs leading-snug text-muted-foreground">
						{item.description}
					</span>
				{/if}
			</span>
			{#if item.badge !== undefined}
				<span class="shrink-0 text-xs text-muted-foreground tabular-nums">{item.badge}</span>
			{/if}
		{/snippet}

		<!-- The branches of the cascade: a leaf is an item, a branch a submenu that
		     flies out on hover. When a branch can be chosen itself, its submenu opens
		     with an "All of …" item for it. -->
		{#snippet cascadeNodes(nodes: SuiTreeNode<V>[])}
			{#each nodes as node (node.seq)}
				{@const item = node.item}
				{#if index.isLeaf(node)}
					<DropdownMenu.Item
						data-sui-option
						data-sui-tree-row
						disabled={item.disabled}
						onSelect={() => select(item.value)}
						class="gap-2"
					>
						{@render entry(item)}
						<CheckIcon
							class="{SUI_ICON[size]} shrink-0 {item.value === current
								? 'opacity-100'
								: 'opacity-0'}"
						/>
					</DropdownMenu.Item>
				{:else}
					<DropdownMenu.Sub>
						<DropdownMenu.SubTrigger
							data-sui-tree-row
							disabled={item.disabled}
							class="gap-2 {index.ancestors(current).includes(item.value) || item.value === current
								? 'font-medium'
								: ''}"
						>
							{@render entry(item)}
						</DropdownMenu.SubTrigger>
						<DropdownMenu.SubContent
							data-sui-tree-select-sub
							class="max-h-(--bits-dropdown-menu-content-available-height) min-w-56 overflow-y-auto"
						>
							{#if selectable === 'any' && !item.disabled}
								<DropdownMenu.Item
									data-sui-option
									data-sui-tree-all
									onSelect={() => select(item.value)}
									class="gap-2 font-medium"
								>
									<span class="min-w-0 flex-1 line-clamp-2 break-words">{strings.treeAll(item.label)}</span>
									<CheckIcon
										class="{SUI_ICON[size]} shrink-0 {item.value === current
											? 'opacity-100'
											: 'opacity-0'}"
									/>
								</DropdownMenu.Item>
								<DropdownMenu.Separator />
							{/if}
							{@render cascadeNodes(index.children(node))}
						</DropdownMenu.SubContent>
					</DropdownMenu.Sub>
				{/if}
			{/each}
		{/snippet}

		{#if cascade}
			<DropdownMenu.Root bind:open onOpenChange={handleOpenChange}>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						{@render triggerButton(props as Record<string, unknown>)}
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content
					bind:ref={contentRef}
					class="sui-tree-select-content max-h-80 w-(--sui-trigger-width) gap-0"
					style="--sui-trigger-width: {triggerWidth}px"
					align="start"
					data-sui-tree-select-content
					onEscapeKeydown={() => dismiss.keyboard()}
					onCloseAutoFocus={(event) => {
						if (dismiss.cause() === 'pointer') event.preventDefault();
					}}
				>
					{@render cascadeNodes(index.roots)}
					{#if index.roots.length === 0}
						<div role="group" aria-label={emptyText ?? strings.noOptions}>
							<div
								class="px-2.5 py-8 text-center text-sm text-muted-foreground"
								data-sui-tree-select-empty
								role="status"
							>
								{emptyText ?? strings.noOptions}
							</div>
						</div>
					{/if}
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		{:else if isMobile.current}
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
					class="sui-tree-select-sheet mx-0 max-h-[85dvh] gap-0 px-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
					data-sui-tree-select-content
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
					class="sui-tree-select-content z-50 w-(--sui-trigger-width) gap-0 border border-border p-1 ring-0"
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
