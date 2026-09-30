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
        import SuiIcon from '../sui-icon.svelte';
        import { SuiFieldState } from '../field.svelte.js';
        import { SuiInfiniteList } from '../infinite-list.svelte.js';
        import { fitChipCount } from '../chip-fit.js';
        import { observeSentinel } from '../intersection.js';
        import {
                suiEffectiveVariant,
                SUI_CHIP,
                SUI_CONTROL_MIN,
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
                action,
                searchPlaceholder = 'Search…',
                placeholder = 'Select…',
                searchable = true,
                searchDebounce = 250,
                schema,
                errors: externalErrors = [],
                required = false,
                clearable = false,
                maxDisplay = 'responsive',
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
        const listboxId = $derived(`${id}-listbox`);

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

        // deduped: the same message can arrive from both the `errors` prop (server)
        // and the local zod validation — duplicate keys would break {#each (error)}
        const allErrors = $derived([...new Set([...externalErrors, ...field.errors])]);
        const invalid = $derived(allErrors.length > 0);
        const effVariant = $derived(suiEffectiveVariant(variant, invalid ? allErrors : undefined));
        const messageId = $derived(`${id}-message`);
        const describedBy = $derived(invalid || subText ? messageId : undefined);

        let open = $state(false);
        let query = $state('');
        let sentinel: HTMLElement | null = $state(null);
        let searchTimer: ReturnType<typeof setTimeout> | undefined;
        let triggerWidth = $state(0);
        let listEl: HTMLElement | null = $state(null);

        // bits-ui's FocusScope returns DOM focus to the trigger whenever the
        // content unmounts. That is right for Esc / keyboard selection, but
        // after an outside-CLICK dismissal the focus should follow the pointer
        // out of the field — otherwise the trigger keeps the focused look
        // forever. Tracked here and honored in `onCloseAutoFocus` below.
        let dismissedByPointer = false;

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

        function remove(v: V) {
                const next = value.filter((x) => x !== v);
                value = next;
                field.validate(next, schema, 'change', 'change');
                const selectedItems = next.map((x) => resolvedItems.find((i) => i.value === x) ?? { value: x, label: x });
                onSelect?.(next, selectedItems);
        }

        function clearAll() {
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

<!-- Single root: the field never leaks layout primitives into the parent. -->
<div class={cn('flex w-full flex-col', className)} data-sui-field="multi-select" data-sui-size={size}>
        {#if label}
                <label
                        for={id}
                        id="{id}-label"
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

        <div class="relative w-full" bind:clientWidth={triggerWidth}>
                <Popover.Root
                        bind:open
                        onOpenChange={(next) => {
                                open = next;
                                if (next) {
                                        dismissedByPointer = false;
                                } else {
                                        query = '';
                                        field.validate(value, schema, 'blur', 'both');
                                }
                        }}
                >
                        <!-- The trigger is a div, not a button: chips contain real <button>
                             remove controls, which can never be nested inside a <button>.
                             bits-ui's popover props (toggle handlers, aria, ref attachment)
                             are spread onto the div; combobox semantics override the
                             popover defaults afterwards. -->
                        <Popover.Trigger>
                                {#snippet child({ props })}
                                        {@const { type: _ignoredType, ...divProps } = props}
                                        <div
                                                {...divProps}
                                                {id}
                                                role="combobox"
                                                tabindex="0"
                                                aria-labelledby={label ? `${id}-label` : undefined}
                                                data-sui-multi-select
                                                data-sui-trigger
                                                data-sui-size={size}
                                                data-sui-variant={effVariant}
                                                data-invalid={invalid || undefined}
                                                aria-invalid={invalid || undefined}
                                                aria-describedby={describedBy}
                                                aria-haspopup="listbox"
                                                aria-controls={listboxId}
                                                class={cn(
                                                        'border-input bg-transparent dark:bg-input/30 dark:focus-visible:bg-input/50 focus-visible:ring-3 shadow-xs relative flex w-full cursor-pointer items-start rounded-md border transition-[color,box-shadow] outline-none',
                                                        SUI_CONTROL_MIN[size],
                                                        SUI_FIELD_TRIGGER[effVariant],
                                                        className
                                                )}
                                                {...(rest as Record<string, unknown>)}
                                                onkeydown={(event: KeyboardEvent) => {
                                                        // ArrowDown/ArrowUp open the menu (combobox convention);
                                                        // Enter/Space are delegated to bits-ui's handler below.
                                                        if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !open) {
                                                                event.preventDefault();
                                                                open = true;
                                                                return;
                                                        }
                                                        (divProps.onkeydown as ((event: KeyboardEvent) => void) | undefined)?.(event);
                                                }}
                                                onblur={(event: FocusEvent) => {
                                                        onblur?.(event as never);
                                                        field.validate(value, schema, 'blur', 'both');
                                                }}
                                        >
                                                {#if startIcon}
                                                        <span class="text-muted-foreground pointer-events-none shrink-0 {expanded ? 'mt-1.5 self-start' : 'self-center'}">
                                                                <SuiIcon icon={startIcon} {size} />
                                                        </span>
                                                {/if}

                                                {#if selected.length === 0}
                                                        <span class="text-muted-foreground flex min-w-0 flex-1 self-stretch items-center truncate text-left">
                                                                {placeholder}
                                                        </span>
                                                {:else}
                                                        <span bind:this={chipsRowEl} class="flex min-h-0 min-w-0 flex-1 flex-wrap items-center self-stretch gap-1 overflow-hidden py-0.5">
                                                                {#each visible as sel (sel.value)}
                                                                        <span
                                                                                class="bg-secondary text-secondary-foreground inline-flex w-fit max-w-full shrink-0 items-center gap-0.5 overflow-hidden text-nowrap {SUI_CHIP[size]}"
                                                                                data-sui-badge
                                                                                data-value={sel.value}
                                                                        >
                                                                                <span class="truncate">{sel.label}</span>
                                                                                <button
                                                                                        type="button"
                                                                                        data-sui-badge-remove
                                                                                        class="hover:bg-accent-foreground/15 flex size-[1.15em] shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2"
                                                                                        aria-label="Remove {sel.label}"
                                                                                        onclick={(event) => {
                                                                                                event.preventDefault();
                                                                                                event.stopPropagation();
                                                                                                remove(sel.value);
                                                                                        }}
                                                                                        onkeydown={(event) => event.stopPropagation()}
                                                                                >
                                                                                        <SuiIcon icon={XIcon} size="xs" />
                                                                                </button>
                                                                        </span>
                                                                {/each}
                                                                {#if overflow > 0 && !expanded}
                                                                        <button
                                                                                type="button"
                                                                                data-sui-badge
                                                                                data-sui-badge-overflow
                                                                                class="bg-secondary text-secondary-foreground hover:bg-accent-foreground/15 inline-flex w-fit shrink-0 cursor-pointer items-center rounded-full transition-colors outline-none focus-visible:ring-2 {SUI_CHIP[size]}"
                                                                                aria-label="Show {overflow} more selected: {hiddenLabels.join(', ')}"
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
                                                                                class="text-muted-foreground hover:text-foreground inline-flex w-fit shrink-0 cursor-pointer items-center rounded-full px-1 text-xs underline-offset-2 hover:underline outline-none focus-visible:ring-2"
                                                                                onclick={(event) => {
                                                                                        event.preventDefault();
                                                                                        event.stopPropagation();
                                                                                        expanded = false;
                                                                                }}
                                                                                onkeydown={(event) => event.stopPropagation()}
                                                                        >
                                                                                Show less
                                                                        </button>
                                                                {/if}
                                                        </span>
                                                {/if}

                                                {#if action}
                                                        <!-- A click shield: interactive content inside must not toggle the popover. -->
                                                        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
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
                                                {#if clearable && selected.length > 0}
                                                        <button
                                                                type="button"
                                                                data-sui-clear
                                                                class="text-muted-foreground hover:text-foreground hover:bg-accent flex {expanded ? 'mt-1.5 self-start' : 'self-center'} size-6 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2"
                                                                aria-label="Clear all"
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
                                                        class="text-muted-foreground pointer-events-none {SUI_ICON[size]} shrink-0 transition-transform duration-150 {expanded ? 'mt-1.5 self-start' : 'self-center'} {open ? 'rotate-180' : ''}"
                                                        aria-hidden="true"
                                                />
                                        </div>
                                {/snippet}
                        </Popover.Trigger>
                        <Popover.Content
                                class="sui-multi-select-content z-50 w-(--sui-trigger-width) gap-0 p-1.5"
                                style="--sui-trigger-width: {triggerWidth}px"
                                align="start"
                                onInteractOutside={() => (dismissedByPointer = true)}
                                onEscapeKeydown={() => (dismissedByPointer = false)}
                                onCloseAutoFocus={(event) => {
                                        if (dismissedByPointer) event.preventDefault();
                                }}
                        >
                                <Command.Root data-sui-multi-select-command shouldFilter={infinite ? false : searchable}>
                                        {#if searchable}
                                                <div class="border-b border-border px-0.5 pb-2.5 mb-1">
                                                        <Command.Input bind:value={query} placeholder={searchPlaceholder} data-sui-multi-select-input />
                                                </div>
                                        {/if}
                                        <Command.List id={listboxId} data-sui-multi-select-list class="max-h-64 px-0.5">
                                                {#if infinite && list.error}
                                                        <div
                                                                class="text-destructive flex items-center justify-center gap-2 px-2.5 py-3 text-sm"
                                                                data-sui-multi-select-error
                                                                role="alert"
                                                        >
                                                                {errorText}
                                                        </div>
                                                {/if}
                                                {#if !(infinite && (list.loading || list.loadingMore))}
                                                        <Command.Empty data-sui-multi-select-empty class="py-8">{emptyText}</Command.Empty>
                                                {/if}
                                                {#each resolvedItems as item (item.value)}
                                                        <!-- `class` hides the wrapper's built-in trailing check icon (bits-ui
                                                             never sets its data-checked) — sui renders its own leading check. -->
                                                        <Command.Item
                                                                value={item.value}
                                                                data-sui-option
                                                                data-disabled={item.disabled || undefined}
                                                                disabled={item.disabled || undefined}
                                                                onSelect={() => toggle(item)}
                                                                class="gap-2.5 rounded-md px-2.5 py-2 [&>svg:last-of-type]:hidden"
                                                        >
                                                                <CheckIcon
                                                                        class="{SUI_ICON[size]} shrink-0 transition-opacity {isSelected(item.value) ? 'opacity-100' : 'opacity-0'}"
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
                                                                data-sui-multi-select-loading
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
                                                class="bg-secondary text-secondary-foreground inline-flex w-fit shrink-0 items-center gap-0.5 text-nowrap {SUI_CHIP[size]}"
                                                data-measure-chip
                                        >
                                                {sel.label}
                                                <XIcon class="size-[1.15em] shrink-0" aria-hidden="true" />
                                        </span>
                                {/each}
                                <span
                                        class="bg-secondary text-secondary-foreground inline-flex w-fit shrink-0 items-center rounded-full {SUI_CHIP[size]}"
                                        data-measure-badge
                                >
                                        +{selected.length}
                                </span>
                        </div>
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
