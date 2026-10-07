<script lang="ts">
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Slider from '$lib/components/ui/slider/index.js';
	import * as Switch from '$lib/components/ui/switch/index.js';
	import * as Progress from '$lib/components/ui/progress/index.js';
	import * as Accordion from '$lib/components/ui/accordion/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Pagination from '$lib/components/ui/pagination/index.js';
	import * as InputGroup from '$lib/components/ui/input-group/index.js';
	import * as InputOTP from '$lib/components/ui/input-otp/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { SuiInput, SuiTextarea } from '$lib/sui/input/index.js';
	import { SuiSelect } from '$lib/sui/select/index.js';
	import { SuiCombobox } from '$lib/sui/combobox/index.js';
	import { SuiRadioGroup } from '$lib/sui/radio-group/index.js';
	import { SuiButton } from '$lib/sui/button/index.js';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';

	import ViewHeader from './-view-header.svelte';
	import { theme } from '$lib/demo/theme.svelte';
	import { INVOICES, NOTIF_PREFS, USAGE, type NotifPref } from './-data.svelte';

	import UserIcon from '@lucide/svelte/icons/user';
	import BellIcon from '@lucide/svelte/icons/bell';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import CreditCardIcon from '@lucide/svelte/icons/credit-card';
	import CheckIcon from '@lucide/svelte/icons/check';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import KeyRoundIcon from '@lucide/svelte/icons/key-round';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';

	/* ------------------------------------------------------------- general -- */
	let wsName = $state('Nimbus Platform');
	let wsEmail = $state('ops@nimbus.dev');
	let wsSlug = $state('nimbus');
	let tz = $state<string | undefined>('Europe/Amsterdam');
	let locale = $state<string | undefined>('en');

	const tzItems = [
		{ value: 'europe/amsterdam', label: 'Europe/Amsterdam', description: 'UTC+1 · CET' },
		{ value: 'asia/singapore', label: 'Asia/Singapore', description: 'UTC+8 · SGT' },
		{ value: 'america/new_york', label: 'America/New York', description: 'UTC-5 · EST' },
		{ value: 'utc', label: 'UTC', description: 'Coordinated Universal Time' }
	];
	const localeItems = [
		{ value: 'en', label: 'English' },
		{ value: 'nl', label: 'Nederlands' },
		{ value: 'vi', label: 'Tiếng Việt' },
		{ value: 'ja', label: '日本語' },
		{ value: 'pt', label: 'Português' }
	];

	/* ------------------------------------------------------- notifications -- */
	let prefs = $state<NotifPref[]>(NOTIF_PREFS.map((p) => ({ ...p })));
	let digestDays = $state(3);
	let threshold = $state(80);

	function setChannel(channel: 'email' | 'push' | 'slack', id: string, value: boolean) {
		prefs = prefs.map((p) => (p.id === id ? { ...p, [channel]: value } : p));
	}

	function toggleChannelAll(channel: 'email' | 'push' | 'slack', value: boolean) {
		prefs = prefs.map((p) => ({ ...p, [channel]: value }));
	}

	const allEmailOff = $derived(prefs.every((p) => !p.email));

	/* --------------------------------------------------------- appearance -- */
	let radius = $state(0.625);
	let fontPx = $state(16);
	let scheme = $state(theme.dark ? 'dark' : 'light');

	// radio → theme store (untracked so an external theme change can't ping-pong)
	$effect(() => {
		const dark = scheme === 'dark';
		if (dark !== untrack(() => theme.dark)) theme.toggle();
	});

	$effect(() => {
		document.documentElement.style.setProperty('--radius', `${radius}rem`);
		return () => document.documentElement.style.removeProperty('--radius');
	});
	$effect(() => {
		document.documentElement.style.fontSize = `${fontPx}px`;
		return () => {
			document.documentElement.style.removeProperty('font-size');
		};
	});

	/* ------------------------------------------------------------- billing -- */
	const PLANS = [
		{
			name: 'Hobby',
			price: '$0',
			per: 'forever',
			perks: ['1 service', 'Community support', '7-day log retention']
		},
		{
			name: 'Scale',
			price: '$34',
			per: 'per seat / month',
			perks: ['Unlimited services', 'Canary + hooks', '90-day log retention'],
			current: true
		},
		{
			name: 'Enterprise',
			price: 'Custom',
			per: 'annual',
			perks: ['SSO + SCIM', 'Audit log streaming', 'Dedicated regions']
		}
	];

	let page = $state(1);
	const perPage = 4;
	const invoicePages = $derived(Math.max(1, Math.ceil(INVOICES.length / perPage)));
	const shownInvoices = $derived(INVOICES.slice((page - 1) * perPage, page * perPage));

	/* -------------------------------------------------- danger zone / OTP -- */
	let transferOpen = $state(false);
	let otp = $state('');
	let deleteOpen = $state(false);
	let deleteConfirm = $state('');
	let deleteName = $state('');

	function onOtpComplete() {
		if (otp === '424242') {
			toast.success('Verified — ownership transfer unlocked', {
				description: 'The next screen would ask for the new owner.'
			});
			transferOpen = false;
			otp = '';
		} else {
			toast.error('That code is not right', { description: 'Hint for the demo: 424242' });
		}
	}

	function copySlug() {
		toast.info('Workspace URL copied', { description: `https://nimbus.dev/w/${wsSlug}` });
	}

	function saveGeneral() {
		toast.success('Workspace saved', {
			description: `${wsName} · ${tzItems.find((t) => t.value === tz)?.label ?? 'UTC'} · ${localeItems.find((l) => l.value === locale)?.label}`
		});
	}
