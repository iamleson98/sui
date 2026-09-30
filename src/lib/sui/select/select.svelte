<script lang="ts" module>
        import type { Snippet } from 'svelte';
        import type { HTMLButtonAttributes } from 'svelte/elements';
        import type { ZodType } from 'zod';
        import type { SuiFieldVariant, SuiIconComponent, SuiItem, SuiSize } from '../types.js';
        import type { SuiSource } from '../pagination.js';

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
                /** zod v4 schema validated on change. */
                schema?: ZodType;
                errors?: string[];
                required?: boolean;
                /** Allow clearing the selection (shows a clear button). Default `false`. */
                clearable?: boolean;
                /** Text when no options exist. Default `"No options"`. */
                emptyText?: string;
                /** Error message shown when a `source` request fails. */
                errorText?: string;
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
        import SuiIcon from '../sui-icon.svelte';
        import { SuiFieldState } from '../field.svelte.js';
        import { SuiInfiniteList } from '../infinite-list.svelte.js';
        import { observeSentinel } from '../intersection.js';
        import {
                suiEffectiveVariant,
                SUI_CLEAR_END,
                SUI_CLEAR_PE,
                SUI_CONTROL,
                SUI_FIELD_CONTROL,
                SUI_FIELD_TEXT,
                SUI_LABEL,
                SUI_SUBTEXT
        } from '../styles.js';
        import { cn } from '$lib/utils.js';
        import XIcon from '@lucide/svelte/icons/x';

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
                errors: externalErrors = [],
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

        const field = new SuiFieldState();

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
        const selected = $derived(resolvedItems.find((item) => item.value === value));
        const hasValue = $derived(value !== undefined && value !== '');

        // deduped: the same message can arrive from both the `errors` prop (server)
        // and the local zod validation — duplicate keys would break {#each (error)}
        const allErrors = $derived([...new Set([...externalErrors, ...field.errors])]);
        const invalid = $derived(allErrors.length > 0);
        const effVariant = $derived(suiEffectiveVariant(variant, invalid ? allErrors : undefined));
        const messageId = $derived(`${id}-message`);
        const describedBy = $derived(invalid || subText ? messageId : undefined);

        // sentinel wiring for infinite scroll
        let sentinel: HTMLElement | null = $state(null);
        let triggerRef: HTMLButtonElement | null = $state(null);
        $effect(() => {
                if (!infinite || !sentinel) return;
                // measure against the actual scroll port when we can — the bits-ui
                // select viewport is the element that scrolls
                return observeSentinel(sentinel, () => void list.loadMore());
        });

        /** Undefined (nothing selected) is validated as '' so `z.string().min(1, 'msg')` works. */
        function validateSelection(candidate: V | undefined) {
                field.validate(candidate ?? '', schema, 'change', 'change');
        }

        function select(next: V) {
                value = next;
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

<!-- Single root: the field never leaks layout primitives into the parent,
     so external grid/flex gaps can't separate label, control and message. -->
<div class={cn('flex w-full flex-col', className)} data-sui-field="select" data-sui-size={size}>
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

        <div class="relative w-full">
                <Select.Root
                        type="single"
                        bind:value={value as never}
                        required={required || undefined}
                        onValueChange={(next) => {
                                if (next !== undefined && next !== null && next !== '') select(next as V);
                        }}
                        onOpenChange={(open) => {
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
                                        'border-input bg-transparent dark:bg-input/30 dark:focus:bg-input/50 focus-visible:ring-3 shadow-xs relative flex w-full items-center rounded-md border transition-[color,box-shadow] outline-none',
                                        SUI_CONTROL[size],
                                        SUI_FIELD_CONTROL[effVariant],
                                        clearable && hasValue && SUI_CLEAR_PE[size],
                                        className
                                )}
                                {...(rest as Record<string, unknown>)}
                                onblur={(event: FocusEvent) => {
                                        onblur?.(event as never);
                                        field.validate(value, schema, 'blur', 'both');
                                }}
                        >
                                {#if startIcon}
                                        <span class="text-muted-foreground pointer-events-none shrink-0">
                                                <SuiIcon icon={startIcon} {size} />
                                        </span>
                                {/if}
                                {#if hasValue}
                                        <span class="flex min-w-0 flex-1 items-center gap-2 text-left">
                                                <span class="truncate">{selected?.label ?? value}</span>
                                        </span>
                                {:else}
                                        <span class="text-muted-foreground flex-1 truncate text-left">{placeholder}</span>
                                {/if}
                                {#if endIcon}
                                        <span class="text-muted-foreground pointer-events-none shrink-0">
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
                        <Select.Content class="sui-select-content z-50 p-1">
                                {#if infinite && list.error}
                                        <div
                                                class="text-destructive flex items-center justify-center gap-2 px-2.5 py-3 text-sm"
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
                                                                <span class="text-muted-foreground w-full truncate text-xs leading-snug">
                                                                        {item.description}
                                                                </span>
                                                        {/if}
                                                </span>
                                        </Select.Item>
                                {/each}
                                {#if resolvedItems.length === 0}
                                        {#if !infinite}
                                                <div class="text-muted-foreground px-2.5 py-6 text-center text-sm" data-sui-select-empty>
                                                        {emptyText}
                                                </div>
                                        {:else if !list.loading && !list.loadingMore && !list.error}
                                                <div class="text-muted-foreground px-2.5 py-6 text-center text-sm" data-sui-select-empty>
                                                        {emptyText}
                                                </div>
                                        {/if}
                                {/if}
                                {#if infinite && (list.loading || list.loadingMore)}
                                        <div
                                                class="text-muted-foreground flex items-center justify-center gap-2 px-2.5 py-3 text-sm"
                                                data-sui-select-loading
                                                role="status"
                                        >
                                                <span class="animate-spin rounded-full border-2 border-current border-t-transparent size-4" aria-hidden="true"></span>
                                                {list.loading ? 'Loading…' : 'Loading more…'}
                                        </div>
                                {/if}
                                {#if infinite && list.hasMore}
                                        <div bind:this={sentinel} data-sui-load-more-sentinel class="h-px w-full" aria-hidden="true"></div>
                                {/if}
                        </Select.Content>
                </Select.Root>

                {#if clearable && hasValue}
                        <!-- Clear affordance rendered OUTSIDE the trigger button (nested
                             interactive elements are invalid HTML and bits-ui opens the menu
                             on pointerdown, before any click could be intercepted). -->
                        <button
                                type="button"
                                data-sui-clear
                                class="{SUI_CLEAR_END[size]} text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring/50 absolute top-1/2 z-10 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2"
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
