<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Calendar from '$lib/components/ui/calendar/index.js';
	import { RangeCalendar } from '$lib/components/ui/range-calendar/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { SuiInput } from '$lib/sui/input/index.js';
	import { SuiSelect } from '$lib/sui/select/index.js';
	import { SuiButton, SuiIconButton } from '$lib/sui/button/index.js';
	import { toast } from 'svelte-sonner';
	import { TODAY, EVENT_KINDS, type CalEvent, type EventKind } from './-data.svelte';
	import { getLocalTimeZone, type DateValue } from '@internationalized/date';

	import ViewHeader from './-view-header.svelte';
	import Chips from './-chips.svelte';
	import PersonStack from './-person-stack.svelte';
	import EmptyState from './-empty-state.svelte';
	import { showcase } from './-state.svelte';

	import CalendarPlusIcon from '@lucide/svelte/icons/calendar-plus';
	import CalendarClockIcon from '@lucide/svelte/icons/calendar-clock';
	import VideoIcon from '@lucide/svelte/icons/video';
	import MapPinIcon from '@lucide/svelte/icons/map-pin';
	import MoreHorizontalIcon from '@lucide/svelte/icons/more-horizontal';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import CalendarSearchIcon from '@lucide/svelte/icons/calendar-search';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import CheckIcon from '@lucide/svelte/icons/check';

	const fmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
	const fmtShort = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
	const tz = getLocalTimeZone();

	/* ------------------------------------------------------------ selection -- */
	let selected = $state<DateValue | undefined>(TODAY);
	let jumpOpen = $state(false);
	let placeholder = $state<DateValue | undefined>(TODAY);

	const eventsOn = $derived.by(() => {
		const map = new Map<string, CalEvent[]>();
		for (const e of showcase.events) {
			const key = TODAY.add({ days: e.dayOffset }).toString();
			map.set(key, [...(map.get(key) ?? []), e]);
		}
		return map;
	});

	const selectedKey = $derived(selected?.toString() ?? TODAY.toString());
	const agenda = $derived(
		(eventsOn.get(selectedKey) ?? []).sort((a, b) => a.start.localeCompare(b.start))
	);
	const weekCount = $derived(
		showcase.events.filter((e) => e.dayOffset >= 0 && e.dayOffset <= 7).length
	);

	function isToday(d: DateValue) {
		return d.compare(TODAY) === 0;
	}
	function dayChip(d: DateValue | undefined): string {
		if (!d) return '';
		const diff = d.compare(TODAY);
		if (diff === 0) return 'Today';
		if (diff === 1) return 'Tomorrow';
		if (diff === -1) return 'Yesterday';
		return '';
	}

	/* ------------------------------------------------------- quick add event -- */
	let eventDialogOpen = $state(false);
	let evTitle = $state('');
	let evKind = $state<string | undefined>('standup');
	let evTime = $state('10:00');
	let evLength = $state<string>('30');
	let deleteEventTarget = $state<CalEvent | undefined>(undefined);
	let deleteEventOpen = $state(false);

	const kindItems = (Object.keys(EVENT_KINDS) as EventKind[]).map((k) => ({
		value: k,
		label: EVENT_KINDS[k]!.label
	}));
	const lengthItems = [15, 30, 45, 60, 90].map((m) => ({
		value: String(m),
		label: `${m} minutes`
	}));

	function addEvent() {
		if (!selected) return;
		const dayOffset = selected.compare(TODAY);
		showcase.addEvent({
			title: evTitle.trim() || 'Untitled event',
			kind: (evKind ?? 'standup') as EventKind,
			dayOffset,
			start: evTime,
			minutes: Number(evLength),
			people: ['ada']
		});
		toast.success(`“${evTitle.trim() || 'Untitled event'}” scheduled`, {
			description: `${selected ? fmt.format(selected.toDate(tz)) : ''} · ${evTime} · ${evLength} min`
		});
		evTitle = '';
		evKind = 'standup';
		evTime = '10:00';
		evLength = '30';
		eventDialogOpen = false;
	}

	function endTime(e: CalEvent): string {
		const [h, m] = e.start.split(':').map(Number);
		const total = (h ?? 0) * 60 + (m ?? 0) + e.minutes;
		const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
		const mm = String(total % 60).padStart(2, '0');
		return `${hh}:${mm}`;
	}

	function confirmDeleteEvent() {
		if (!deleteEventTarget) return;
		showcase.removeEvent(deleteEventTarget.id);
		toast.success(`“${deleteEventTarget.title}” removed from the calendar`);
		deleteEventTarget = undefined;
	}

	/* ------------------------------------------------------- on-call coverage -- */
	let coverage = $state<{ start: DateValue | undefined; end: DateValue | undefined }>({
		start: undefined,
		end: undefined
	});
	const nights = $derived(
		coverage.start && coverage.end ? Math.max(1, coverage.end.compare(coverage.start) + 1) : 0
	);
</script>

