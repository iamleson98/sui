<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import * as Separator from '$lib/components/ui/separator/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as ScrollArea from '$lib/components/ui/scroll-area/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import { toast } from 'svelte-sonner';

	import Seo from '$lib/demo/seo.svelte';
	import { theme } from '$lib/demo/theme.svelte';
	import { SuiButton, SuiIconButton } from '$lib/sui/button/index.js';

	import CommandPalette from './-command.svelte';
	import Overview from './-overview.svelte';
	import PersonAvatar from './-person-avatar.svelte';
	import Chips from './-chips.svelte';
	import Kbd from './-kbd.svelte';
	import { SuiSkeleton, SuiSkeletonContainer } from '$lib/sui/skeleton/index.js';
	import { showcase, type ViewKey } from './-state.svelte';
	import { ACTIVITY, person } from './-data.svelte';
	import type { Component } from 'svelte';

	import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard';
	import KanbanSquareIcon from '@lucide/svelte/icons/kanban-square';
	import RocketIcon from '@lucide/svelte/icons/rocket';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import TableIcon from '@lucide/svelte/icons/table';
	import ListChecksIcon from '@lucide/svelte/icons/list-checks';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import SearchIcon from '@lucide/svelte/icons/search';
	import BellIcon from '@lucide/svelte/icons/bell';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import CheckIcon from '@lucide/svelte/icons/check';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import CreditCardIcon from '@lucide/svelte/icons/credit-card';
	import UserIcon from '@lucide/svelte/icons/user';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import CommandIcon from '@lucide/svelte/icons/command';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';

	const NAV: {
		group: string;
		items: { key: ViewKey; title: string; icon: typeof RocketIcon; hint: string }[];
	}[] = [
		{
			group: 'Mission control',
			items: [
				{ key: 'overview', title: 'Overview', icon: LayoutDashboardIcon, hint: '1' },
				{ key: 'board', title: 'Board', icon: KanbanSquareIcon, hint: '2' },
				{ key: 'deployments', title: 'Deployments', icon: RocketIcon, hint: '3' }
			]
		},
		{
			group: 'Workspace',
			items: [
				{ key: 'schedule', title: 'Schedule', icon: CalendarDaysIcon, hint: '4' },
				{ key: 'settings', title: 'Settings', icon: SettingsIcon, hint: '5' }
			]
		}
	];

	const VIEW_TITLES: Record<ViewKey, string> = {
		overview: 'Overview',
		board: 'Board',
		deployments: 'Deployments',
		schedule: 'Schedule',
		settings: 'Settings'
	};

	/* Lazy views — the shell statically ships only the default view; the rest
           load on first navigation (and are prefetched after 3s of idle, so warm
           navigation is instant while the initial paint stays lean). */
	const LAZY: Record<Exclude<ViewKey, 'overview'>, () => Promise<{ default: Component }>> = {
		board: () => import('./-board.svelte'),
		deployments: () => import('./-deployments.svelte'),
		schedule: () => import('./-schedule.svelte'),
		settings: () => import('./-settings.svelte')
	};
	let loaded = $state<Partial<Record<ViewKey, Component>>>({ overview: Overview });

	$effect(() => {
		const key = showcase.view;
		if (loaded[key]) return;
		const loader = LAZY[key as Exclude<ViewKey, 'overview'>];
		if (!loader) return;
		let cancelled = false;
		loader().then((mod) => {
			if (!cancelled) loaded = { ...loaded, [key]: mod.default };
		});
		return () => {
			cancelled = true;
		};
	});

	// idle prefetch of the remaining views
	$effect(() => {
		const t = setTimeout(async () => {
			for (const k of Object.keys(LAZY) as Exclude<ViewKey, 'overview'>[]) {
				const mod = await LAZY[k]();
				if (!loaded[k]) loaded = { ...loaded, [k]: mod.default };
			}
		}, 3000);
		return () => clearTimeout(t);
	});

	/* number-key + hotkey navigation, ⌘K palette */
	function onKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			showcase.commandOpen = !showcase.commandOpen;
			return;
		}
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		const t = e.target as HTMLElement | null;
		if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
		if (e.key >= '1' && e.key <= '5') {
			const flat = NAV.flatMap((g) => g.items);
			const target = flat[Number(e.key) - 1];
			if (target) showcase.view = target.key;
		} else if (e.key.toLowerCase() === 'c') {
			showcase.view = 'board';
			showcase.issueDialogOpen = true;
		} else if (e.key.toLowerCase() === 'd') {
			showcase.view = 'deployments';
			showcase.deployDialogOpen = true;
		}
	}
