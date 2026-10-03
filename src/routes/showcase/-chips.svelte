<script lang="ts" module>
        export type ChipKind = 'label' | 'priority' | 'deploy' | 'env' | 'event' | 'activity';
</script>

<script lang="ts">
        import { Badge } from '$lib/components/ui/badge/index.js';
        import { LABELS, EVENT_KINDS, PRIORITY_LABEL, type LabelKey, type Priority, type DeployStatus, type Env, type EventKind, type ActivityKind } from './-data.svelte';

        import FlameIcon from '@lucide/svelte/icons/flame';
        import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
        import EqualIcon from '@lucide/svelte/icons/equal';
        import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
        import RocketIcon from '@lucide/svelte/icons/rocket';
        import CircleDotIcon from '@lucide/svelte/icons/circle-dot';
        import MessageSquareIcon from '@lucide/svelte/icons/message-square';
        import SirenIcon from '@lucide/svelte/icons/siren';
        import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
        import CheckIcon from '@lucide/svelte/icons/check';
        import XIcon from '@lucide/svelte/icons/x';
        import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
        import ClockIcon from '@lucide/svelte/icons/clock';
        import BanIcon from '@lucide/svelte/icons/ban';

        /**
         * One component, every small chip/badge/flag used across the showcase:
         *
         * kind="label"    value=<LabelKey>     colored label chip
         * kind="priority" value=<Priority>     flag + text
         * kind="deploy"   value=<DeployStatus> status badge
         * kind="env"      value=<Env>          environment badge
         * kind="event"    value=<EventKind>    calendar chip
         * kind="activity" value=<ActivityKind> feed icon
         */
        let { kind, value, short = false }: { kind: ChipKind; value: string; short?: boolean } = $props();

        const label = $derived(LABELS[value as LabelKey]);
        const priority = $derived(value as Priority);
        const deploy = $derived(value as DeployStatus);
        const env = $derived(value as Env);
        const event = $derived(EVENT_KINDS[value as EventKind]);

        const PRIORITY_META: Record<Priority, { icon: typeof FlameIcon; cls: string }> = {
                urgent: { icon: FlameIcon, cls: 'text-red-600 dark:text-red-400' },
                high: { icon: ArrowUpIcon, cls: 'text-orange-600 dark:text-orange-400' },
                medium: { icon: EqualIcon, cls: 'text-sky-600 dark:text-sky-400' },
                low: { icon: ArrowDownIcon, cls: 'text-zinc-500 dark:text-zinc-400' }
        };
</script>

{#snippet Prio()}
        {@const meta = PRIORITY_META[priority]}
        <span class="inline-flex items-center gap-1 text-xs font-medium {meta.cls}" title="Priority: {PRIORITY_LABEL[priority]}">
                <meta.icon class="size-3.5" aria-hidden="true" />
                {#if !short}{PRIORITY_LABEL[priority]}{/if}
        </span>
{/snippet}

{#if kind === 'label' && label}
        <span class="border text-[10px] font-medium tracking-wide uppercase rounded-full px-2 py-0.5 {label.className}">{label.label}</span>
{:else if kind === 'priority'}
        {@render Prio()}
{:else if kind === 'deploy'}
        {#if deploy === 'success'}
                <Badge variant="secondary" class="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                        <CheckIcon class="size-3" aria-hidden="true" />{#if !short}Success{/if}
                </Badge>
        {:else if deploy === 'failed'}
                <Badge variant="secondary" class="gap-1 border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300">
                        <XIcon class="size-3" aria-hidden="true" />{#if !short}Failed{/if}
                </Badge>
        {:else if deploy === 'building'}
                <Badge variant="secondary" class="gap-1 border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300">
                        <LoaderCircleIcon class="size-3 animate-spin" aria-hidden="true" />{#if !short}Building{/if}
                </Badge>
        {:else if deploy === 'canceled'}
                <Badge variant="secondary" class="gap-1 text-muted-foreground">
                        <BanIcon class="size-3" aria-hidden="true" />{#if !short}Canceled{/if}
                </Badge>
        {:else}
                <Badge variant="secondary" class="gap-1 text-muted-foreground">
                        <ClockIcon class="size-3" aria-hidden="true" />{#if !short}Queued{/if}
                </Badge>
        {/if}
{:else if kind === 'env'}
        {#if env === 'production'}
                <Badge variant="secondary" class="border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">prod</Badge>
        {:else if env === 'staging'}
                <Badge variant="secondary" class="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">staging</Badge>
        {:else}
                <Badge variant="secondary" class="border-zinc-500/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400">preview</Badge>
        {/if}
{:else if kind === 'event' && event}
        <span class="border text-[10px] font-medium tracking-wide uppercase rounded-full px-2 py-0.5 {event.chip}">{event.label}</span>
{:else if kind === 'activity'}
        {#if value === 'deploy'}
                <RocketIcon class="text-chart-2 size-3.5" aria-hidden="true" />
        {:else if value === 'incident'}
                <SirenIcon class="text-chart-5 size-3.5" aria-hidden="true" />
        {:else if value === 'security'}
                <ShieldCheckIcon class="text-emerald-500 size-3.5" aria-hidden="true" />
        {:else if value === 'comment'}
                <MessageSquareIcon class="text-sky-500 size-3.5" aria-hidden="true" />
        {:else}
                <CircleDotIcon class="text-muted-foreground size-3.5" aria-hidden="true" />
        {/if}
{/if}
