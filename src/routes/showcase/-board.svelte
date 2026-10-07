<script lang="ts">
	import * as Menubar from '$lib/components/ui/menubar/index.js';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import * as Separator from '$lib/components/ui/separator/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { SuiButton, SuiIconButton } from '$lib/sui/button/index.js';
	import { SuiInput } from '$lib/sui/input/index.js';
	import { SuiSelect } from '$lib/sui/select/index.js';
	import { SuiCombobox } from '$lib/sui/combobox/index.js';
	import { SuiMultiSelect } from '$lib/sui/multi-select/index.js';
	import { SuiCheckbox } from '$lib/sui/checkbox/index.js';
	import { toast } from 'svelte-sonner';

	import ViewHeader from './-view-header.svelte';
	import Chips from './-chips.svelte';
	import PersonStack from './-person-stack.svelte';
	import PersonHover from './-person-hover.svelte';
	import PersonAvatar from './-person-avatar.svelte';
	import EmptyState from './-empty-state.svelte';
	import NewIssueDialog from './-new-issue-dialog.svelte';
	import { showcase } from './-state.svelte';
	import {
		STATUSES,
		LABELS,
		LABEL_KEYS,
		PRIORITY_LABEL,
		PRIORITY_RANK,
		PEOPLE,
		person,
		type Issue,
		type IssueStatus,
		type LabelKey,
		type Priority
	} from './-data.svelte';

	import PlusIcon from '@lucide/svelte/icons/plus';
	import SearchIcon from '@lucide/svelte/icons/search';
	import XIcon from '@lucide/svelte/icons/x';
	import MoreHorizontalIcon from '@lucide/svelte/icons/more-horizontal';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import InboxIcon from '@lucide/svelte/icons/inbox';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import ListChecksIcon from '@lucide/svelte/icons/list-checks';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import ZapIcon from '@lucide/svelte/icons/zap';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';

	/* ------------------------------------------------------------- filters -- */
	let search = $state('');
	let priorityFilter = $state<string | undefined>(undefined);
	let labelFilter = $state<string[]>([]);
	let assigneeFilter = $state<string | undefined>(undefined);
	let sortMode = $state<'priority' | 'created' | 'points'>('priority');
	let compact = $state(false);

	const priorityItems = (Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => ({
		value: p,
		label: PRIORITY_LABEL[p]!
	}));
	const labelItems = LABEL_KEYS.map((k) => ({ value: k, label: LABELS[k]!.label }));
	const peopleItems = PEOPLE.map((p) => ({ value: p.id, label: p.name, description: p.role }));

	const filtersActive = $derived(
		search.trim().length > 0 || !!priorityFilter || labelFilter.length > 0 || !!assigneeFilter
	);

	function clearFilters() {
		search = '';
		priorityFilter = undefined;
		labelFilter = [];
		assigneeFilter = undefined;
	}

	const filtered = $derived(
		showcase.issues.filter((i) => {
			const q = search.trim().toLowerCase();
			if (q && !`${i.id} ${i.title}`.toLowerCase().includes(q)) return false;
			if (priorityFilter && i.priority !== priorityFilter) return false;
			if (labelFilter.length > 0 && !i.labels.some((l) => labelFilter.includes(l))) return false;
			if (assigneeFilter && !i.assignees.includes(assigneeFilter)) return false;
			return true;
		})
	);

	function columnIssues(status: IssueStatus): Issue[] {
		const rows = filtered.filter((i) => i.status === status);
		if (sortMode === 'priority')
			return [...rows].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
		if (sortMode === 'points') return [...rows].sort((a, b) => b.points - a.points);
		return rows;
	}

	/* ------------------------------------------------------ detail + delete -- */
	let selected = $state<Issue | undefined>(undefined);
	let deleteTarget = $state<Issue | undefined>(undefined);
	let deleteOpen = $state(false);
	let checklist = $state<boolean[]>([]);

	$effect(() => {
		if (selected)
			checklist = Array.from(
				{ length: selected.checklistTotal },
				(_, i) => i < selected!.checklistDone
			);
	});

	function openIssue(issue: Issue) {
		selected = issue;
	}

	function askDelete(issue: Issue) {
		deleteTarget = issue;
		deleteOpen = true;
	}

	function confirmDelete() {
		if (!deleteTarget) return;
		showcase.removeIssue(deleteTarget.id);
		toast.success(`${deleteTarget.id} deleted`, {
			description: 'The board recalculated immediately.'
		});
		if (selected?.id === deleteTarget.id) selected = undefined;
		deleteTarget = undefined;
	}

	function move(id: string, status: IssueStatus) {
		showcase.moveIssue(id, status);
		const issue = showcase.issues.find((i) => i.id === id);
		toast.success(`${id} → ${STATUSES.find((s) => s.key === status)!.label}`, {
			description: issue ? issue.title : undefined
		});
	}

	const statusIndexOf = (s: IssueStatus) => STATUSES.findIndex((x) => x.key === s);
