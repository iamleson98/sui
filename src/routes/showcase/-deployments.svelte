<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import * as ScrollArea from '$lib/components/ui/scroll-area/index.js';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import * as Drawer from '$lib/components/ui/drawer/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import {
		SuiDataTable,
		suiColumn,
		renderComponent,
		suiDownloadCsv,
		type SuiDataTableSize,
		type SuiDataTableColumn
	} from '$lib/sui/data-table/index.js';
	import { SuiButton } from '$lib/sui/button/index.js';
	import { SuiSelect } from '$lib/sui/select/index.js';
	import { SuiSwitch } from '$lib/sui/switch/index.js';
	import { toast } from 'svelte-sonner';
	import { IsMobile } from '$lib/hooks/is-mobile.svelte';

	import ViewHeader from './-view-header.svelte';
	import Chips from './-chips.svelte';
	import DeployAuthor from './-deploy-author.svelte';
	import DeployActions from './-deploy-actions.svelte';
	import DeployDialog from './-deploy-dialog.svelte';
	import { showcase } from './-state.svelte';
	import { SERVICES, person, type Deployment, type Env } from './-data.svelte';

	import CloudUploadIcon from '@lucide/svelte/icons/cloud-upload';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import RadioIcon from '@lucide/svelte/icons/radio';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import CircleXIcon from '@lucide/svelte/icons/circle-x';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import GitBranchIcon from '@lucide/svelte/icons/git-branch';

	const isMobile = new IsMobile();

	/* ------------------------------------------------------------- filters -- */
	let envFilter = $state<'all' | Env>('all');
	let serviceFilter = $state<string | undefined>(undefined);
	let density = $state<SuiDataTableSize>('md');

	const serviceItems = SERVICES.map((s) => ({ value: s, label: s }));
	const data = $derived(
		showcase.deployments.filter((d) => {
			if (envFilter !== 'all' && d.env !== envFilter) return false;
			if (serviceFilter && d.service !== serviceFilter) return false;
			return true;
		})
	);

	/* ------------------------------------------------------------- columns -- */
	const col = suiColumn<Deployment>();
	const columns = [
		col.display({
			id: 'status',
			header: 'Status',
			meta: { width: 104 },
			cell: ({ row }) => renderComponent(Chips, { kind: 'deploy', value: row.original.status })
		}),
		col.accessor('service', {
			header: 'Service',
			meta: { width: 140, class: 'font-mono text-xs' }
		}),
		col.display({
			id: 'env',
			header: 'Env',
			meta: { width: 96 },
			cell: ({ row }) => renderComponent(Chips, { kind: 'env', value: row.original.env })
		}),
		col.accessor('version', { header: 'Version', meta: { width: 80, class: 'font-mono text-xs' } }),
		col.accessor('branch', { header: 'Branch', meta: { width: 130, class: 'font-mono text-xs' } }),
		col.accessor('sha', { header: 'Commit', meta: { width: 84, class: 'font-mono text-xs' } }),
		col.display({
			id: 'author',
			header: 'Author',
			meta: { width: 150 },
			cell: ({ row }) => renderComponent(DeployAuthor, { authorId: row.original.authorId })
		}),
		col.accessor('startedMin', {
			header: 'Started',
			meta: { align: 'right', width: 84 },
			cell: (info) => info.row.original.started
		}),
		col.accessor('durationSec', {
			header: 'Duration',
			meta: { align: 'right', width: 90 },
			cell: (info) => info.row.original.duration
		}),
		col.display({
			id: 'actions',
			header: '',
			meta: { pinned: 'right', width: 56 },
			cell: ({ row }) =>
				renderComponent(DeployActions, {
					dep: row.original,
					onView: openDetail,
					onRedeploy,
					onRollback: askRollback
				})
		})
	] as SuiDataTableColumn<Deployment>[];

	/* ------------------------------------------------- detail + rollback -- */
	let selected = $state<Deployment | undefined>(undefined);
	let rollbackTarget = $state<Deployment | undefined>(undefined);
	let rollbackOpen = $state(false);

	function openDetail(dep: Deployment) {
		selected = dep;
	}

	function onRedeploy(dep: Deployment) {
		toast.promise(new Promise((r) => setTimeout(r, 2600)), {
			loading: `Redeploying ${dep.service} @ ${dep.sha}…`,
			success: `${dep.service} redeployed to ${dep.env}`,
			error: 'Redeploy failed'
		});
	}

	function askRollback(dep: Deployment) {
		rollbackTarget = dep;
		rollbackOpen = true;
	}

	function confirmRollback() {
		if (!rollbackTarget) return;
		showcase.patchDeployment(rollbackTarget.id, { status: 'canceled' });
		toast.success(`Rolled back ${rollbackTarget.service} to previous revision`, {
			description: `${rollbackTarget.env} · ${rollbackTarget.region} · traffic at 100% on the old fleet`
		});
		rollbackTarget = undefined;
	}

	function exportCsv() {
		suiDownloadCsv(
			showcase.deployments,
			[
				{ id: 'status', header: 'Status', value: (d: Deployment) => d.status },
				{ id: 'service', header: 'Service', value: (d: Deployment) => d.service },
				{ id: 'env', header: 'Env', value: (d: Deployment) => d.env },
				{ id: 'version', header: 'Version', value: (d: Deployment) => d.version },
				{ id: 'branch', header: 'Branch', value: (d: Deployment) => d.branch },
				{ id: 'sha', header: 'Commit', value: (d: Deployment) => d.sha },
				{ id: 'author', header: 'Author', value: (d: Deployment) => person(d.authorId).name },
				{ id: 'started', header: 'Started', value: (d: Deployment) => d.started },
				{ id: 'duration', header: 'Duration', value: (d: Deployment) => d.duration }
			],
			'nimbus-deployments.csv'
		);
		toast.success('Deployment history exported', {
			description: `${showcase.deployments.length} rows → nimbus-deployments.csv`
		});
	}

	/* ------------------------------------------------------- live log tail -- */
	const LOG_SEED = [
		'INFO  gateway      build plan resolved in 412ms',
		'INFO  builder      cache hit 94% — 118/126 layers restored',
		'INFO  builder      compiling rust workspace (12 crates)',
		'WARN  hooks        pre-flight "audit-log-drift" took 8.4s (budget 10s)',
		'INFO  promoter     canary weights 5% → 25% → 100%'
	];
	const LOG_POOL = [
		'INFO  promoter     shard {n}/8 healthy — p99 {ms}ms',
		'INFO  gateway      routing table synced ({regions} regions)',
		'DEBUG cache        purge queue depth: {n}',
		'INFO  hooks        post-flight "smoke-prod" passed in {n}s',
		'WARN  billing      replay lag {n}s — within tolerance',
		'INFO  promoter     canary metrics green for window {n}/6',
		'ERROR hooks        pre-flight "schema-check" retried, passed on attempt 2',
		'INFO  edge         config propagated to {n} PoPs'
	];
	let live = $state(true);
	let logLines = $state<string[]>([...LOG_SEED]);
	let logBox = $state<HTMLDivElement | null>(null);

	function nextLogLine(): string {
		const tmpl = LOG_POOL[Math.floor(Math.random() * LOG_POOL.length)]!;
		const fill = (s: string) =>
			s
				.replace(/\{n\}/g, String(1 + Math.floor(Math.random() * 96)))
				.replace(/\{ms\}/g, String(60 + Math.floor(Math.random() * 340)))
				.replace(/\{regions\}/g, String(3 + Math.floor(Math.random() * 5)));
		const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
		return `[${ts}] ${fill(tmpl)}`;
	}

	$effect(() => {
		if (!live) return;
		const t = setInterval(() => {
			logLines = [...logLines.slice(-140), nextLogLine()];
		}, 2100);
		return () => clearInterval(t);
	});

	$effect(() => {
		void logLines.length;
		if (logBox) logBox.scrollTop = logBox.scrollHeight;
	});

	const detailOpen = $derived(!!selected);