</script>

<Seo path="/showcase" />

<svelte:window onkeydown={onKeydown} />

<Sidebar.Provider>
	<Sidebar.Root collapsible="icon" class="border-r">
		<Sidebar.Header>
			<Sidebar.Menu>
				<Sidebar.MenuItem>
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							{#snippet child({ props })}
								<Sidebar.MenuButton size="lg" {...props}>
									<div
										class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground"
									>
										N
									</div>
									<div class="grid flex-1 text-left leading-tight">
										<span class="truncate font-semibold">Nimbus</span>
										<span class="truncate text-xs text-muted-foreground">Scale · 12 seats</span>
									</div>
									<ChevronsUpDownIcon class="ml-auto size-4" aria-hidden="true" />
								</Sidebar.MenuButton>
							{/snippet}
						</DropdownMenu.Trigger>
						<DropdownMenu.Content side="top" align="start" class="w-56">
							<DropdownMenu.GroupHeading>Workspaces</DropdownMenu.GroupHeading>
							<DropdownMenu.RadioGroup value="nimbus">
								<DropdownMenu.RadioItem value="nimbus">
									<div class="flex items-center gap-2">
										<span
											class="flex size-5 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground"
											>N</span
										>
										Nimbus
									</div>
								</DropdownMenu.RadioItem>
								<DropdownMenu.RadioItem value="personal">
									<div class="flex items-center gap-2">
										<span
											class="flex size-5 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground"
											>A</span
										>
										Ada's lab
									</div>
								</DropdownMenu.RadioItem>
							</DropdownMenu.RadioGroup>
							<DropdownMenu.Separator />
							<DropdownMenu.Item
								onclick={() => toast.info('Workspace creation is disabled in the demo')}
							>
								<PlusIcon aria-hidden="true" />New workspace
							</DropdownMenu.Item>
							<DropdownMenu.Item onclick={() => (showcase.view = 'settings')}>
								<SettingsIcon aria-hidden="true" />Workspace settings
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		</Sidebar.Header>

		<Sidebar.Content>
			{#each NAV as group (group.group)}
				<Sidebar.Group>
					<Sidebar.GroupLabel>{group.group}</Sidebar.GroupLabel>
					<Sidebar.GroupContent>
						<Sidebar.Menu>
							{#each group.items as item (item.key)}
								<Sidebar.MenuItem>
									<Sidebar.MenuButton
										isActive={showcase.view === item.key}
										tooltipContent={item.title}
										onclick={() => (showcase.view = item.key)}
									>
										<item.icon aria-hidden="true" />
										<span>{item.title}</span>
									</Sidebar.MenuButton>
									{#if item.key === 'board'}
										<Sidebar.MenuBadge>{showcase.openCount()}</Sidebar.MenuBadge>
									{/if}
								</Sidebar.MenuItem>
							{/each}
						</Sidebar.Menu>
					</Sidebar.GroupContent>
				</Sidebar.Group>
			{/each}

			<Sidebar.Group class="mt-auto">
				<Sidebar.GroupLabel>Explore the kit</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						<Sidebar.MenuItem>
							<Sidebar.MenuButton>
								{#snippet child({ props: linkProps })}
									<a href="/data-table" {...linkProps}>
										<TableIcon aria-hidden="true" />
										<span>Data table demo</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
						<Sidebar.MenuItem>
							<Sidebar.MenuButton>
								{#snippet child({ props: linkProps })}
									<a href="/validation" {...linkProps}>
										<ListChecksIcon aria-hidden="true" />
										<span>Validation demo</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
						<Sidebar.MenuItem>
							<Sidebar.MenuButton>
								{#snippet child({ props: linkProps })}
									<a
										href="https://github.com/iamleson98/sui"
										target="_blank"
										rel="noreferrer"
										{...linkProps}
									>
										<ShieldCheckIcon aria-hidden="true" />
										<span>Source on GitHub</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		</Sidebar.Content>

		<Sidebar.Footer>
			<Sidebar.Menu>
				<Sidebar.MenuItem>
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							{#snippet child({ props })}
								<Sidebar.MenuButton size="lg" {...props}>
									<PersonAvatar id="ada" class="size-8" dot />
									<div class="grid flex-1 text-left leading-tight">
										<span class="truncate font-semibold">Ada Okafor</span>
										<span class="truncate text-xs text-muted-foreground">ada@nimbus.dev</span>
									</div>
									<ChevronsUpDownIcon class="ml-auto size-4" aria-hidden="true" />
								</Sidebar.MenuButton>
							{/snippet}
						</DropdownMenu.Trigger>
						<DropdownMenu.Content side="top" align="start" class="w-56">
							<DropdownMenu.GroupHeading class="font-normal">
								<div class="text-sm font-medium">Ada Okafor</div>
								<div class="text-xs text-muted-foreground">ada@nimbus.dev</div>
							</DropdownMenu.GroupHeading>
							<DropdownMenu.Separator />
							<DropdownMenu.Item onclick={() => (showcase.view = 'settings')}>
								<UserIcon aria-hidden="true" />Account
							</DropdownMenu.Item>
							<DropdownMenu.Item onclick={() => (showcase.view = 'settings')}>
								<CreditCardIcon aria-hidden="true" />Billing
							</DropdownMenu.Item>
							<DropdownMenu.Item onclick={() => (showcase.commandOpen = true)}>
								<CommandIcon aria-hidden="true" />Command palette
								<DropdownMenu.Shortcut>⌘K</DropdownMenu.Shortcut>
							</DropdownMenu.Item>
							<DropdownMenu.Separator />
							<DropdownMenu.Item
								onclick={() => toast.info('Signed out of the demo — see you soon')}
							>
								<LogOutIcon aria-hidden="true" />Sign out
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		</Sidebar.Footer>
		<Sidebar.Rail />
	</Sidebar.Root>

	<Sidebar.Inset class="flex min-h-svh flex-col">
		<!-- topbar -->
		<header
			class="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur sm:px-4"
		>
			<Sidebar.Trigger class="-ml-1" />
			<Separator.Root orientation="vertical" class="mr-1 !h-4" />
			<Breadcrumb.Root>
				<Breadcrumb.List>
					<Breadcrumb.Item>
						<Breadcrumb.Link href="/">sui</Breadcrumb.Link>
					</Breadcrumb.Item>
					<Breadcrumb.Separator />
					<Breadcrumb.Item>
						<Breadcrumb.Link href="/showcase">Nimbus</Breadcrumb.Link>
					</Breadcrumb.Item>
					<Breadcrumb.Separator />
					<Breadcrumb.Item>
						<Breadcrumb.Page>{VIEW_TITLES[showcase.view]}</Breadcrumb.Page>
					</Breadcrumb.Item>
				</Breadcrumb.List>
			</Breadcrumb.Root>

			<div class="ml-auto flex items-center gap-1">
				<Button
					variant="outline"
					size="sm"
					class="hidden h-8 w-56 justify-start gap-2 pr-1 text-muted-foreground sm:flex"
					onclick={() => (showcase.commandOpen = true)}
				>
					<SearchIcon class="size-3.5" aria-hidden="true" />
					<span class="flex-1 text-left text-xs">Search or jump…</span>
					<Kbd>⌘K</Kbd>
				</Button>
				<SuiIconButton
					icon={SearchIcon}
					label="Open command palette"
					size="sm"
					variant="ghost"
					class="sm:hidden"
					onclick={() => (showcase.commandOpen = true)}
				/>

				<!-- notifications -->
				<Popover.Root>
					<Popover.Trigger
						class="relative flex size-8 items-center justify-center rounded-md transition-colors hover:bg-accent"
						aria-label="Notifications"
					>
						<BellIcon class="size-4" aria-hidden="true" />
						{#if !showcase.notificationsRead}
							<span
								class="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary ring-2 ring-background"
							></span>
						{/if}
					</Popover.Trigger>
					<Popover.Content align="end" class="w-80 p-0">
						<div class="flex items-center justify-between border-b px-4 py-3">
							<span class="text-sm font-semibold">Notifications</span>
							<button
								class="text-xs font-medium text-primary hover:underline"
								onclick={() => {
									showcase.notificationsRead = true;
									toast.success('All caught up');
								}}
							>
								Mark all read
							</button>
						</div>
						<ScrollArea.Root class="h-72">
							<div class="space-y-1 p-2">
								{#each ACTIVITY.slice(0, 8) as a (a.id)}
									<button
										class="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent/50"
										onclick={() =>
											toast.info(a.target, { description: `${person(a.who).name} · ${a.when}` })}
									>
										<PersonAvatar id={a.who} class="size-7" />
										<span class="min-w-0 flex-1">
											<span class="block text-xs leading-relaxed">
												<span class="font-medium">{person(a.who).name}</span>
												{a.action}
												{a.target}
											</span>
											<span
												class="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground"
											>
												<Chips kind="activity" value={a.kind} />
												{a.when}
											</span>
										</span>
										{#if !showcase.notificationsRead}
											<span
												class="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
												aria-hidden="true"
											></span>
										{/if}
									</button>
								{/each}
							</div>
						</ScrollArea.Root>
					</Popover.Content>
				</Popover.Root>

				<SuiIconButton
					icon={theme.dark ? SunIcon : MoonIcon}
					label={theme.dark ? 'Switch to light theme' : 'Switch to dark theme'}
					size="sm"
					variant="ghost"
					onclick={() => theme.toggle()}
				/>
				<Badge
					variant="outline"
					class="hidden border-emerald-500/40! text-emerald-600! md:inline-flex">all green</Badge
				>
				<SuiButton
					size="sm"
					variant="ghost"
					class="hidden lg:flex"
					endIcon={ExternalLinkIcon}
					onclick={() => (showcase.commandOpen = true)}
				>
					<Kbd>1</Kbd>–<Kbd>5</Kbd> to jump
				</SuiButton>
			</div>
		</header>

		<!-- active view -->
		<main class="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
			{#key showcase.view}
				<div class="animate-in duration-300 fade-in slide-in-from-bottom-2">
					{#if loaded[showcase.view]}
						{@const View = loaded[showcase.view]!}
						<View />
					{:else}
						<SuiSkeletonContainer class="space-y-4">
							<SuiSkeleton class="h-8 w-64" />
							<SuiSkeleton class="h-4 w-96 max-w-full" />
							<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
								{#each Array(4) as _, i (i)}
									<SuiSkeleton class="h-28" />
								{/each}
							</div>
							<SuiSkeleton class="h-72" />
						</SuiSkeletonContainer>
					{/if}
				</div>
			{/key}
		</main>
	</Sidebar.Inset>
</Sidebar.Provider>

<CommandPalette bind:open={showcase.commandOpen} />
<Toaster theme={theme.dark ? 'dark' : 'light'} position="bottom-right" />
