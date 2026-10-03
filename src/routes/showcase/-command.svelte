<script lang="ts">
	import * as Command from '$lib/components/ui/command/index.js';
	import { toast } from 'svelte-sonner';
	import { showcase, type ViewKey } from './-state.svelte';
	import { theme } from '$lib/demo/theme.svelte';
	import { PEOPLE, SERVICES, type Person, type Issue } from './-data.svelte';
	import Kbd from './-kbd.svelte';
	import PersonAvatar from './-person-avatar.svelte';

	import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard';
	import KanbanSquareIcon from '@lucide/svelte/icons/kanban-square';
	import RocketIcon from '@lucide/svelte/icons/rocket';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import CloudUploadIcon from '@lucide/svelte/icons/cloud-upload';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import BellOffIcon from '@lucide/svelte/icons/bell-off';
	import CircleDotIcon from '@lucide/svelte/icons/circle-dot';
	import ServerIcon from '@lucide/svelte/icons/server';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	const NAV: { key: ViewKey; label: string; icon: typeof RocketIcon; hint: string }[] = [
		{ key: 'overview', label: 'Overview', icon: LayoutDashboardIcon, hint: '1' },
		{ key: 'board', label: 'Board', icon: KanbanSquareIcon, hint: '2' },
		{ key: 'deployments', label: 'Deployments', icon: RocketIcon, hint: '3' },
		{ key: 'schedule', label: 'Schedule', icon: CalendarDaysIcon, hint: '4' },
		{ key: 'settings', label: 'Settings', icon: SettingsIcon, hint: '5' }
	];

	/* -------- simulated async search (people, issues, services) ---------- */
	let term = $state('');
	let searching = $state(false);
	type Result = { kind: 'person' | 'issue' | 'service'; id: string; label: string; hint: string };
	let results = $state<Result[]>([]);
	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		const q = term.trim().toLowerCase();
		clearTimeout(timer);
		if (q.length < 2) {
			searching = false;
			results = [];
			return;
		}
		searching = true;
		timer = setTimeout(() => {
			results = [
				...PEOPLE.filter((p: Person) => p.name.toLowerCase().includes(q)).map((p) => ({
					kind: 'person' as const,
					id: p.id,
					label: p.name,
					hint: p.role
				})),
				...showcase.issues
					.filter((i: Issue) => i.title.toLowerCase().includes(q) || i.id.toLowerCase().includes(q))
					.map((i) => ({ kind: 'issue' as const, id: i.id, label: i.title, hint: i.id })),
				...SERVICES.filter((s) => s.toLowerCase().includes(q)).map((s) => ({
					kind: 'service' as const,
					id: s,
					label: s,
					hint: 'service'
				}))
			].slice(0, 7);
			searching = false;
		}, 550);
		return () => clearTimeout(timer);
	});

	function runResult(r: Result) {
		if (r.kind === 'person') {
			toast.info(`${r.label} — ${r.hint}`, { description: 'Profile cards open from avatars across the app.' });
		} else if (r.kind === 'issue') {
			showcase.view = 'board';
			toast.success(`Board filtered down to ${r.id}`, { description: r.label });
		} else {
			showcase.view = 'deployments';
			toast.success(`Deployment history for ${r.label}`, { description: 'The table is fully searchable — try it there too.' });
		}
		open = false;
	}

	function nav(key: ViewKey) {
		showcase.view = key;
		open = false;
	}
</script>

<Command.Dialog
	bind:open
	title="Command palette"
	description="Search for a command to run — navigation, actions, people, issues and services."