<ViewHeader
	title="Schedule"
	description="Shared team calendar with an on-call coverage planner. Days with events carry colored dots; pick a day to read its agenda."
>
	<SuiButton size="sm" startIcon={CalendarPlusIcon} onclick={() => (eventDialogOpen = true)}>
		Schedule event
	</SuiButton>
</ViewHeader>

<div class="grid gap-4 lg:grid-cols-[22rem_1fr]">
	<!-- calendar + jump -->
	<div class="grid content-start gap-4">
		<Card.Root>
			<Card.Header>
				<Card.Title>Team calendar</Card.Title>
				<Card.Description>{weekCount} events in the next 7 days</Card.Description>
			</Card.Header>
			<Card.Content>
				<Calendar.Calendar
					type="single"
					bind:value={selected}
					bind:placeholder
					captionLayout="dropdown"
					class="p-0"
				>
					{#snippet day({ day: d, outsideMonth })}
						<Calendar.Day class="flex size-8 flex-col items-center justify-center gap-0.5">
							<span class="text-xs">{d.day}</span>
							{#if !outsideMonth && eventsOn.get(d.toString())?.length}
								<span class="flex gap-0.5">
									{#each [...new Set(eventsOn
												.get(d.toString())!
												.map((e) => e.kind))].slice(0, 3) as k (k)}
										<span class="size-1 rounded-full {EVENT_KINDS[k]!.dot}"></span>
									{/each}
								</span>
							{/if}
						</Calendar.Day>
					{/snippet}
				</Calendar.Calendar>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="pb-3">
				<Card.Title class="flex items-center gap-2 text-sm">
					<CalendarSearchIcon class="size-4" aria-hidden="true" />
					Jump to date
				</Card.Title>
			</Card.Header>
			<Card.Content>
				<Popover.Root bind:open={jumpOpen}>
					<Popover.Trigger>
						{#snippet child({ props })}
							<Button variant="outline" class="w-full justify-start font-normal" {...props}>
								{selected ? fmt.format(selected.toDate(tz)) : 'Pick a date'}
							</Button>
						{/snippet}
					</Popover.Trigger>
					<Popover.Content align="start" class="w-auto p-0">
						<Calendar.Calendar
							type="single"
							bind:value={selected}
							bind:placeholder
							onValueChange={() => (jumpOpen = false)}
						/>
					</Popover.Content>
				</Popover.Root>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- agenda -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex flex-wrap items-center gap-2">
				{selected ? fmt.format(selected.toDate(tz)) : 'Pick a day'}
				{#if dayChip(selected)}
					<Badge variant="secondary">{dayChip(selected)}</Badge>
				{/if}
			</Card.Title>
			<Card.Description
				>{agenda.length} events · {agenda.reduce((s, e) => s + e.minutes, 0)} minutes booked</Card.Description
			>
			<Card.Action>
				<SuiButton
					size="sm"
					variant="outline"
					startIcon={CalendarPlusIcon}
					onclick={() => (eventDialogOpen = true)}
				>
					Add
				</SuiButton>
			</Card.Action>
		</Card.Header>
		<Card.Content>
			{#if agenda.length === 0}
				<EmptyState
					icon={CalendarClockIcon}
					title="Nothing scheduled"
					description="A rare and beautiful sight. Use it for deep work — or schedule something."
				>
					<SuiButton size="sm" variant="outline" onclick={() => (eventDialogOpen = true)}
						>Schedule event</SuiButton
					>
				</EmptyState>
			{:else}
				<ol
					class="relative space-y-3 before:absolute before:inset-y-1 before:left-[4.4rem] before:w-px before:bg-border"
				>
					{#each agenda as e (e.id)}
						<li class="flex gap-4">
							<div class="w-14 pt-0.5 text-right text-xs tabular-nums">
								{e.start}<br />
								<span class="text-muted-foreground">{endTime(e)}</span>
							</div>
							<span
								class="relative z-10 mt-1.5 flex size-2.5 shrink-0 rounded-full bg-background {EVENT_KINDS[
									e.kind
								]!.dot} ring-2"
							></span>
							<div class="flex-1 rounded-lg border p-3">
								<div class="flex flex-wrap items-center gap-2">
									<span class="text-sm font-medium">{e.title}</span>
									<Chips kind="event" value={e.kind} />
									<div class="ms-auto">
										<DropdownMenu.Root>
											<DropdownMenu.Trigger>
												{#snippet child({ props })}
													<SuiIconButton
														icon={MoreHorizontalIcon}
														label={`Options for ${e.title}`}
														size="xs"
														variant="ghost"
														{...props}
													/>
												{/snippet}
											</DropdownMenu.Trigger>
											<DropdownMenu.Content align="end" class="w-40">
												<DropdownMenu.Item
													inset
													onclick={() =>
														toast.info(`“${e.title}” details`, {
															description: `${e.start}–${endTime(e)} · ${e.minutes} min`
														})}
												>
													Details
												</DropdownMenu.Item>
												<DropdownMenu.Item
													variant="destructive"
													inset
													onclick={() => {
														deleteEventTarget = e;
														deleteEventOpen = true;
													}}
												>
													<Trash2Icon aria-hidden="true" />Delete
												</DropdownMenu.Item>
											</DropdownMenu.Content>
										</DropdownMenu.Root>
									</div>
								</div>
								<div class="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
									<PersonStack ids={e.people} max={4} />
									{#if e.location}
										<span class="inline-flex items-center gap-1"
											><MapPinIcon class="size-3" aria-hidden="true" />{e.location}</span
										>
									{:else}
										<span class="inline-flex items-center gap-1"
											><VideoIcon class="size-3" aria-hidden="true" />huddle.link/nimbus</span
										>
									{/if}
									<SuiButton
										size="xs"
										variant="link"
										class="ms-auto px-0"
										onclick={() =>
											toast.success(`Joined “${e.title}”`, {
												description: 'Camera off, mic ready — do not disturb.'
											})}
									>
										Join
									</SuiButton>
								</div>
							</div>
						</li>
					{/each}
				</ol>
			{/if}
		</Card.Content>
	</Card.Root>
</div>

<!-- on-call coverage planner -->
<Card.Root class="mt-4">
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<MoonIcon class="size-4" aria-hidden="true" />
			On-call coverage pause
		</Card.Title>
		<Card.Description>
			Planning a change freeze? Drag across a range to pick the pause window — responders see it the
			moment you confirm.
		</Card.Description>
		<Card.Action>
			<SuiButton
				size="sm"
				disabled={nights === 0}
				startIcon={CheckIcon}
				onclick={() =>
					toast.success(`Coverage pause booked — ${nights} night${nights === 1 ? '' : 's'}`, {
						description: 'Runbooks will page the backup rotation.'
					})}
			>
				Confirm pause
			</SuiButton>
		</Card.Action>
	</Card.Header>
	<Card.Content class="flex flex-col gap-4 sm:flex-row sm:items-start">
		<RangeCalendar
			bind:value={coverage}
			bind:placeholder
			captionLayout="dropdown"
			class="rounded-lg border p-3"
		/>
		<div class="space-y-3 text-sm">
			<div class="rounded-lg border p-3">
				<div class="text-xs text-muted-foreground">Selected window</div>
				<div class="mt-1 font-medium">
					{coverage.start ? fmtShort.format(coverage.start.toDate(tz)) : '—'}
					→
					{coverage.end ? fmtShort.format(coverage.end.toDate(tz)) : '—'}
				</div>
				{#if nights > 0}
					<div class="mt-1 text-xs text-muted-foreground">
						{nights} night{nights === 1 ? '' : 's'} · pages route to the backup rotation
					</div>
				{/if}
			</div>
			<ul class="list-outside list-disc space-y-1 pl-4 text-xs text-muted-foreground">
				<li>Freeze windows suppress non-urgent pages</li>
				<li>Incident severity 1 still breaks through</li>
				<li>The calendar dots update for everyone instantly</li>
			</ul>
		</div>
	</Card.Content>
</Card.Root>

<!-- schedule event dialog -->
<Dialog.Root bind:open={eventDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Schedule an event</Dialog.Title>
			<Dialog.Description>
				Lands on {selected ? fmt.format(selected.toDate(tz)) : 'the selected day'} — watch the colored
				dot appear on the calendar.
			</Dialog.Description>
		</Dialog.Header>
		<form
			class="mt-2 grid gap-4"
			onsubmit={(e) => {
				e.preventDefault();
				addEvent();
			}}
		>
			<SuiInput
				id="sc-ev-title"
				label="Title"
				placeholder="Canary metrics review"
				bind:value={evTitle}
				required
			/>
			<div class="grid grid-cols-2 gap-4">
				<SuiSelect id="sc-ev-kind" label="Kind" items={kindItems} bind:value={evKind} />
				<SuiSelect id="sc-ev-len" label="Length" items={lengthItems} bind:value={evLength} />
			</div>
			<SuiInput id="sc-ev-time" label="Start time" type="time" bind:value={evTime} required />
			<Dialog.Footer>
				<SuiButton variant="ghost" type="button" onclick={() => (eventDialogOpen = false)}
					>Cancel</SuiButton
				>
				<SuiButton type="submit" startIcon={CalendarPlusIcon}>Add to calendar</SuiButton>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- delete event confirm -->
<AlertDialog.Root
	bind:open={deleteEventOpen}
	onOpenChange={(o) => !o && (deleteEventTarget = undefined)}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete “{deleteEventTarget?.title}”?</AlertDialog.Title>
			<AlertDialog.Description>
				Attendees will get a cancellation note. This cannot be undone from the demo (but you can
				schedule it again).
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Keep it</AlertDialog.Cancel>
			<AlertDialog.Action onclick={confirmDeleteEvent}>Delete event</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