</script>

<ViewHeader
	title="Deployments"
	description="Every build, promotion and rollback across eight services — 400 rows, virtualized, searchable, column-pinned and CSV-exportable. Click any row for the full dossier."
>
	<SuiButton variant="outline" size="sm" startIcon={DownloadIcon} onclick={exportCsv}>
		Export CSV
	</SuiButton>
	<SuiButton
		size="sm"
		startIcon={CloudUploadIcon}
		onclick={() => (showcase.deployDialogOpen = true)}
	>
		Deploy
	</SuiButton>
</ViewHeader>

<div class="mb-3 flex flex-wrap items-center gap-2">
	<ToggleGroup.Root
		type="single"
		bind:value={envFilter}
		variant="outline"
		size="sm"
		aria-label="Filter by environment"
	>
		<ToggleGroup.Item value="all">All</ToggleGroup.Item>
		<ToggleGroup.Item value="production">Prod</ToggleGroup.Item>
		<ToggleGroup.Item value="staging">Staging</ToggleGroup.Item>
		<ToggleGroup.Item value="preview">Preview</ToggleGroup.Item>
	</ToggleGroup.Root>
	<SuiSelect
		size="sm"
		class="w-44"
		placeholder="All services"
		items={serviceItems}
		bind:value={serviceFilter}
		clearable
		aria-label="Filter by service"
	/>
	<div class="flex items-center gap-2">
		<span class="text-xs text-muted-foreground">Density</span>
		<ToggleGroup.Root
			type="single"
			bind:value={density}
			variant="outline"
			size="sm"
			aria-label="Row density"
		>
			<ToggleGroup.Item value="sm">S</ToggleGroup.Item>
			<ToggleGroup.Item value="md">M</ToggleGroup.Item>
			<ToggleGroup.Item value="lg">L</ToggleGroup.Item>
		</ToggleGroup.Root>
	</div>
	<span class="ms-auto text-xs text-muted-foreground tabular-nums">{data.length} deployments</span>
