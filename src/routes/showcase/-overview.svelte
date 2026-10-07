<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Progress from '$lib/components/ui/progress/index.js';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import * as ScrollArea from '$lib/components/ui/scroll-area/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Carousel from '$lib/components/ui/carousel/index.js';
	import * as AspectRatio from '$lib/components/ui/aspect-ratio/index.js';
	import * as Separator from '$lib/components/ui/separator/index.js';
	import {
		ChartContainer,
		ChartTooltip,
		type ChartConfig
	} from '$lib/components/ui/chart/index.js';
	import { AreaChart } from 'layerchart';
	import { SuiButton } from '$lib/sui/button/index.js';
	import { SuiSkeleton, SuiSkeletonContainer } from '$lib/sui/skeleton/index.js';
	import { toast } from 'svelte-sonner';

	import ViewHeader from './-view-header.svelte';
	import Kbd from './-kbd.svelte';
	import Chips from './-chips.svelte';
	import PersonAvatar from './-person-avatar.svelte';
	import PersonHover from './-person-hover.svelte';
	import { SuiIconButton } from '$lib/sui/button/index.js';
	import { showcase } from './-state.svelte';
	import {
		ACTIVITY,
		ON_CALL,
		RELEASES,
		SLOS,
		STAT_TILES,
		DEPLOY_SERIES,
		person,
		type Range
	} from './-data.svelte';

	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import XIcon from '@lucide/svelte/icons/x';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
	import TrendingDownIcon from '@lucide/svelte/icons/trending-down';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import MessageCircleIcon from '@lucide/svelte/icons/message-circle';
	import PhoneIcon from '@lucide/svelte/icons/phone';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import RocketIcon from '@lucide/svelte/icons/rocket';
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';

	/* First visit renders size-matched skeletons for a beat (showcase of the
           sui skeleton primitives) — later visits skip straight to content. */
	let ready = $state(showcase.overviewLoaded);
	let alertOpen = $state(true);
	let refreshing = $state(false);
	let olderOpen = $state(false);

	$effect(() => {
		if (showcase.overviewLoaded) {
			ready = true;
			return;
		}
		const t = setTimeout(() => {
			showcase.overviewLoaded = true;
			ready = true;
		}, 650);
		return () => clearTimeout(t);
	});

	function refresh() {
		refreshing = true;
		setTimeout(() => {
			refreshing = false;
			toast.success('Metrics refreshed', { description: 'All panels are up to date.' });
		}, 650);
	}

	/* ------------------------------------------------------------- charts -- */

	const deployConfig = {
		deploys: { label: 'Deploys', color: 'var(--chart-1)' },
		failures: { label: 'Failures', color: 'var(--chart-5)' }
	} satisfies ChartConfig;

	const series = $derived(DEPLOY_SERIES[showcase.range as Range]);

	// sparklines: stat tile → chart config keyed by tile label
	function sparkConfig(i: number): ChartConfig {
		return { v: { label: STAT_TILES[i]!.label, color: STAT_TILES[i]!.color } };
	}
</script>

<ViewHeader
	title="Mission control"
	description="Everything happening across the platform this week — deploys, failures, releases and the people keeping it green."
>
	<ToggleGroup.Root
		type="single"
		bind:value={showcase.range}
		variant="outline"
		size="sm"
		aria-label="Chart range"
	>
		<ToggleGroup.Item value="7d">7d</ToggleGroup.Item>
		<ToggleGroup.Item value="30d">30d</ToggleGroup.Item>
		<ToggleGroup.Item value="90d">90d</ToggleGroup.Item>
	</ToggleGroup.Root>
	<SuiButton
		variant="outline"
		size="sm"
		startIcon={RefreshCwIcon}
		loading={refreshing}
		onclick={refresh}
	>
		Refresh
	</SuiButton>
</ViewHeader>