</script>

<ViewHeader
	title="Delivery board"
	description="Four columns of truth — right-click any card for the fast path, or use the ⋯ menu on touch devices. Every action mutates shared state: watch the sidebar badge update live."
>
	<SuiButton startIcon={PlusIcon} onclick={() => (showcase.issueDialogOpen = true)}
		>New issue</SuiButton
	>
</ViewHeader>

<!-- toolbar: menubar + filters -->
<div class="mb-4 rounded-lg border bg-card p-2">
	<div class="flex flex-wrap items-center gap-2">
		<Menubar.Root class="rounded-md">
			<Menubar.Menu>
				<Menubar.Trigger>Board</Menubar.Trigger>
				<Menubar.Content>
					<Menubar.Item onSelect={() => (showcase.issueDialogOpen = true)}>
						<PlusIcon aria-hidden="true" />New issue<Menubar.Shortcut>C</Menubar.Shortcut>
					</Menubar.Item>
					<Menubar.Item
						onSelect={() =>
							toast.info('CSV import', {
								description: 'Drop a file with id, title, status columns.'
							})}
					>
						<UploadIcon aria-hidden="true" />Import from CSV
					</Menubar.Item>
					<Menubar.Item
						onSelect={() =>
							toast.success('Board exported', {
								description: `${showcase.issues.length} issues → board.csv`
							})}
					>
						<DownloadIcon aria-hidden="true" />Export board
					</Menubar.Item>
					<Menubar.Separator />
					<Menubar.Item inset onSelect={() => toast.success('Board is up to date')}>
						<RefreshCwIcon aria-hidden="true" />Refresh
					</Menubar.Item>
				</Menubar.Content>
			</Menubar.Menu>

			<Menubar.Menu>
				<Menubar.Trigger>Labels</Menubar.Trigger>
				<Menubar.Content>
					<Menubar.GroupHeading>Filter by label</Menubar.GroupHeading>
					{#each LABEL_KEYS as key (key)}
						<Menubar.CheckboxItem
							checked={labelFilter.includes(key)}
							onCheckedChange={(v) => {
								labelFilter = v ? [...labelFilter, key] : labelFilter.filter((l) => l !== key);
							}}
						>
							<Chips kind="label" value={key} />
						</Menubar.CheckboxItem>
					{/each}
					{#if labelFilter.length > 0}
						<Menubar.Separator />
						<Menubar.Item inset onSelect={clearFilters}
							><XIcon aria-hidden="true" />Clear label filter</Menubar.Item
						>
					{/if}
				</Menubar.Content>
			</Menubar.Menu>

			<Menubar.Menu>
				<Menubar.Trigger>Automation</Menubar.Trigger>
				<Menubar.Content>
					<Menubar.Item
						inset
						onSelect={() => toast.success('Rule enabled: auto-assign urgent to on-call')}
					>
						<ZapIcon aria-hidden="true" />Auto-assign urgent<Menubar.Shortcut>⇧A</Menubar.Shortcut>
					</Menubar.Item>
					<Menubar.Item
						inset
						onSelect={() => toast.success('Rule enabled: docs issues skip review')}
					>
						<ZapIcon aria-hidden="true" />Docs skip review<Menubar.Shortcut>⇧P</Menubar.Shortcut>
					</Menubar.Item>
					<Menubar.Separator />
					<Menubar.Item disabled inset>Manage rules…</Menubar.Item>
				</Menubar.Content>
			</Menubar.Menu>

			<Menubar.Menu>
				<Menubar.Trigger>View</Menubar.Trigger>
				<Menubar.Content>
					<Menubar.GroupHeading>Sort by</Menubar.GroupHeading>
					<Menubar.RadioGroup
						value={sortMode}
						onValueChange={(v) => (sortMode = v as typeof sortMode)}
					>
						<Menubar.RadioItem value="priority" inset>Priority</Menubar.RadioItem>
						<Menubar.RadioItem value="created" inset>Recently added</Menubar.RadioItem>
						<Menubar.RadioItem value="points" inset>Story points</Menubar.RadioItem>
					</Menubar.RadioGroup>
					<Menubar.Separator />
					<Menubar.CheckboxItem checked={compact} onCheckedChange={(v) => (compact = !!v)}>
						Compact cards
					</Menubar.CheckboxItem>
				</Menubar.Content>
			</Menubar.Menu>

			<Menubar.Menu>
				<Menubar.Trigger>Help</Menubar.Trigger>
				<Menubar.Content>
					<Menubar.Item inset onSelect={() => (showcase.commandOpen = true)}>
						<SearchIcon aria-hidden="true" />Command palette<Menubar.Shortcut>⌘K</Menubar.Shortcut>
					</Menubar.Item>
					<Menubar.Item
						inset
						onSelect={() =>
							toast.info('Runbook — cache purge', {
								description: 'wiki/nimbus/runbooks/purge-queue'
							})}
					>
						<BookOpenIcon aria-hidden="true" />Open runbook
					</Menubar.Item>
				</Menubar.Content>
			</Menubar.Menu>
		</Menubar.Root>

		<div class="ms-auto flex flex-1 flex-wrap items-center gap-2">
			<SuiInput
				size="sm"
				class="w-full sm:w-48"
				startIcon={SearchIcon}
				placeholder="Search issues…"
				aria-label="Search issues"
				bind:value={search}
			/>
			<SuiSelect
				size="sm"
				class="w-full sm:w-36"
				placeholder="Priority"
				items={priorityItems}
				clearable
				bind:value={priorityFilter}
			/>
			<SuiMultiSelect
				size="sm"
				class="w-full sm:w-44"
				placeholder="Labels"
				items={labelItems}
				bind:value={labelFilter}
				clearable
				maxDisplay={1}
			/>
			<SuiCombobox
				size="sm"
				class="w-full sm:w-44"
				placeholder="Assignee"
				searchPlaceholder="Search people…"
				items={peopleItems}
				clearable
				bind:value={assigneeFilter}
			/>
			{#if filtersActive}
				<SuiButton size="sm" variant="ghost" startIcon={XIcon} onclick={clearFilters}
					>Clear</SuiButton
				>
			{/if}
		</div>
	</div>
</div>

<!-- board -->
<div class="flex snap-x gap-4 overflow-x-auto pb-4 xl:grid xl:grid-cols-4 xl:overflow-visible">
	{#each STATUSES as status (status.key)}
		<section
			class="flex w-[19rem] shrink-0 snap-start flex-col rounded-lg bg-muted/40 p-2 md:w-72 xl:w-auto"
		>
			<header class="mb-2 flex items-center gap-2 px-1 pt-1">
				<span class="size-2 rounded-full {status.dot}" aria-hidden="true"></span>
				<h2 class="text-sm font-semibold">{status.label}</h2>
				<Badge variant="secondary" class="tabular-nums">{columnIssues(status.key).length}</Badge>
				<div class="ms-auto">
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							{#snippet child({ props })}
								<SuiIconButton
									icon={MoreHorizontalIcon}
									label="Column options"
									size="xs"
									variant="ghost"
									{...props}
								/>
							{/snippet}
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="end" class="w-44">
							<DropdownMenu.GroupHeading>Sort by</DropdownMenu.GroupHeading>
							<DropdownMenu.RadioGroup
								value={sortMode}
								onValueChange={(v) => (sortMode = v as typeof sortMode)}
							>
								<DropdownMenu.RadioItem value="priority">Priority</DropdownMenu.RadioItem>
								<DropdownMenu.RadioItem value="created">Recently added</DropdownMenu.RadioItem>
								<DropdownMenu.RadioItem value="points">Story points</DropdownMenu.RadioItem>
							</DropdownMenu.RadioGroup>
							<DropdownMenu.Separator />
							<DropdownMenu.Item inset onclick={() => (showcase.issueDialogOpen = true)}
								>Add card…</DropdownMenu.Item
							>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</div>
			</header>

			<div class="min-h-24 space-y-2">
				{#each columnIssues(status.key) as issue (issue.id)}
					<ContextMenu.Root>
						<ContextMenu.Trigger class="block">
							<div
								class="group relative cursor-pointer rounded-lg border bg-card p-3 shadow-xs transition-all hover:shadow-md {compact
									? 'py-2'
									: ''}"
							>
								<button
									class="absolute inset-0 rounded-lg"
									aria-label="Open {issue.id}: {issue.title}"
									onclick={() => openIssue(issue)}
								></button>

								<div class="pointer-events-none relative">
									<div class="flex items-start justify-between gap-2">
										<p class="text-sm leading-snug font-medium">{issue.title}</p>
									</div>
									{#if !compact}
										<div class="mt-2 flex flex-wrap gap-1">
											{#each issue.labels as key (key)}
												<Chips kind="label" value={key} />
											{/each}
										</div>
									{/if}
									<div class="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground">
										<span class="font-mono text-[10px]">{issue.id}</span>
										<Chips kind="priority" value={issue.priority} />
										{#if issue.comments > 0}
											<span class="inline-flex items-center gap-1"
												><MessageSquareIcon
													class="size-3"
													aria-hidden="true"
												/>{issue.comments}</span
											>
										{/if}
										{#if issue.checklistTotal > 0}
											<span class="inline-flex items-center gap-1"
												><ListChecksIcon
													class="size-3"
													aria-hidden="true"
												/>{issue.checklistDone}/{issue.checklistTotal}</span
											>
										{/if}
									</div>
									<div class="mt-2.5 flex items-center justify-between">
										<PersonStack ids={issue.assignees} max={3} />
										<Badge variant="outline" class="tabular-nums">{issue.points}</Badge>
									</div>
								</div>

								<div
									class="absolute top-1.5 right-1.5 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
								>
									<DropdownMenu.Root>
										<DropdownMenu.Trigger>
											{#snippet child({ props })}
												<SuiIconButton
													icon={MoreHorizontalIcon}
													label="Card actions"
													size="xs"
													variant="ghost"
													{...props}
												/>
											{/snippet}
										</DropdownMenu.Trigger>
										<DropdownMenu.Content align="end" class="w-48">
											<DropdownMenu.GroupHeading>Move to</DropdownMenu.GroupHeading>
											{#each STATUSES as target (target.key)}
												{#if target.key !== issue.status}
													<DropdownMenu.Item inset onclick={() => move(issue.id, target.key)}>
														{target.label}
													</DropdownMenu.Item>
												{/if}
											{/each}
											<DropdownMenu.Separator />
											<DropdownMenu.Item
												inset
												onclick={() => {
													showcase.duplicateIssue(issue.id);
													toast.success(`${issue.id} duplicated`);
												}}
											>
												Duplicate
											</DropdownMenu.Item>
											<DropdownMenu.Item
												inset
												onclick={() => toast.info('Copied', { description: issue.id })}
											>
												Copy ID<DropdownMenu.Shortcut>⌘C</DropdownMenu.Shortcut>
											</DropdownMenu.Item>
											<DropdownMenu.Separator />
											<DropdownMenu.Item
												variant="destructive"
												inset
												onclick={() => askDelete(issue)}
											>
												Delete
											</DropdownMenu.Item>
										</DropdownMenu.Content>
									</DropdownMenu.Root>
								</div>
							</div>
						</ContextMenu.Trigger>

						<ContextMenu.Content class="w-52">
							<ContextMenu.GroupHeading>Move to</ContextMenu.GroupHeading>
							{#each STATUSES as target (target.key)}
								{#if target.key !== issue.status}
									<ContextMenu.Item inset onclick={() => move(issue.id, target.key)}>
										{target.label}
										{#if statusIndexOf(target.key) === statusIndexOf(issue.status) + 1}
											<ContextMenu.Shortcut>→</ContextMenu.Shortcut>
										{/if}
									</ContextMenu.Item>
								{/if}
							{/each}
							<ContextMenu.Separator />
							<ContextMenu.Item inset onclick={() => openIssue(issue)}
								>Open details</ContextMenu.Item
							>
							<ContextMenu.Item
								inset
								onclick={() => {
									showcase.duplicateIssue(issue.id);
									toast.success(`${issue.id} duplicated`);
								}}
							>
								Duplicate
							</ContextMenu.Item>
							<ContextMenu.Item
								inset
								onclick={() => toast.info('Copied', { description: issue.id })}
							>
								Copy ID<ContextMenu.Shortcut>⌘C</ContextMenu.Shortcut>
							</ContextMenu.Item>
							<ContextMenu.Separator />
							<ContextMenu.Item variant="destructive" inset onclick={() => askDelete(issue)}>
								<Trash2Icon aria-hidden="true" />Delete
							</ContextMenu.Item>
						</ContextMenu.Content>
					</ContextMenu.Root>
				{:else}
					<div
						class="flex h-24 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground"
					>
						{#if filtersActive}
							No matches — <button class="underline underline-offset-2" onclick={clearFilters}
								>clear filters</button
							>
						{:else}
							Nothing here yet
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{/each}
</div>

<!-- issue detail sheet -->
<Sheet.Root
	open={!!selected}
	onOpenChange={(o) => {
		if (!o) selected = undefined;
	}}
>
	<Sheet.Content side="right" class="w-full gap-0 overflow-y-auto sm:max-w-md">
		{#if selected}
			{@const current = selected!}
			{@const issue = showcase.issues.find((i) => i.id === current.id) ?? current}
			<Sheet.Header class="pb-0">
				<Sheet.Title class="flex flex-wrap items-center gap-2">
					<span class="font-mono text-xs font-normal text-muted-foreground">{issue.id}</span>
					<Chips kind="label" value={issue.labels[0] ?? 'chore'} />
				</Sheet.Title>
				<Sheet.Description class="text-base font-semibold whitespace-normal text-foreground"
					>{issue.title}</Sheet.Description
				>
			</Sheet.Header>
			<div class="space-y-5 p-4">
				<p class="text-sm leading-relaxed text-muted-foreground">{issue.description}</p>

				<div class="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm">
					<div>
						<div class="text-xs text-muted-foreground">Priority</div>
						<Chips kind="priority" value={issue.priority} />
					</div>
					<div>
						<div class="text-xs text-muted-foreground">Points</div>
						<span class="font-semibold tabular-nums">{issue.points}</span>
					</div>
					<div>
						<div class="text-xs text-muted-foreground">Created</div>
						<span>{issue.createdAgo}</span>
					</div>
					<div>
						<div class="text-xs text-muted-foreground">Comments</div>
						<span class="tabular-nums">{issue.comments}</span>
					</div>
				</div>

				<div>
					<h3 class="mb-2 text-xs font-semibold">Assignees</h3>
					{#if issue.assignees.length}
						<div class="flex flex-wrap gap-2">
							{#each issue.assignees as pid (pid)}
								<PersonHover id={pid}>
									<span
										class="flex items-center gap-2 rounded-full border bg-card py-0.5 ps-0.5 pe-3 transition-colors hover:bg-accent"
									>
										<PersonAvatar id={pid} class="size-6" />
										<span class="text-xs font-medium">{person(pid).name}</span>
									</span>
								</PersonHover>
							{/each}
						</div>
					{:else}
						<p class="text-xs text-muted-foreground">Unassigned</p>
					{/if}
				</div>

				{#if issue.checklistTotal > 0}
					<div>
						<h3 class="mb-2 text-xs font-semibold">
							Checklist — {checklist.filter(Boolean).length}/{issue.checklistTotal}
						</h3>
						<div class="space-y-1">
							{#each checklist as done, idx (idx)}
								<SuiCheckbox
									size="sm"
									checked={done}
									onchange={(e) => {
										const next = [...checklist];
										next[idx] = (e.currentTarget as HTMLInputElement).checked;
										checklist = next;
									}}
									label={`Step ${idx + 1}`}
								/>
							{/each}
						</div>
					</div>
				{/if}

				<Separator.Root />

				<div>
					<h3 class="mb-2 text-xs font-semibold">Move to</h3>
					<div class="flex flex-wrap gap-2">
						{#each STATUSES as target (target.key)}
							<SuiButton
								size="sm"
								variant={target.key === issue.status ? 'secondary' : 'outline'}
								endIcon={target.key === issue.status ? undefined : ArrowRightIcon}
								onclick={() => move(issue.id, target.key)}
							>
								{target.label}
							</SuiButton>
						{/each}
					</div>
				</div>
			</div>
			<Sheet.Footer class="mt-auto flex-row justify-between">
				<SuiButton variant="destructive" startIcon={Trash2Icon} onclick={() => askDelete(issue)}
					>Delete</SuiButton
				>
				<Sheet.Close>
					{#snippet child({ props })}
						<SuiButton variant="ghost" {...props}>Close</SuiButton>
					{/snippet}
				</Sheet.Close>
			</Sheet.Footer>
		{/if}
	</Sheet.Content>
</Sheet.Root>

<!-- delete confirmation -->
<AlertDialog.Root bind:open={deleteOpen} onOpenChange={(o) => !o && (deleteTarget = undefined)}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete {deleteTarget?.id}?</AlertDialog.Title>
			<AlertDialog.Description>
				This removes “{deleteTarget?.title}” from the board. There is no undo — the mutation is
				immediate and shared everywhere.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Keep it</AlertDialog.Cancel>
			<AlertDialog.Action onclick={confirmDelete}>Delete issue</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- empty board fallback -->
{#if showcase.issues.length === 0}
	<div class="mt-8">
		<EmptyState
			icon={InboxIcon}
			title="The board is empty"
			description="Every issue was moved or deleted. File a new one to get the party started."
		>
			<SuiButton startIcon={PlusIcon} onclick={() => (showcase.issueDialogOpen = true)}
				>New issue</SuiButton
			>
		</EmptyState>
	</div>
{/if}

<NewIssueDialog />