</div>

<Resizable.PaneGroup direction="vertical" class="min-h-[36rem] rounded-lg border">
	<Resizable.Pane defaultSize={68} minSize={40}>
		<SuiDataTable
			{data}
			{columns}
			size={density}
			rowId={(row) => row.id}
			searchable
			searchPlaceholder="Search service, branch, commit, author…"
			exportable
			exportFilename="deployments-filtered.csv"
			pagination="client"
			pageSize={12}
			defaultSorting={[{ id: 'startedMin', desc: false }]}
			onRowClick={(row) => openDetail(row)}
			maxHeight={520}
			class="h-full"
		/>
	</Resizable.Pane>
	<Resizable.Handle withHandle />
	<Resizable.Pane defaultSize={32} minSize={16} class="bg-card">
		<Card.Root class="size-full rounded-none border-0 shadow-none">
			<Card.Header class="py-3">
				<Card.Title class="flex items-center gap-2 text-sm">
					<RadioIcon
						class="size-4 text-emerald-500 {live ? 'animate-pulse' : ''}"
						aria-hidden="true"
					/>
					Live log tail
				</Card.Title>
				<Card.Description class="text-xs">web-gateway · canary promoter · hooks</Card.Description>
				<Card.Action>
					<SuiSwitch size="sm" label={live ? 'Tailing' : 'Paused'} bind:checked={live} />
				</Card.Action>
			</Card.Header>
			<Card.Content class="p-0 pb-3">
				<ScrollArea.Root class="h-56">
					<div bind:this={logBox} class="px-4 font-mono text-[11px] leading-relaxed">
						{#each logLines as line, i (i)}
							<div
								class="whitespace-pre {line.includes('ERROR')
									? 'text-red-500'
									: line.includes('WARN')
										? 'text-amber-500'
										: 'text-muted-foreground'}"
							>
								{line}
							</div>
						{/each}
					</div>
				</ScrollArea.Root>
			</Card.Content>
		</Card.Root>
	</Resizable.Pane>
</Resizable.PaneGroup>

