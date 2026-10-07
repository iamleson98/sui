#!/usr/bin/env python3
"""Add the mobile bottom-sheet branch to SuiSelect.

Desktop keeps bits-ui Select.Root/Trigger/Content untouched. On phones the
options render in a vaul Drawer with a Command list — a standalone trigger
button + own open state (no Select.Root on that branch), reusing the shared
`select()` value handler and validation contract.
"""
import pathlib
import re

MOBILE_BRANCH = '''\t\t\t\t<!-- Mobile: platform-native picker pattern — full-width bottom sheet
\t\t\t\t     with drag-to-dismiss, body scroll lock and safe-area padding. -->
\t\t\t\t<Drawer.Root bind:open={mobileOpen} onOpenChange={handleMobileOpen}>
\t\t\t\t\t<Drawer.Trigger>
\t\t\t\t\t\t{#snippet child({ props })}
\t\t\t\t\t\t\t<button
\t\t\t\t\t\t\t\t{...props as Record<string, unknown>}
\t\t\t\t\t\t\t\t{id}
\t\t\t\t\t\t\t\ttype="button"
\t\t\t\t\t\t\t\tdata-sui-select
\t\t\t\t\t\t\t\tdata-sui-trigger
\t\t\t\t\t\t\t\tdata-sui-size={size}
\t\t\t\t\t\t\t\tdata-sui-variant={effVariant}
\t\t\t\t\t\t\t\tdata-invalid={invalid || undefined}
\t\t\t\t\t\t\t\taria-invalid={invalid || undefined}
\t\t\t\t\t\t\t\taria-describedby={describedBy}
\t\t\t\t\t\t\t\taria-haspopup="listbox"
\t\t\t\t\t\t\t\taria-controls={listboxId}
\t\t\t\t\t\t\t\tclass={cn(
\t\t\t\t\t\t\t\t\t'border-input bg-transparent dark:bg-input/30 dark:focus-visible:bg-input/50 focus-visible:ring-3 shadow-xs relative flex w-full cursor-pointer items-center rounded-md border transition-[color,box-shadow] outline-none',
\t\t\t\t\t\t\t\t\tSUI_CONTROL[size],
\t\t\t\t\t\t\t\t\tSUI_FIELD_TRIGGER[effVariant],
\t\t\t\t\t\t\t\t\tclearable && hasValue && SUI_CLEAR_PE[size],
\t\t\t\t\t\t\t\t\tclearable && hasValue && SUI_CHEVRON_PIN,
\t\t\t\t\t\t\t\t\tclassName
\t\t\t\t\t\t\t\t)}
\t\t\t\t\t\t\t\t{...(rest as Record<string, unknown>)}
\t\t\t\t\t\t\t\tonblur={(event: FocusEvent) => {
\t\t\t\t\t\t\t\t\tonblur?.(event as never);
\t\t\t\t\t\t\t\t\tfield.validate(value, schema, 'blur', validateOn);
\t\t\t\t\t\t\t\t}}
\t\t\t\t\t\t\t>
\t\t\t\t\t\t\t\t{@render triggerInner()}
\t\t\t\t\t\t\t\t<ChevronDownIcon
\t\t\t\t\t\t\t\t\tclass="text-muted-foreground pointer-events-none {SUI_ICON[size]} shrink-0 transition-transform duration-150 {mobileOpen ? 'rotate-180' : ''}"
\t\t\t\t\t\t\t\t\taria-hidden="true"
\t\t\t\t\t\t\t\t/>
\t\t\t\t\t\t\t</button>
\t\t\t\t\t\t{/snippet}
\t\t\t\t\t</Drawer.Trigger>
\t\t\t\t\t<Drawer.Content
\t\t\t\t\t\tclass="mx-0 max-h-[85dvh] gap-0 px-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sui-select-sheet"
\t\t\t\t\t\tdata-sui-select-content
\t\t\t\t\t\tonCloseAutoFocus={(event: Event) => {
\t\t\t\t\t\t\tif (dismissedByPointer) event.preventDefault();
\t\t\t\t\t\t}}
\t\t\t\t\t\tonInteractOutside={() => (dismissedByPointer = true)}
\t\t\t\t\t\tonEscapeKeydown={() => (dismissedByPointer = false)}
\t\t\t\t\t>
\t\t\t\t\t\t<Drawer.Title class="sr-only">{typeof label === 'string' ? label : placeholder}</Drawer.Title>
\t\t\t\t\t\t<Drawer.Description class="sr-only">Choose an option</Drawer.Description>
\t\t\t\t\t\t<Command.Root data-sui-select-command>
\t\t\t\t\t\t\t<Command.List id={listboxId} data-sui-select-list class="max-h-[60dvh] px-1">
\t\t\t\t\t\t\t\t{#if infinite && list.error}
\t\t\t\t\t\t\t\t\t<div
\t\t\t\t\t\t\t\t\t\tclass="text-destructive flex items-center justify-center gap-2 px-2.5 py-3 text-sm"
\t\t\t\t\t\t\t\t\t\tdata-sui-select-error
\t\t\t\t\t\t\t\t\t\trole="alert"
\t\t\t\t\t\t\t\t\t>
\t\t\t\t\t\t\t\t\t\t{errorText}
\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t{/if}
\t\t\t\t\t\t\t\t{#each resolvedItems as item (item.value)}
\t\t\t\t\t\t\t\t\t<Command.Item
\t\t\t\t\t\t\t\t\t\tvalue={item.value}
\t\t\t\t\t\t\t\t\t\tdata-sui-option
\t\t\t\t\t\t\t\t\t\tdata-disabled={item.disabled || undefined}
\t\t\t\t\t\t\t\t\t\tdisabled={item.disabled || undefined}
\t\t\t\t\t\t\t\t\t\tonSelect={() => select(item.value)}
\t\t\t\t\t\t\t\t\t\tclass="gap-2.5 rounded-md px-2.5 py-2 [&>svg:last-of-type]:hidden"
\t\t\t\t\t\t\t\t\t>
\t\t\t\t\t\t\t\t\t\t<CheckIcon
\t\t\t\t\t\t\t\t\t\t\tclass="{SUI_ICON[size]} shrink-0 transition-opacity {item.value === value ? 'opacity-100' : 'opacity-0'}"
\t\t\t\t\t\t\t\t\t\t/>
\t\t\t\t\t\t\t\t\t\t<span class="flex min-w-0 flex-1 flex-col items-start gap-1">
\t\t\t\t\t\t\t\t\t\t\t<span class="truncate">{item.label}</span>
\t\t\t\t\t\t\t\t\t\t\t{#if item.description}
\t\t\t\t\t\t\t\t\t\t\t\t<span class="text-muted-foreground w-full truncate text-xs leading-snug">
\t\t\t\t\t\t\t\t\t\t\t\t\t{item.description}
\t\t\t\t\t\t\t\t\t\t\t\t</span>
\t\t\t\t\t\t\t\t\t\t\t{/if}
\t\t\t\t\t\t\t\t\t\t</span>
\t\t\t\t\t\t\t\t\t</Command.Item>
\t\t\t\t\t\t\t\t{/each}
\t\t\t\t\t\t\t\t{#if resolvedItems.length === 0 && !(infinite && list.loading)}
\t\t\t\t\t\t\t\t\t<div class="text-muted-foreground px-2.5 py-6 text-center text-sm" data-sui-select-empty>
\t\t\t\t\t\t\t\t\t\t{emptyText}
\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t{/if}
\t\t\t\t\t\t\t\t{#if infinite && (list.loading || list.loadingMore)}
\t\t\t\t\t\t\t\t\t<div
\t\t\t\t\t\t\t\t\t\tclass="text-muted-foreground flex items-center justify-center gap-2 px-2.5 py-3 text-sm"
\t\t\t\t\t\t\t\t\t\tdata-sui-select-loading
\t\t\t\t\t\t\t\t\t\trole="status"
\t\t\t\t\t\t\t\t\t>
\t\t\t\t\t\t\t\t\t\t<span class="animate-spin rounded-full border-2 border-current border-t-transparent size-4" aria-hidden="true"></span>
\t\t\t\t\t\t\t\t\t\t{list.loading ? 'Loading…' : 'Loading more…'}
\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t{/if}
\t\t\t\t\t\t\t\t{#if infinite && list.hasMore}
\t\t\t\t\t\t\t\t\t<div bind:this={sentinel} data-sui-load-more-sentinel class="h-px w-full" aria-hidden="true"></div>
\t\t\t\t\t\t\t\t{/if}
\t\t\t\t\t\t\t</Command.List>
\t\t\t\t\t\t</Command.Root>
\t\t\t\t\t</Drawer.Content>
\t\t\t\t</Drawer.Root>
'''

