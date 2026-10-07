#!/usr/bin/env python3
"""Finish the multi-select mobile-drawer restructure (measured re-indent)."""
import pathlib

f = pathlib.Path('src/lib/sui/multi-select/multi-select.svelte')
lines = f.read_text().split('\n')

def indent_of(s: str) -> int:
    """Indent depth in tabs — spaces (from editor insertions) count as 1/4 tab."""
    n = 0
    for ch in s:
        if ch == '\t':
            n += 1
        elif ch == ' ':
            n += 0.25
        else:
            break
    return int(n)

def to_tabs(s: str) -> str:
    """Convert leading whitespace (tabs or spaces) to tabs."""
    stripped = s.lstrip('\t ')
    return '\t' * indent_of(s) + stripped

# 1) keep everything up to (not including) the manual comment line
ci = next(i for i, l in enumerate(lines) if '<!-- The trigger is shared verbatim' in l)
head = lines[:ci]

# 2) trigger div region: from the manual snippet opener through the trigger `</div>`
si = next(i for i, l in enumerate(lines) if '{#snippet triggerDiv' in l)
di = next(i for i, l in enumerate(lines) if l.lstrip('\t ').startswith('<div') and i > si)
close_i = next(i for i, l in enumerate(lines) if l.strip() == '</div>' and i > di)
trigger_raw = lines[si:close_i + 1]

# normalize: snippet at 2 tabs; everything inside at 3+
norm = []
for l in trigger_raw:
    l = to_tabs(l)  # unify editor-inserted spaces back to tabs
    if not l.strip():
        norm.append('')
        continue
    stripped = l.lstrip('\t')
    if stripped.startswith('{#snippet'):
        norm.append('\t\t' + stripped)
    elif stripped.startswith('{@const'):
        norm.append('\t\t' + stripped)
    else:
        norm.append(l)
# find the <div> line indent as base
base = indent_of(next(l for l in norm if l.lstrip('\t').startswith('<div')))
# re-map: div -> 3 tabs, div content = original - base + 4, deeper content keeps relative depth
fixed = []
for l in norm:
    if not l.strip():
        fixed.append('')
        continue
    cur = indent_of(l)
    stripped = l.lstrip('\t')
    if stripped.startswith(('{#snippet', '{@const')):
        fixed.append('\t\t' + stripped)
    elif cur == base:
        fixed.append('\t\t\t' + stripped)  # the <div> itself
    else:
        fixed.append('\t' * (4 + cur - base) + stripped)

trigger_block = fixed

# 3) option list: from `<Command.Root` (inside old Popover.Content) through `</Command.Root>`
cr_i = next(i for i, l in enumerate(lines) if '<Command.Root data-sui-multi-select-command' in l)
cr_end = next(i for i, l in enumerate(lines) if l.strip() == '</Command.Root>' and i > cr_i)
cmd_raw = lines[cr_i:cr_end + 1]
cbase = indent_of(cmd_raw[0])
cmd_fixed = []
for l in cmd_raw:
    if not l.strip():
        cmd_fixed.append('')
        continue
    l = to_tabs(l)
    cur = indent_of(l)
    cmd_fixed.append('\t' * (3 + cur - cbase) + l.lstrip('\t'))

listbox_block = (
    ['', '\t\t<!-- The option list is shared verbatim between popover and drawer. -->',
     "\t\t{#snippet listbox(listHeightClass: string)}"]
    + cmd_fixed
    + ['\t\t{/snippet}']
)
# parametrize the list height class
listbox_block = [
    l.replace('class="max-h-64 px-0.5"', 'class="{listHeightClass} px-0.5"') for l in listbox_block
]

B = '\t\t\t'
branches = f"""{B}{{#if isMobile.current}}
{B}\t<!-- Mobile: platform-native picker pattern — full-width bottom sheet
{B}\t     with drag-to-dismiss, body scroll lock and safe-area padding. -->
{B}\t<Drawer.Root bind:open onOpenChange={{handleOpenChange}}>
{B}\t\t<Drawer.Trigger>
{B}\t\t\t{{#snippet child({{ props }})}}
{B}\t\t\t\t{{@render triggerDiv(props as Record<string, unknown>)}}
{B}\t\t\t{{/snippet}}
{B}\t\t</Drawer.Trigger>
{B}\t\t<Drawer.Content
{B}\t\t\tclass="mx-0 max-h-[85dvh] gap-0 px-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sui-multi-select-sheet"
{B}\t\t\tdata-sui-multi-select-content
{B}\t\t\tonInteractOutside={{() => (dismissedByPointer = true)}}
{B}\t\t\tonEscapeKeydown={{() => (dismissedByPointer = false)}}
{B}\t\t\tonCloseAutoFocus={{(event: Event) => {{
{B}\t\t\t\tif (dismissedByPointer) event.preventDefault();
{B}\t\t\t}}}}
{B}\t\t>
{B}\t\t\t<Drawer.Title class="sr-only">{{typeof label === 'string' ? label : placeholder}}</Drawer.Title>
{B}\t\t\t<Drawer.Description class="sr-only">Choose options</Drawer.Description>
{B}\t\t\t{{@render listbox('max-h-[60dvh]')}}
{B}\t\t</Drawer.Content>
{B}\t</Drawer.Root>
{B}{{:else}}
{B}\t<Popover.Root bind:open onOpenChange={{handleOpenChange}}>
{B}\t\t<Popover.Trigger>
{B}\t\t\t{{#snippet child({{ props }})}}
{B}\t\t\t\t{{@render triggerDiv(props as Record<string, unknown>)}}
{B}\t\t\t{{/snippet}}
{B}\t\t</Popover.Trigger>
{B}\t\t<Popover.Content
{B}\t\t\tclass="sui-multi-select-content z-50 w-(--sui-trigger-width) gap-0 p-1.5"
{B}\t\t\tstyle="--sui-trigger-width: {{triggerWidth}}px"
{B}\t\t\talign="start"
{B}\t\t\tonInteractOutside={{() => (dismissedByPointer = true)}}
{B}\t\t\tonEscapeKeydown={{() => (dismissedByPointer = false)}}
{B}\t\t\tonCloseAutoFocus={{(event) => {{
{B}\t\t\t\tif (dismissedByPointer) event.preventDefault();
{B}\t\t\t}}}}
{B}\t\t>
{B}\t\t\t{{@render listbox('max-h-64')}}
{B}\t\t</Popover.Content>
{B}\t</Popover.Root>
{B}{{/if}}"""

# 4) tail: everything after </Popover.Root>
pr_end = next(i for i, l in enumerate(lines) if l.strip() == '</Popover.Root>')
tail = lines[pr_end + 1:]

out = head + trigger_block + listbox_block + ['', branches] + tail
f.write_text('\n'.join(out))
print('done')