>
	<Command.Input bind:value={term} placeholder="Type a command or search…" />
	<Command.List>
		{#if searching}
			<Command.Loading
				progress={64}
				class="bg-foreground/15 mx-2 mb-1 h-0.5 origin-left rounded-full transition-transform duration-500"
				style="transform: scaleX(0.64)"
			/>
		{/if}
		<Command.Empty>No results for “{term}”.</Command.Empty>

		<Command.Group heading="Navigation">
			{#each NAV as item (item.key)}
				<Command.Item value={`go to ${item.label}`} onSelect={() => nav(item.key)}>
					<item.icon aria-hidden="true" />
					<span>{item.label}</span>
					<Command.Shortcut><Kbd>{item.hint}</Kbd></Command.Shortcut>
				</Command.Item>
			{/each}
		</Command.Group>

		<Command.Group heading="Actions">
			<Command.Item
				value="new issue create ticket"
				onSelect={() => {
					showcase.view = 'board';
					showcase.issueDialogOpen = true;
					open = false;
				}}
			>
				<PlusIcon aria-hidden="true" />
				<span>New issue</span>
				<Command.Shortcut><Kbd>C</Kbd></Command.Shortcut>
			</Command.Item>
			<Command.Item
				value="deploy trigger deployment"
				onSelect={() => {
					showcase.view = 'deployments';
					showcase.deployDialogOpen = true;
					open = false;
				}}
			>
				<CloudUploadIcon aria-hidden="true" />
				<span>Trigger a deployment…</span>
				<Command.Shortcut><Kbd>D</Kbd></Command.Shortcut>
			</Command.Item>
			<Command.Item value="toggle theme dark light" onSelect={() => theme.toggle()}>
				{#if theme.dark}
					<SunIcon aria-hidden="true" />
					<span>Switch to light theme</span>
				{:else}
					<MoonIcon aria-hidden="true" />
					<span>Switch to dark theme</span>
				{/if}
			</Command.Item>
			<Command.Item
				value="mark notifications read"
				onSelect={() => {
					showcase.notificationsRead = true;
					toast.success('All notifications marked as read');
				}}
			>
				<BellOffIcon aria-hidden="true" />
				<span>Mark notifications read</span>
			</Command.Item>
		</Command.Group>

		{#if term.trim().length >= 2}
			<Command.Group heading={`Results for “${term.trim()}”`}>
				{#if results.length === 0 && !searching}
					<Command.Item disabled value="no-results">
						<CircleDotIcon aria-hidden="true" />
						<span>Nothing matched — try a person, issue or service</span>
					</Command.Item>
				{/if}
				{#each results as r (r.kind + r.id)}
					<Command.Item value={`${r.label} ${r.hint}`} onSelect={() => runResult(r)}>
						{#if r.kind === 'person'}
							<PersonAvatar id={r.id} class="size-4" />
						{:else if r.kind === 'issue'}
							<CircleDotIcon aria-hidden="true" />
						{:else}
							<ServerIcon aria-hidden="true" />
						{/if}
						<span class="truncate">{r.label}</span>
						<span class="text-muted-foreground ml-auto text-xs">{r.hint}</span>
					</Command.Item>
				{/each}
			</Command.Group>
		{/if}

		<Command.Separator />

		<Command.Group heading="Component demos">
			<Command.LinkItem href="/selection" value="selection demo combobox multiselect">
				<BookOpenIcon aria-hidden="true" />
				<span>Selection — combobox, multi-select, infinite scroll</span>
				<ArrowRightIcon class="ml-auto" aria-hidden="true" />
			</Command.LinkItem>
			<Command.LinkItem href="/data-table" value="data table demo virtual">
				<BookOpenIcon aria-hidden="true" />
				<span>Data table — virtualized, 10k rows</span>
				<ArrowRightIcon class="ml-auto" aria-hidden="true" />
			</Command.LinkItem>
			<Command.LinkItem href="/validation" value="validation demo zod">
				<BookOpenIcon aria-hidden="true" />
				<span>Validation — zod v4 timing demo</span>
				<ArrowRightIcon class="ml-auto" aria-hidden="true" />
			</Command.LinkItem>
		</Command.Group>
	</Command.List>
</Command.Dialog>