f = pathlib.Path('src/lib/sui/select/select.svelte')
src = f.read_text()

# --- 1. imports -------------------------------------------------------------
src = src.replace(
    "\timport * as Select from '$lib/components/ui/select/index.js';",
    "\timport * as Select from '$lib/components/ui/select/index.js';\n"
    "\timport * as Command from '$lib/components/ui/command/index.js';\n"
    "\timport * as Drawer from '$lib/components/ui/drawer/index.js';"
)
src = src.replace(
    "\timport { observeSentinel } from '../intersection.js';",
    "\timport { observeSentinel } from '../intersection.js';\n"
    "\timport { suiMobileQuery } from '../mobile.svelte.js';"
)
src = src.replace(
    "\timport XIcon from '@lucide/svelte/icons/x';",
    "\timport XIcon from '@lucide/svelte/icons/x';\n"
    "\timport CheckIcon from '@lucide/svelte/icons/check';\n"
    "\timport ChevronDownIcon from '@lucide/svelte/icons/chevron-down';"
)
src = src.replace(
    "\t\t\tSUI_CONTROL,",
    "\t\t\tSUI_CONTROL,\n\t\t\tSUI_ICON,"
)
src = src.replace(
    "\tlet sentinel: HTMLElement | null = $state(null);",
    "\tlet sentinel: HTMLElement | null = $state(null);\n"
    "\t// sheet dismissal focus contract (see combobox): pointer dismissal\n"
    "\t// leaves focus where the pointer went, keyboard dismissal returns it\n"
    "\tlet dismissedByPointer = false;"
)
src = src.replace(
    "\tconst messageId = $derived(`${id}-message`);",
    "\tconst messageId = $derived(`${id}-message`);\n"
    "\tconst listboxId = $derived(`${id}-listbox`);"
)