{#snippet detailBody(dep: Deployment)}
	<div class="space-y-5">
		<div class="flex flex-wrap items-center gap-2">
			<Chips kind="deploy" value={dep.status} />
			<Chips kind="env" value={dep.env} />
			<Badge class="gap-1 font-mono" variant="outline">v{dep.version}</Badge>
			<span class="ms-auto text-xs text-muted-foreground">{dep.started} · {dep.region}</span>
		</div>

		<div>
			<div class="text-xs text-muted-foreground">Commit</div>
			<div class="mt-1 flex items-center gap-2">
				<GitBranchIcon class="size-3.5" aria-hidden="true" />
				<span class="font-mono text-xs">{dep.branch}</span>
				<Tooltip.Root>
					<Tooltip.Trigger>
						<button
							class="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs transition-colors hover:bg-accent"
							onclick={() =>
								toast.info('Copied', { description: `full SHA · ${dep.sha}${dep.sha}` })}
						>
							{dep.sha}
						</button>
					</Tooltip.Trigger>
					<Tooltip.Content>Copy the full SHA</Tooltip.Content>
				</Tooltip.Root>
			</div>
			<p class="mt-1.5 text-sm text-muted-foreground">{dep.commitMsg}</p>
		</div>

		<div>
			<div class="text-xs text-muted-foreground">Pipeline</div>
			<ol class="mt-2 space-y-2">
				{#each ['Queued', 'Build', 'Pre-flight hooks', 'Promote', 'Verified'] as stage, i (stage)}
					{@const done =
						dep.status === 'success' ||
						(dep.status === 'building' && i < 3) ||
						(dep.status !== 'queued' && i < 2)}
					{@const failed = dep.status === 'failed' && i === 3}
					<li class="flex items-center gap-2 text-sm {done ? '' : 'text-muted-foreground'}">
						{#if failed}
							<CircleXIcon class="size-4 text-red-500" aria-hidden="true" />
						{:else if done}
							<CircleCheckIcon class="size-4 text-emerald-500" aria-hidden="true" />
						{:else if dep.status === 'building' && i === 3}
							<LoaderIcon class="size-4 animate-spin text-sky-500" aria-hidden="true" />
						{:else}
							<ClockIcon class="size-4" aria-hidden="true" />
						{/if}
						{stage}
						{#if done && !failed}<span class="ms-auto text-xs text-muted-foreground">ok</span>{/if}
					</li>
				{/each}
			</ol>
		</div>

		<div class="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm">
			<div>
				<div class="text-xs text-muted-foreground">Triggered by</div>
				<span>{person(dep.authorId).name}</span>
			</div>
			<div>
				<div class="text-xs text-muted-foreground">Duration</div>
				<span class="tabular-nums">{dep.duration}</span>
			</div>
		</div>

		<div class="flex flex-wrap gap-2">
			<SuiButton
				size="sm"
				variant="outline"
				startIcon={CopyIcon}
				onclick={() => toast.info('Copied deploy URL', { description: `nimbus.dev/d/${dep.id}` })}
			>
				Copy link
			</SuiButton>
			<SuiButton size="sm" variant="outline" onclick={() => onRedeploy(dep)}>Redeploy</SuiButton>
			<SuiButton
				size="sm"
				variant="destructive"
				startIcon={RotateCcwIcon}
				disabled={dep.status !== 'success'}
				onclick={() => askRollback(dep)}
			>
				Rollback
			</SuiButton>
		</div>
	</div>
{/snippet}

<!-- detail: sheet on desktop, bottom drawer on mobile (native pattern) -->
{#if isMobile.current}
	<Drawer.Root
		open={detailOpen}
		onOpenChange={(o) => {
			if (!o) selected = undefined;
		}}
	>
		<Drawer.Content>
			<Drawer.Header class="text-left">
				<Drawer.Title class="font-mono">{selected?.service}</Drawer.Title>
			</Drawer.Header>
			<div class="px-4 pb-6">
				{#if selected}{@render detailBody(selected)}{/if}
			</div>
		</Drawer.Content>
	</Drawer.Root>
{:else}
	<Sheet.Root
		open={detailOpen}
		onOpenChange={(o) => {
			if (!o) selected = undefined;
		}}
	>
		<Sheet.Content side="right" class="w-full gap-0 overflow-y-auto sm:max-w-md">
			<Sheet.Header>
				<Sheet.Title>{selected?.service}</Sheet.Title>
				<Sheet.Description>Deployment {selected?.id} · {selected?.env}</Sheet.Description>
			</Sheet.Header>
			<div class="p-4">
				{#if selected}{@render detailBody(selected)}{/if}
			</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}

<!-- rollback confirm -->
<AlertDialog.Root bind:open={rollbackOpen} onOpenChange={(o) => !o && (rollbackTarget = undefined)}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Roll back {rollbackTarget?.service}?</AlertDialog.Title>
			<AlertDialog.Description>
				Traffic shifts 100% to the previous healthy revision — {rollbackTarget?.env},
				{rollbackTarget?.region}. The current build stays in history marked as canceled.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Keep it running</AlertDialog.Cancel>
			<AlertDialog.Action onclick={confirmRollback}>Roll back now</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<DeployDialog />