</script>

<ViewHeader
	title="Settings"
	description="Workspace, notifications, appearance and billing — every switch, slider, table and dialog pattern the kit provides, doing real work."
/>

<Tabs.Root value="general" class="gap-4">
	<Tabs.List>
		<Tabs.Trigger value="general"><UserIcon aria-hidden="true" />General</Tabs.Trigger>
		<Tabs.Trigger value="notifications"><BellIcon aria-hidden="true" />Notifications</Tabs.Trigger>
		<Tabs.Trigger value="appearance"><PaletteIcon aria-hidden="true" />Appearance</Tabs.Trigger>
		<Tabs.Trigger value="billing"><CreditCardIcon aria-hidden="true" />Billing</Tabs.Trigger>
	</Tabs.List>

	<!-- ---------------------------------------------------------- general -- -->
	<Tabs.Content value="general">
		<Card.Root class="max-w-2xl">
			<Card.Header>
				<Card.Title>Workspace</Card.Title>
				<Card.Description
					>How your team appears across the console, emails and the status page.</Card.Description
				>
			</Card.Header>
			<Card.Content class="grid gap-4">
				<div class="grid gap-4 sm:grid-cols-2">
					<SuiInput id="sc-set-name" label="Workspace name" bind:value={wsName} />
					<SuiInput id="sc-set-email" label="Contact email" type="email" bind:value={wsEmail} />
				</div>

				<div>
					<Label for="sc-set-url" class="mb-2">Workspace URL</Label>
					<InputGroup.Root>
						<InputGroup.Addon align="inline-start">
							<InputGroup.Text>nimbus.dev/w/</InputGroup.Text>
						</InputGroup.Addon>
						<InputGroup.Input id="sc-set-url" class="font-mono" bind:value={wsSlug} />
						<InputGroup.Addon align="inline-end">
							<InputGroup.Button
								size="icon-sm"
								variant="ghost"
								aria-label="Copy workspace URL"
								onclick={copySlug}
							>
								<CopyIcon class="size-3.5" aria-hidden="true" />
							</InputGroup.Button>
						</InputGroup.Addon>
					</InputGroup.Root>
					<p class="mt-1.5 text-xs text-muted-foreground">Lowercase letters, numbers and dashes.</p>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<SuiSelect id="sc-set-tz" label="Timezone" items={tzItems} bind:value={tz} clearable />
					<SuiCombobox
						id="sc-set-locale"
						label="Language"
						items={localeItems}
						bind:value={locale}
						placeholder="Pick language…"
					/>
				</div>

				<SuiTextarea
					id="sc-set-about"
					label="About"
					rows={2}
					placeholder="Platform team @ Nimbus — we ship small and often."
					subText="Shown on the shared status page."
				/>
			</Card.Content>
			<Card.Footer class="justify-end gap-2">
				<Button
					variant="ghost"
					onclick={() => {
						wsName = 'Nimbus Platform';
						wsSlug = 'nimbus';
					}}>Reset</Button
				>
				<SuiButton onclick={saveGeneral}>Save changes</SuiButton>
			</Card.Footer>
		</Card.Root>
	</Tabs.Content>

	<!-- ---------------------------------------------------- notifications -- -->
	<Tabs.Content value="notifications">
		<div class="grid gap-4">
			{#if allEmailOff}
				<div
					class="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300"
				>
					<TriangleAlertIcon class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
					<div>
						Every email notification is off — incident escalations will only reach Slack. Most teams
						keep email on for incidents.
					</div>
				</div>
			{/if}

			<Card.Root>
				<Card.Header>
					<Card.Title>Channels</Card.Title>
					<Card.Description>Per-event control of email, push and Slack delivery.</Card.Description>
				</Card.Header>
				<Card.Content class="p-0">
					<div class="overflow-x-auto">
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.Head class="min-w-56">Event</Table.Head>
									<Table.Head class="text-center">
										<div class="flex flex-col items-center gap-1">
											Email
											<Switch.Root
												size="sm"
												checked={prefs.every((p) => p.email)}
												onCheckedChange={(v) => toggleChannelAll('email', v)}
												aria-label="Toggle all email"
											/>
										</div>
									</Table.Head>
									<Table.Head class="text-center">
										<div class="flex flex-col items-center gap-1">
											Push
											<Switch.Root
												size="sm"
												checked={prefs.every((p) => p.push)}
												onCheckedChange={(v) => toggleChannelAll('push', v)}
												aria-label="Toggle all push"
											/>
										</div>
									</Table.Head>
									<Table.Head class="text-center">
										<div class="flex flex-col items-center gap-1">
											Slack
											<Switch.Root
												size="sm"
												checked={prefs.every((p) => p.slack)}
												onCheckedChange={(v) => toggleChannelAll('slack', v)}
												aria-label="Toggle all slack"
											/>
										</div>
									</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each prefs as p (p.id)}
									<Table.Row>
										<Table.Cell>
											<div class="font-medium">{p.label}</div>
											<div class="text-xs text-muted-foreground">{p.description}</div>
										</Table.Cell>
										<Table.Cell class="text-center">
											<Switch.Root
												size="sm"
												checked={p.email}
												onCheckedChange={(v) => setChannel('email', p.id, v)}
												aria-label="Email — {p.label}"
											/>
										</Table.Cell>
										<Table.Cell class="text-center">
											<Switch.Root
												size="sm"
												checked={p.push}
												onCheckedChange={(v) => setChannel('push', p.id, v)}
												aria-label="Push — {p.label}"
											/>
										</Table.Cell>
										<Table.Cell class="text-center">
											<Switch.Root
												size="sm"
												checked={p.slack}
												onCheckedChange={(v) => setChannel('slack', p.id, v)}
												aria-label="Slack — {p.label}"
											/>
										</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					</div>
				</Card.Content>
			</Card.Root>

			<div class="grid gap-4 sm:grid-cols-2">
				<Card.Root>
					<Card.Header>
						<Card.Title>Digest cadence</Card.Title>
						<Card.Description>Bundle low-priority mail into one message.</Card.Description>
					</Card.Header>
					<Card.Content class="space-y-4">
						<Slider.Root
							type="single"
							bind:value={digestDays}
							min={1}
							max={7}
							step={1}
							aria-label="Digest every N days"
						/>
						<div class="text-xs text-muted-foreground">
							Every <span class="font-semibold text-foreground">{digestDays}</span>
							day{digestDays === 1 ? '' : 's'} — next digest Monday 09:00 in your timezone.
						</div>
					</Card.Content>
				</Card.Root>
				<Card.Root>
					<Card.Header>
						<Card.Title>Usage threshold alert</Card.Title>
						<Card.Description>Ping when monthly ops cross this share of plan.</Card.Description>
					</Card.Header>
					<Card.Content class="space-y-4">
						<Slider.Root
							type="single"
							bind:value={threshold}
							min={50}
							max={100}
							step={5}
							aria-label="Usage threshold percent"
						/>
						<div class="flex items-center gap-3">
							<Progress.Root value={threshold} class="h-1.5" aria-hidden="true" />
							<span class="text-xs font-semibold tabular-nums">{threshold}%</span>
						</div>
					</Card.Content>
				</Card.Root>
			</div>
		</div>
	</Tabs.Content>

	<!-- ------------------------------------------------------- appearance -- -->
	<Tabs.Content value="appearance">
		<div class="grid gap-4 lg:grid-cols-2">
			<Card.Root>
				<Card.Header>
					<Card.Title>Theme</Card.Title>
					<Card.Description
						>Applies instantly, persists across visits, no flash on reload.</Card.Description
					>
				</Card.Header>
				<Card.Content>
					<SuiRadioGroup
						label="Color scheme"
						items={[
							{ value: 'light', label: 'Light — white surfaces, zinc ink' },
							{ value: 'dark', label: 'Dark — near-black surfaces, soft grays' }
						]}
						bind:value={scheme}
					/>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title>Shape &amp; scale</Card.Title>
					<Card.Description
						>Both sliders restyle the whole app live — radius is a CSS variable, text size rides the
						root font.</Card.Description
					>
				</Card.Header>
				<Card.Content class="space-y-6">
					<div>
						<div class="mb-3 flex items-center justify-between text-sm">
							<Label>Corner radius</Label>
							<span class="text-xs text-muted-foreground tabular-nums"
								>{(radius * 16).toFixed(0)}px</span
							>
						</div>
						<Slider.Root
							type="single"
							bind:value={radius}
							min={0.25}
							max={1.25}
							step={0.125}
							aria-label="Corner radius"
						/>
						<div class="mt-3 flex items-center gap-2">
							<span class="size-4 rounded-(--radius) bg-primary"></span>
							<span class="size-6 rounded-(--radius) border bg-muted"></span>
							<span class="size-8 rounded-(--radius) border bg-primary/10"></span>
							<span class="ml-1 text-xs text-muted-foreground">live preview</span>
						</div>
					</div>
					<div>
						<div class="mb-3 flex items-center justify-between text-sm">
							<Label>Text size</Label>
							<span class="text-xs text-muted-foreground tabular-nums">{fontPx}px</span>
						</div>
						<Slider.Root
							type="single"
							bind:value={fontPx}
							min={14}
							max={18}
							step={1}
							aria-label="Base text size"
						/>
					</div>
				</Card.Content>
			</Card.Root>
		</div>
	</Tabs.Content>

	<!-- ----------------------------------------------------------- billing -- -->
	<Tabs.Content value="billing">
		<div class="grid gap-4">
			<div class="grid gap-4 md:grid-cols-3">
				{#each PLANS as plan (plan.name)}
					<Card.Root class={plan.current ? 'border-primary ring-2 ring-primary/20' : ''}>
						<Card.Header>
							<Card.Title class="flex items-center gap-2">
								{plan.name}
								{#if plan.current}
									<Badge>current</Badge>
								{/if}
							</Card.Title>
							<Card.Description>
								<span class="text-lg font-bold text-foreground">{plan.price}</span>
								<span class="text-muted-foreground"> · {plan.per}</span>
							</Card.Description>
						</Card.Header>
						<Card.Content class="space-y-1.5">
							{#each plan.perks as perk (perk)}
								<div class="flex items-center gap-2 text-sm">
									<CheckIcon class="size-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
									{perk}
								</div>
							{/each}
						</Card.Content>
						<Card.Footer>
							{#if plan.current}
								<Button
									variant="outline"
									class="w-full"
									onclick={() => toast.info('You are already on Scale')}>Manage plan</Button
								>
							{:else if plan.name === 'Hobby'}
								<Button
									variant="outline"
									class="w-full"
									onclick={() => toast.warning('Downgrading keeps 90 days of history')}
									>Downgrade</Button
								>
							{:else}
								<Button
									class="w-full"
									onclick={() =>
										toast.info('Enterprise — let’s talk', { description: 'sales@nimbus.dev' })}
									><SparklesIcon aria-hidden="true" />Contact sales</Button
								>
							{/if}
						</Card.Footer>
					</Card.Root>
				{/each}
			</div>

			<div class="grid gap-4 lg:grid-cols-[1fr_2fr]">
				<Card.Root>
					<Card.Header>
						<Card.Title>Usage this cycle</Card.Title>
						<Card.Description>Resets in 12 days</Card.Description>
					</Card.Header>
					<Card.Content class="space-y-4">
						{#each [{ label: 'Object storage', pct: USAGE.storagePct, hint: '6.8 of 10 TB' }, { label: 'Build minutes', pct: USAGE.opsPct, hint: '20.5 of 50k' }, { label: 'Seats', pct: Math.round((USAGE.seats / USAGE.seatsMax) * 100), hint: `${USAGE.seats} of ${USAGE.seatsMax}` }] as u (u.label)}
							<div>
								<div class="mb-1.5 flex items-baseline justify-between text-xs">
									<span class="font-medium">{u.label}</span>
									<span class="text-muted-foreground tabular-nums">{u.hint}</span>
								</div>
								<Progress.Root value={u.pct} class="h-1.5" aria-label="{u.label}: {u.pct}%" />
							</div>
						{/each}
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header>
						<Card.Title>Invoices</Card.Title>
						<Card.Description>Paid via card ending 4242</Card.Description>
					</Card.Header>
					<Card.Content class="p-0">
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.Head>Invoice</Table.Head>
									<Table.Head>Date</Table.Head>
									<Table.Head>Plan</Table.Head>
									<Table.Head class="text-right">Amount</Table.Head>
									<Table.Head class="text-right">Status</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each shownInvoices as inv (inv.id)}
									<Table.Row>
										<Table.Cell class="font-mono text-xs">{inv.id}</Table.Cell>
										<Table.Cell class="text-sm">{inv.date}</Table.Cell>
										<Table.Cell class="text-sm text-muted-foreground">{inv.plan}</Table.Cell>
										<Table.Cell class="text-right text-sm font-medium tabular-nums"
											>{inv.amount}</Table.Cell
										>
										<Table.Cell class="text-right">
											<Badge
												variant="secondary"
												class="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
											>
												<CheckIcon class="size-3" aria-hidden="true" />{inv.status}
											</Badge>
										</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
						<div class="flex items-center justify-between px-4 py-3">
							<span class="text-xs text-muted-foreground">Page {page} of {invoicePages}</span>
							<Pagination.Root
								count={INVOICES.length}
								{perPage}
								{page}
								onPageChange={(p: number) => (page = p)}
								siblingCount={2}
							>
								<Pagination.Content class="gap-1">
									<Pagination.Item>
										<Pagination.Previous
											aria-disabled={page === 1}
											class={page === 1 ? 'pointer-events-none opacity-50' : ''}
										/>
									</Pagination.Item>
									{#each Array(invoicePages) as _, i (i)}
										<Pagination.Item>
											<Pagination.Link
												page={{ type: 'page', value: i + 1 }}
												isActive={page === i + 1}>{i + 1}</Pagination.Link
											>
										</Pagination.Item>
									{/each}
									<Pagination.Item>
										<Pagination.Next
											aria-disabled={page === invoicePages}
											class={page === invoicePages ? 'pointer-events-none opacity-50' : ''}
										/>
									</Pagination.Item>
								</Pagination.Content>
							</Pagination.Root>
						</div>
					</Card.Content>
				</Card.Root>
			</div>

			<!-- danger zone -->
			<Card.Root class="border-destructive/40">
				<Card.Header>
					<Card.Title class="text-destructive">Danger zone</Card.Title>
					<Card.Description
						>Irreversible workspace administration — both paths verify first.</Card.Description
					>
				</Card.Header>
				<Card.Content class="p-0">
					<Accordion.Root type="single" class="w-full">
						<Accordion.Item value="transfer">
							<Accordion.Trigger class="text-sm">
								<span class="flex items-center gap-2"
									><KeyRoundIcon class="size-4" aria-hidden="true" />Transfer ownership</span
								>
							</Accordion.Trigger>
							<Accordion.Content class="text-sm text-muted-foreground">
								<p class="mb-3">
									Moves billing and admin rights to another member. Verify with the 6-digit code
									from your authenticator app (demo code: 424242).
								</p>
								<Button variant="outline" size="sm" onclick={() => (transferOpen = true)}
									>Start transfer</Button
								>
							</Accordion.Content>
						</Accordion.Item>
						<Accordion.Item value="delete">
							<Accordion.Trigger class="text-sm">
								<span class="flex items-center gap-2"
									><Trash2Icon class="size-4" aria-hidden="true" />Delete workspace</span
								>
							</Accordion.Trigger>
							<Accordion.Content class="text-sm text-muted-foreground">
								<p class="mb-3">
									Destroys every service, deployment and issue. Type the workspace name to confirm.
								</p>
								<Button
									variant="destructive"
									size="sm"
									onclick={() => {
										deleteOpen = true;
										deleteConfirm = '';
										deleteName = '';
									}}>Delete workspace…</Button
								>
							</Accordion.Content>
						</Accordion.Item>
					</Accordion.Root>
				</Card.Content>
			</Card.Root>
		</div>
	</Tabs.Content>
</Tabs.Root>

<!-- ownership transfer: OTP verification -->
<Dialog.Root bind:open={transferOpen}>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Verify it's you</Dialog.Title>
			<Dialog.Description
				>Enter the 6-digit code from your authenticator app. Demo code: 424242.</Dialog.Description
			>
		</Dialog.Header>
		<div class="flex flex-col items-center gap-4 py-4">
			<InputOTP.Root maxlength={6} bind:value={otp} onComplete={onOtpComplete}>
				{#snippet children({ cells })}
					<InputOTP.Group>
						{#each cells.slice(0, 3) as cell, i (i)}
							<InputOTP.Slot {cell} />
						{/each}
					</InputOTP.Group>
					<InputOTP.Separator />
					<InputOTP.Group>
						{#each cells.slice(3) as cell, i (i)}
							<InputOTP.Slot {cell} />
						{/each}
					</InputOTP.Group>
				{/snippet}
			</InputOTP.Root>
			<Button
				variant="outline"
				size="sm"
				onclick={() => {
					otp = '424242';
				}}>Autofill demo code</Button
			>
		</div>
	</Dialog.Content>
</Dialog.Root>

<!-- delete workspace: typed confirmation -->
<AlertDialog.Root bind:open={deleteOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete “Nimbus Platform”?</AlertDialog.Title>
			<AlertDialog.Description>
				This permanently removes 8 services, {400}+ deployments and every issue on the board. Type
				<span class="font-mono font-semibold text-foreground">nimbus</span> to unlock the button.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<div class="py-2">
			<Input
				bind:value={deleteName}
				placeholder="nimbus"
				class="font-mono"
				aria-label="Type the workspace name"
			/>
		</div>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				disabled={deleteName.trim() !== 'nimbus'}
				class="data-[disabled]:pointer-events-none"
				onclick={() =>
					toast.error('Nice try — this is a demo 😅', {
						description: 'The workspace lives on so you can keep exploring.'
					})}
			>
				I understand, delete
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