{#if alertOpen}
	<Alert.Root class="mb-6">
		<TriangleAlertIcon aria-hidden="true" />
		<Alert.Title>Heads up — 2.4.1 patch is rolling out</Alert.Title>
		<Alert.Description>
			The eu-west-1 cache purge incident is resolved, but the fix needs the patch riding the current
			wave. Expect a ~40s read-only window on the audit log at 02:00 UTC.
		</Alert.Description>
		<Alert.Action>
			<SuiIconButton
				icon={XIcon}
				label="Dismiss announcement"
				size="xs"
				variant="ghost"
				onclick={() => (alertOpen = false)}
			/>
		</Alert.Action>
	</Alert.Root>
{/if}

<!-- stat tiles -->
<div class="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
	{#if !ready}
		{#each Array(4) as _, i (i)}
			<Card.Root>
				<Card.Header><SuiSkeleton class="h-4 w-24" /></Card.Header>
				<Card.Content class="space-y-3">
					<SuiSkeleton class="h-8 w-20" />
					<SuiSkeleton class="h-10 w-full" />
				</Card.Content>
			</Card.Root>
		{/each}
	{:else}
		{#each STAT_TILES as tile, i (tile.label)}
			<Card.Root>
				<Card.Header>
					<Card.Title class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
						>{tile.label}</Card.Title
					>
					<Card.Action>
						{#if tile.delta > 0}
							<Badge
								variant="secondary"
								class="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
							>
								{#if tile.up}
									<TrendingUpIcon class="size-3" aria-hidden="true" />
								{:else}
									<TrendingDownIcon class="size-3" aria-hidden="true" />
								{/if}
								{tile.delta}%
							</Badge>
						{:else}
							<Badge variant="secondary" class="gap-1 text-muted-foreground">
								<MinusIcon class="size-3" aria-hidden="true" />flat
							</Badge>
						{/if}
					</Card.Action>
				</Card.Header>
				<Card.Content>
					<div class="text-2xl font-bold tracking-tight tabular-nums">{tile.value}</div>
					<ChartContainer config={sparkConfig(i)} class="mt-2 h-10 w-full">
						<AreaChart
							data={tile.spark.map((v, idx) => ({ i: idx, v }))}
							x="i"
							y="v"
							series={[{ key: 'v', value: 'v', color: tile.color }]}
							axis={false}
							grid={false}
							rule={false}
							tooltipContext={false}
							highlight={false}
						/>
					</ChartContainer>
				</Card.Content>
			</Card.Root>
		{/each}
	{/if}
</div>

<!-- chart + on-call + SLOs -->
<div class="mb-4 grid gap-4 lg:grid-cols-3">
	<Card.Root class="lg:col-span-2">
		<Card.Header>
			<Card.Title>Deployment volume</Card.Title>
			<Card.Description
				>Successful and failed deploys per day · last {showcase.range}</Card.Description
			>
			<Card.Action class="hidden items-center gap-3 text-xs sm:flex">
				<span class="flex items-center gap-1.5"
					><span class="size-2 rounded-[2px] bg-(--chart-1)"></span>Deploys</span
				>
				<span class="flex items-center gap-1.5"
					><span class="size-2 rounded-[2px] bg-(--chart-5)"></span>Failures</span
				>
			</Card.Action>
		</Card.Header>
		<Card.Content>
			{#if !ready}
				<SuiSkeletonContainer>
					<SuiSkeleton class="h-72 w-full" />
				</SuiSkeletonContainer>
			{:else}
				<ChartContainer config={deployConfig} class="h-72 w-full">
					<AreaChart
						data={series}
						x="date"
						series={[
							{ key: 'deploys', value: 'deploys', label: 'Deploys', color: 'var(--color-deploys)' },
							{
								key: 'failures',
								value: 'failures',
								label: 'Failures',
								color: 'var(--color-failures)'
							}
						]}
					>
						<ChartTooltip labelKey="date" />
					</AreaChart>
				</ChartContainer>
			{/if}
		</Card.Content>
	</Card.Root>

	<div class="grid gap-4">
		<Card.Root>
			<Card.Header>
				<Card.Title>On-call now</Card.Title>
				<Card.Description>Follow-the-sun rotation</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-3">
				{#each ON_CALL as id (id)}
					{@const p = person(id)}
					<div class="flex items-center gap-3">
						<PersonHover {id}>
							<span><PersonAvatar {id} class="size-8" dot /></span>
						</PersonHover>
						<div class="min-w-0 flex-1">
							<div class="truncate text-sm font-medium">{p.name}</div>
							<div class="truncate text-xs text-muted-foreground">{p.role} · {p.tz}</div>
						</div>
						<SuiButton
							variant="ghost"
							size="xs"
							aria-label="Message {p.name}"
							onclick={() => toast.info(`Ping sent to ${p.name}`)}
						>
							<MessageCircleIcon class="size-4" aria-hidden="true" />
						</SuiButton>
						<SuiButton
							variant="ghost"
							size="xs"
							aria-label="Call {p.name}"
							onclick={() => toast.info(`Calling ${p.name}…`)}
						>
							<PhoneIcon class="size-4" aria-hidden="true" />
						</SuiButton>
					</div>
				{/each}
				<Separator.Root />
				<div class="flex items-center gap-2 text-xs text-muted-foreground">
					<ShieldCheckIcon class="size-3.5" aria-hidden="true" />
					Handover to APAC in 2h — Lin → Yuki
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Reliability</Card.Title>
				<Card.Description>Rolling 30-day SLOs</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				{#each SLOS as slo (slo.label)}
					<div>
						<div class="mb-1.5 flex items-baseline justify-between gap-2">
							<span class="truncate text-xs font-medium">{slo.label}</span>
							<span class="text-xs font-semibold tabular-nums">{slo.value}%</span>
						</div>
						<Progress.Root value={slo.value} class="h-1.5" aria-label="{slo.label}: {slo.value}%" />
						<div class="mt-1 text-[10px] text-muted-foreground">target {slo.target}%</div>
					</div>
				{/each}
			</Card.Content>
		</Card.Root>
	</div>
</div>

<!-- activity + releases -->
<div class="grid gap-4 lg:grid-cols-5">
	<Card.Root class="lg:col-span-2">
		<Card.Header>
			<Card.Title>Recent activity</Card.Title>
			<Card.Description>Across issues, deploys and incidents</Card.Description>
		</Card.Header>
		<Card.Content class="p-0">
			<ScrollArea.Root class="h-96 px-4 pb-4">
				<div class="space-y-1">
					{#each ACTIVITY.slice(0, 8) as a (a.id)}
						<div
							class="flex items-start gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent/50"
						>
							<PersonHover id={a.who}>
								<span><PersonAvatar id={a.who} class="size-7" /></span>
							</PersonHover>
							<div class="min-w-0 flex-1">
								<p class="text-xs leading-relaxed">
									<span class="font-medium">{person(a.who).name}</span>
									{a.action}
									<button
										class="font-medium text-foreground underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-current"
										onclick={() => toast.info(a.target)}>{a.target}</button
									>
								</p>
								<div class="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
									<Chips kind="activity" value={a.kind} />
									{a.when}
								</div>
							</div>
						</div>
					{/each}

					<Collapsible.Root bind:open={olderOpen}>
						<Collapsible.Trigger
							class="flex w-full items-center justify-center gap-1 rounded-md py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
						>
							Show {ACTIVITY.length - 8} earlier events
							<ChevronDownIcon
								class="size-3.5 transition-transform duration-200 {olderOpen ? 'rotate-180' : ''}"
								aria-hidden="true"
							/>
						</Collapsible.Trigger>
						<Collapsible.Content>
							<div class="space-y-1">
								{#each ACTIVITY.slice(8) as a (a.id)}
									<div class="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-accent/50">
										<PersonAvatar id={a.who} class="size-7" />
										<div class="min-w-0 flex-1">
											<p class="text-xs leading-relaxed">
												<span class="font-medium">{person(a.who).name}</span>
												{a.action} <span class="font-medium text-foreground">{a.target}</span>
											</p>
											<div
												class="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground"
											>
												<Chips kind="activity" value={a.kind} />
												{a.when}
											</div>
										</div>
									</div>
								{/each}
							</div>
						</Collapsible.Content>
					</Collapsible.Root>
				</div>
			</ScrollArea.Root>
		</Card.Content>
	</Card.Root>

	<Card.Root class="lg:col-span-3">
		<Card.Header class="pb-8">
			<Card.Title>Releases</Card.Title>
			<Card.Description>What shipped recently — drag or arrow through the deck</Card.Description>
			<Card.Action
				><Badge variant="outline" class="gap-1"
					><RocketIcon class="size-3" aria-hidden="true" />{RELEASES.length} releases</Badge
				></Card.Action
			>
		</Card.Header>
		<Card.Content>
			<Carousel.Root opts={{ align: 'start', loop: true }} class="w-full">
				<Carousel.Content class="-ms-4">
					{#each RELEASES as rel (rel.version)}
						<Carousel.Item class="basis-full sm:basis-1/2 xl:basis-1/2">
							<div class="h-full rounded-lg border border-border/60 p-1">
								<Card.Root class="h-full gap-0 border-0 shadow-none">
									<div class="relative">
										<AspectRatio.Root ratio={21 / 9}>
											<div
												class="absolute inset-0 flex items-end justify-between rounded-t-lg bg-gradient-to-br p-4 {rel.gradient}"
											>
												<span class="text-2xl font-bold tracking-tight text-white/95"
													>{rel.version}</span
												>
												<span
													class="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm"
													>{rel.shipped}</span
												>
											</div>
										</AspectRatio.Root>
									</div>
									<Card.Content class="p-4">
										<div class="font-semibold">{rel.name}</div>
										<ul class="mt-2 space-y-1.5">
											{#each rel.highlights.slice(0, 2) as h (h)}
												<li class="flex items-start gap-2 text-xs text-muted-foreground">
													<CheckIcon
														class="mt-0.5 size-3.5 shrink-0 text-emerald-500"
														aria-hidden="true"
													/>
													{h}
												</li>
											{/each}
										</ul>
										<SuiButton
											variant="link"
											size="xs"
											class="mt-3 px-0"
											endIcon={ArrowUpRightIcon}
											onclick={() =>
												toast.info(`Release notes — ${rel.version} ${rel.name}`, {
													description: rel.highlights.join(' · ')
												})}
										>
											Release notes
										</SuiButton>
									</Card.Content>
								</Card.Root>
							</div>
						</Carousel.Item>
					{/each}
				</Carousel.Content>
				<Carousel.Previous class="left-2" variant="outline" aria-label="Previous release" />
				<Carousel.Next class="right-2" variant="outline" aria-label="Next release" />
			</Carousel.Root>
		</Card.Content>
	</Card.Root>
</div>