# --- 2. mobile state + handler (insert before `export function validate`) ---
m = re.search(r'(\n\s+export function validate\(\))', src)
assert m, 'validate anchor missing'
insert = '''
\t// mobile: options render in a drag-to-dismiss bottom sheet (vaul)
\tconst isMobile = suiMobileQuery();
\tlet mobileOpen = $state(false);

\t/** Mobile drawer open/close — mirrors the Select.Root contract. */
\tfunction handleMobileOpen(next: boolean) {
\t\tmobileOpen = next;
\t\tif (next) {
\t\t\t// pre-load the first page when the sheet opens for the first time
\t\t\tif (infinite && list.items.length === 0 && !list.loading) void list.loadMore();
\t\t} else {
\t\t\tfield.validate(value, schema, 'blur', validateOn);
\t\t}
\t}
'''
src = src[:m.start(1)] + insert + src[m.start(1):]

# --- 3. markup: extract trigger inner into a snippet, branch mobile/desktop.
trigger_inner_start = src.index('{#if startIcon}\n' + ' ' * 40 + '<span class="text-muted-foreground pointer-events-none shrink-0">')
trigger_inner_end = src.index('</Select.Trigger>')
inner = src[trigger_inner_start:trigger_inner_end]

# dedent inner by one tab (from Select.Trigger children depth to snippet depth)
inner = '\n'.join(l[8:] if l.startswith(' ') and l.strip() else l for l in inner.split('\n'))

snippet = f'''        {{#snippet triggerInner()}}
{inner}
\t\t{{/snippet}}

'''

desktop_root_start = src.index('<Select.Root\n')
src = (
    src[:desktop_root_start]
    + snippet
    + '                {#if isMobile.current}\n'
    + MOBILE_BRANCH
    + '                {:else}\n'
    + src[desktop_root_start:]
)

# close the {:else} branch after </Select.Root>
sr_end = src.index('</Select.Root>')
src = src[:sr_end] + '</Select.Root>\n                {/if}' + src[sr_end + len('</Select.Root>'):]

f.write_text(src)
print('select mobile branch added')
