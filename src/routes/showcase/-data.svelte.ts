/**
 * Deterministic mock data for the /showcase mission-control app.
 *
 * Everything is generated at module scope from a fixed seed, so the server
 * render and client hydration agree (no `Date.now()` / `Math.random()` in
 * render paths) and the output is stable across reloads.
 */
import { today, getLocalTimeZone } from '@internationalized/date';

/* ------------------------------------------------------------------ rng -- */

/** Tiny deterministic PRNG — same seed, same sequence, server and client. */
function mulberry32(seed: number) {
	let a = seed;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
const rng = mulberry32(0x5eed);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!;
const int = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

/* --------------------------------------------------------------- people -- */

export type PersonStatus = 'online' | 'busy' | 'away';
export type Person = {
	id: string;
	name: string;
	role: string;
	initials: string;
	hue: number;
	status: PersonStatus;
	tz: string;
	email: string;
	pronouns: string;
};

export const PEOPLE: Person[] = [
	{ id: 'ada', name: 'Ada Okafor', role: 'Platform lead', initials: 'AO', hue: 262, status: 'online', tz: 'UTC+1', email: 'ada@nimbus.dev', pronouns: 'she/her' },
	{ id: 'lin', name: 'Lin Zhang', role: 'Site reliability', initials: 'LZ', hue: 195, status: 'busy', tz: 'UTC+8', email: 'lin@nimbus.dev', pronouns: 'they/them' },
	{ id: 'grace', name: 'Grace Mensah', role: 'Frontend', initials: 'GM', hue: 330, status: 'online', tz: 'UTC+0', email: 'grace@nimbus.dev', pronouns: 'she/her' },
	{ id: 'nikos', name: 'Nikos Papadakis', role: 'Backend', initials: 'NP', hue: 145, status: 'away', tz: 'UTC+2', email: 'nikos@nimbus.dev', pronouns: 'he/him' },
	{ id: 'maya', name: 'Maya Kapoor', role: 'Product design', initials: 'MK', hue: 25, status: 'online', tz: 'UTC+5:30', email: 'maya@nimbus.dev', pronouns: 'she/her' },
	{ id: 'tomas', name: 'Tomás Silva', role: 'Quality engineering', initials: 'TS', hue: 220, status: 'busy', tz: 'UTC-3', email: 'tomas@nimbus.dev', pronouns: 'he/him' },
	{ id: 'yuki', name: 'Yuki Watanabe', role: 'Data platform', initials: 'YW', hue: 280, status: 'away', tz: 'UTC+9', email: 'yuki@nimbus.dev', pronouns: 'she/her' },
	{ id: 'omar', name: 'Omar Haddad', role: 'Security', initials: 'OH', hue: 95, status: 'online', tz: 'UTC+3', email: 'omar@nimbus.dev', pronouns: 'he/him' }
];

export const person = (id: string): Person => PEOPLE.find((p) => p.id === id) ?? PEOPLE[0]!;
export const ON_CALL = ['lin', 'omar', 'grace'];

/* --------------------------------------------------------------- issues -- */

export type LabelKey = 'bug' | 'feature' | 'chore' | 'design' | 'infra' | 'docs';
export const LABELS: Record<LabelKey, { label: string; className: string }> = {
	bug: { label: 'bug', className: 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300' },
	feature: { label: 'feature', className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
	chore: { label: 'chore', className: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300' },
	design: { label: 'design', className: 'border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300' },
	infra: { label: 'infra', className: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300' },
	docs: { label: 'docs', className: 'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300' }
};
export const LABEL_KEYS = Object.keys(LABELS) as LabelKey[];

export type Priority = 'urgent' | 'high' | 'medium' | 'low';
export const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
export const PRIORITY_LABEL: Record<Priority, string> = { urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' };

export type IssueStatus = 'backlog' | 'progress' | 'review' | 'done';
export const STATUSES: { key: IssueStatus; label: string; dot: string }[] = [
	{ key: 'backlog', label: 'Backlog', dot: 'bg-zinc-400' },
	{ key: 'progress', label: 'In progress', dot: 'bg-blue-500' },
	{ key: 'review', label: 'In review', dot: 'bg-amber-500' },
	{ key: 'done', label: 'Done', dot: 'bg-emerald-500' }
];

export type Issue = {
	id: string;
	title: string;
	description: string;
	status: IssueStatus;
	priority: Priority;
	labels: LabelKey[];
	assignees: string[];
	points: number;
	createdAgo: string;
	comments: number;
	checklistDone: number;
	checklistTotal: number;
};

export const ISSUES: Issue[] = [
	{ id: 'NMB-241', title: 'Edge cache purges take >30s in eu-west-1', description: 'Since the 2.4 rollout, purge requests queue behind the new shard mapper. Users see stale assets for up to half a minute. Reproduced at 4k RPS on staging.', status: 'progress', priority: 'urgent', labels: ['bug', 'infra'], assignees: ['lin', 'nikos'], points: 8, createdAgo: '2h ago', comments: 14, checklistDone: 3, checklistTotal: 5 },
	{ id: 'NMB-240', title: 'Deploy rollback leaves canary weights stuck at 5%', description: 'When a rollback races the canary promoter, weights never return to 100% and traffic stays on the old revision. Needs an idempotent reconciler.', status: 'progress', priority: 'high', labels: ['bug'], assignees: ['ada'], points: 5, createdAgo: '5h ago', comments: 7, checklistDone: 1, checklistTotal: 4 },
	{ id: 'NMB-238', title: 'Dark mode contrast audit for the status page', description: 'The incident banner and severity chips fail AA in dark mode. Maya prepared a contrast matrix — apply the new tokens everywhere.', status: 'review', priority: 'medium', labels: ['design'], assignees: ['maya', 'grace'], points: 3, createdAgo: '1d ago', comments: 4, checklistDone: 2, checklistTotal: 2 },
	{ id: 'NMB-237', title: 'Ship deploy hooks (pre-flight + post-flight)', description: 'Let services register shell hooks that gate a deploy. Run pre-flight against a hermetic env; post-flight unlocks the promotion.', status: 'backlog', priority: 'high', labels: ['feature', 'infra'], assignees: ['nikos'], points: 8, createdAgo: '1d ago', comments: 11, checklistDone: 0, checklistTotal: 6 },
	{ id: 'NMB-236', title: 'Flaky e2e: billing checkout times out on cold cache', description: 'The checkout spec fails ~7% of runs when the fixture cache is cold. Suspect a 30s default timeout hiding a slow bootstrap.', status: 'review', priority: 'medium', labels: ['bug', 'chore'], assignees: ['tomas'], points: 2, createdAgo: '2d ago', comments: 9, checklistDone: 4, checklistTotal: 4 },
	{ id: 'NMB-234', title: 'Surface failed deployments in the weekly digest', description: 'The Monday digest only reports successes. Add a failures section with links to logs and the owning on-call rotation.', status: 'backlog', priority: 'low', labels: ['feature', 'docs'], assignees: ['yuki'], points: 3, createdAgo: '3d ago', comments: 2, checklistDone: 0, checklistTotal: 3 },
	{ id: 'NMB-233', title: 'Rotate the incident-response runbook into the app', description: 'The runbook lives in a wiki nobody opens at 3am. Embed it as a command-palette action so it is two keystrokes away.', status: 'backlog', priority: 'medium', labels: ['docs'], assignees: ['omar'], points: 2, createdAgo: '3d ago', comments: 6, checklistDone: 1, checklistTotal: 2 },
	{ id: 'NMB-231', title: 'Canary dashboards miss the p99 tail', description: 'The promoted dashboard plots p50/p95 only. Add p99 and a saturation panel so we stop promoting on lucky medians.', status: 'progress', priority: 'medium', labels: ['feature'], assignees: ['yuki', 'lin'], points: 5, createdAgo: '4d ago', comments: 3, checklistDone: 2, checklistTotal: 5 },
	{ id: 'NMB-229', title: 'Onboarding: first deploy in under 3 minutes', description: 'Time-to-first-deploy for a new service is 11 minutes. Kill the manifest step, pre-select sane defaults, add a sample app.', status: 'review', priority: 'high', labels: ['feature', 'design'], assignees: ['maya', 'grace', 'ada'], points: 8, createdAgo: '5d ago', comments: 17, checklistDone: 6, checklistTotal: 6 },
	{ id: 'NMB-227', title: 'Maintenance window for the audit log migration', description: 'Move the audit log to the new column-family store. 40 minutes of read-only mode, scheduled for Saturday 02:00 UTC.', status: 'backlog', priority: 'low', labels: ['infra', 'chore'], assignees: ['nikos', 'omar'], points: 5, createdAgo: '6d ago', comments: 1, checklistDone: 0, checklistTotal: 3 },
	{ id: 'NMB-225', title: 'Semantic versions in the deployment table', description: 'Show semver chips instead of raw hashes for tagged builds, with a tooltip carrying the full SHA.', status: 'done', priority: 'medium', labels: ['feature'], assignees: ['grace'], points: 2, createdAgo: '1w ago', comments: 5, checklistDone: 3, checklistTotal: 3 },
	{ id: 'NMB-222', title: 'Cut 2.4.1 patch release', description: 'Cherry-pick the cache-purge fix, the canary reconciler and two doc fixes. Tag, build, promote.', status: 'done', priority: 'urgent', labels: ['infra'], assignees: ['ada', 'lin'], points: 3, createdAgo: '1w ago', comments: 8, checklistDone: 4, checklistTotal: 4 },
	{ id: 'NMB-220', title: 'Kill the legacy /v1 deploy endpoint', description: 'Nobody has called /v1 in 90 days. Delete the routes, the feature flag and the 1,200 lines behind them.', status: 'backlog', priority: 'low', labels: ['chore'], assignees: [], points: 5, createdAgo: '1w ago', comments: 2, checklistDone: 0, checklistTotal: 2 },
	{ id: 'NMB-218', title: 'Slack notifications for failed production deploys', description: 'Route build failures to #deploys with a permalink to the failing step and the author of the commit.', status: 'done', priority: 'high', labels: ['feature'], assignees: ['tomas'], points: 3, createdAgo: '2w ago', comments: 10, checklistDone: 5, checklistTotal: 5 }
];

/* ---------------------------------------------------------- deployments -- */

export type DeployStatus = 'success' | 'building' | 'failed' | 'canceled' | 'queued';
export type Env = 'production' | 'staging' | 'preview';
export type Deployment = {
	id: string;
	service: string;
	env: Env;
	version: string;
	branch: string;
	sha: string;
	commitMsg: string;
	authorId: string;
	startedMin: number;
	started: string;
	durationSec: number;
	duration: string;
	status: DeployStatus;
	region: string;
};

export const SERVICES = [
	'web-gateway', 'auth-api', 'billing-worker', 'search-indexer',
	'media-pipeline', 'realtime-hub', 'notifications', 'edge-cache'
] as const;
export const ENVS: Env[] = ['production', 'staging', 'preview'];
export const REGIONS = ['iad-1', 'fra-1', 'sin-1', 'sfo-1'];

const DEPLOY_STATUS_WEIGHTS: [DeployStatus, number][] = [
	['success', 84], ['failed', 7], ['building', 3], ['canceled', 3], ['queued', 3]
];
function pickStatus(): DeployStatus {
	const r = rng() * 100;
	let acc = 0;
	for (const [s, w] of DEPLOY_STATUS_WEIGHTS) {
		acc += w;
		if (r < acc) return s;
	}
	return 'success';
}

const COMMIT_MSGS = [
	'fix: bound the purge queue, add backpressure test',
	'feat: pre-flight deploy hooks behind a flag',
	'chore: bump toolchain, drop dead deps',
	'perf: memoize shard mapper lookups',
	'refactor: extract canary reconciler',
	'docs: rewrite the rollback runbook',
	'fix: guard nil pointer in billing replay',
	'feat: p99 tiles on the canary dashboard',
	'test: freeze time in checkout e2e',
	'fix: correct stale asset TTL math',
	'feat: semver chips in the deploy table',
	'chore: drop /v1 deploy routes'
];

function ago(min: number): string {
	if (min < 60) return `${min}m ago`;
	if (min < 60 * 24) return `${Math.floor(min / 60)}h ago`;
	return `${Math.floor(min / (60 * 24))}d ago`;
}
function dur(sec: number): string {
	if (sec < 60) return `${sec}s`;
	return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export function makeDeployments(count: number): Deployment[] {
	return Array.from({ length: count }, (_, i) => {
		const startedMin = int(2, 60 * 24 * 12);
		const durationSec = int(38, 640);
		return {
			id: `dpl_${(0x8a00 + i * 7).toString(16)}`,
			service: pick(SERVICES),
			env: (rng() < 0.45 ? 'production' : rng() < 0.6 ? 'staging' : 'preview') as Env,
			version: `2.${int(0, 5)}.${int(0, 9)}`,
			branch: pick(['main', 'main', 'release/2.4', 'feat/hooks', 'fix/purge-queue', 'chore/toolchain']),
			sha: Array.from({ length: 7 }, () => '0123456789abcdef'[int(0, 15)]).join(''),
			commitMsg: pick(COMMIT_MSGS),
			authorId: pick(PEOPLE).id,
			startedMin,
			started: ago(startedMin),
			durationSec,
			duration: dur(durationSec),
			status: pickStatus(),
			region: pick(REGIONS)
		};
	}).sort((a, b) => a.startedMin - b.startedMin);
}

/** 400 rows — big enough to prove virtualization, small enough to ship. */
export const DEPLOYMENTS: Deployment[] = makeDeployments(400);

/* --------------------------------------------------------------- events -- */

export const TODAY = today(getLocalTimeZone());
export const dayKey = (offset: number): string => TODAY.add({ days: offset }).toString();

export type EventKind = 'standup' | 'review' | 'incident' | 'release' | 'one-on-one' | 'oncall';
export const EVENT_KINDS: Record<EventKind, { label: string; chip: string; dot: string }> = {
	standup: { label: 'Standup', chip: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300', dot: 'bg-sky-500' },
	review: { label: 'Design review', chip: 'border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300', dot: 'bg-fuchsia-500' },
	incident: { label: 'Incident', chip: 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300', dot: 'bg-red-500' },
	release: { label: 'Release', chip: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
	'one-on-one': { label: '1:1', chip: 'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' },
	oncall: { label: 'On-call', chip: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' }
};

export type CalEvent = {
	id: string;
	title: string;
	kind: EventKind;
	dayOffset: number;
	start: string;
	minutes: number;
	people: string[];
	location?: string;
};

export const EVENTS: CalEvent[] = [
	{ id: 'e1', title: 'Platform standup', kind: 'standup', dayOffset: 0, start: '09:30', minutes: 15, people: ['ada', 'lin', 'grace', 'nikos'] },
	{ id: 'e2', title: 'Canary reconciler design review', kind: 'review', dayOffset: 0, start: '11:00', minutes: 45, people: ['ada', 'maya', 'nikos'], location: 'Huddle B' },
	{ id: 'e3', title: 'eu-west-1 cache purge follow-up', kind: 'incident', dayOffset: 0, start: '14:00', minutes: 30, people: ['lin', 'omar'] },
	{ id: 'e4', title: 'Ship 2.4.1 patch', kind: 'release', dayOffset: 1, start: '10:00', minutes: 60, people: ['ada', 'lin'] },
	{ id: 'e5', title: '1:1 — Ada & Grace', kind: 'one-on-one', dayOffset: 1, start: '15:30', minutes: 30, people: ['ada', 'grace'] },
	{ id: 'e6', title: 'On-call handover (APAC)', kind: 'oncall', dayOffset: 2, start: '08:00', minutes: 20, people: ['lin', 'yuki'] },
	{ id: 'e7', title: 'Billing checkout flake triage', kind: 'incident', dayOffset: 2, start: '13:00', minutes: 30, people: ['tomas', 'nikos'] },
	{ id: 'e8', title: 'Deploy hooks spike review', kind: 'review', dayOffset: 3, start: '11:30', minutes: 45, people: ['nikos', 'ada', 'omar'], location: 'Huddle A' },
	{ id: 'e9', title: 'Time-to-first-deploy workshop', kind: 'review', dayOffset: 4, start: '09:00', minutes: 90, people: ['maya', 'grace', 'ada'] },
	{ id: 'e10', title: 'Platform standup', kind: 'standup', dayOffset: 5, start: '09:30', minutes: 15, people: ['ada', 'lin', 'grace', 'nikos', 'maya'] },
	{ id: 'e11', title: 'Audit-log maintenance window', kind: 'oncall', dayOffset: 6, start: '02:00', minutes: 40, people: ['nikos', 'omar'] },
	{ id: 'e12', title: '2.5 planning', kind: 'review', dayOffset: 7, start: '10:00', minutes: 60, people: ['ada', 'maya', 'yuki', 'tomas'] },
	{ id: 'e13', title: 'Security patch sync', kind: 'oncall', dayOffset: -2, start: '16:00', minutes: 30, people: ['omar', 'lin'] },
	{ id: 'e14', title: 'Retro — 2.4 rollout', kind: 'review', dayOffset: -1, start: '15:00', minutes: 45, people: ['ada', 'lin', 'grace', 'nikos', 'tomas', 'maya'] }
];

/* -------------------------------------------------------------- activity -- */

export type ActivityKind = 'deploy' | 'issue' | 'comment' | 'incident' | 'security';
export type Activity = {
	id: string;
	who: string;
	action: string;
	target: string;
	when: string;
	kind: ActivityKind;
};

export const ACTIVITY: Activity[] = [
	{ id: 'a1', who: 'lin', action: 'promoted', target: 'auth-api 2.4.1 → production', when: '12m ago', kind: 'deploy' },
	{ id: 'a2', who: 'tomas', action: 'linked a flaky test to', target: 'NMB-236', when: '34m ago', kind: 'issue' },
	{ id: 'a3', who: 'omar', action: 'closed the security finding on', target: 'billing-worker tokens', when: '1h ago', kind: 'security' },
	{ id: 'a4', who: 'ada', action: 'commented on', target: 'NMB-240 — canary weights', when: '2h ago', kind: 'comment' },
	{ id: 'a5', who: 'nikos', action: 'opened a PR for', target: 'pre-flight deploy hooks', when: '3h ago', kind: 'issue' },
	{ id: 'a6', who: 'yuki', action: 'published', target: 'deploy digest w/c 14', when: '5h ago', kind: 'deploy' },
	{ id: 'a7', who: 'grace', action: 'shipped dark-mode tokens to', target: 'status page', when: '7h ago', kind: 'deploy' },
	{ id: 'a8', who: 'lin', action: 'resolved the incident on', target: 'eu-west-1 purge queue', when: '9h ago', kind: 'incident' },
	{ id: 'a9', who: 'maya', action: 'attached the contrast matrix to', target: 'NMB-238', when: '11h ago', kind: 'comment' },
	{ id: 'a10', who: 'omar', action: 'approved the runbook migration of', target: 'NMB-233', when: '1d ago', kind: 'issue' },
	{ id: 'a11', who: 'tomas', action: 'green-stamped', target: '2.4.1 release candidate', when: '1d ago', kind: 'deploy' },
	{ id: 'a12', who: 'yuki', action: 'flagged a p99 regression on', target: 'realtime-hub canary', when: '1d ago', kind: 'incident' },
	{ id: 'a13', who: 'ada', action: 'pinned the maintenance window for', target: 'audit-log migration', when: '2d ago', kind: 'issue' },
	{ id: 'a14', who: 'grace', action: 'merged', target: 'semver chips in the deploy table', when: '2d ago', kind: 'deploy' }
];

/* -------------------------------------------------------------- releases -- */

export type Release = {
	version: string;
	name: string;
	gradient: string;
	highlights: string[];
	shipped: string;
};

export const RELEASES: Release[] = [
	{ version: '2.4.1', name: 'Purge Queue', gradient: 'from-orange-400 via-amber-500 to-rose-500', highlights: ['Bounded purge queue with backpressure', 'Idempotent canary reconciler', 'Semver chips in the deploy table'], shipped: 'today' },
	{ version: '2.4.0', name: 'Horizon', gradient: 'from-sky-400 via-blue-500 to-indigo-600', highlights: ['Multi-region shard mapper', 'Deploy hooks (beta)', 'New canary dashboards'], shipped: '6d ago' },
	{ version: '2.3.2', name: 'Fog lifter', gradient: 'from-emerald-400 via-teal-500 to-cyan-600', highlights: ['p99 tiles on every board', 'Audit log compaction', '40% faster cold starts'], shipped: '2w ago' },
	{ version: '2.3.0', name: 'Anvil', gradient: 'from-violet-400 via-purple-500 to-fuchsia-600', highlights: ['Hermetic pre-flight envs', 'Traffic replay for canaries', 'Column-family audit log'], shipped: '1mo ago' },
	{ version: '2.2.4', name: 'Squall', gradient: 'from-rose-400 via-pink-500 to-red-500', highlights: ['Rollback drill automation', 'Incident timelines', 'Slack deploy digests'], shipped: '1mo ago' },
	{ version: '2.2.0', name: 'Tailwind', gradient: 'from-lime-400 via-green-500 to-emerald-600', highlights: ['Edge cache everywhere', 'Log tail streaming', 'Keyboard-first nav'], shipped: '2mo ago' }
];

/* -------------------------------------------------------------- billing -- */

export type Invoice = { id: string; date: string; amount: string; status: 'paid' | 'due' | 'overdue'; plan: string };

export const INVOICES: Invoice[] = [
	{ id: 'INV-2041', date: 'Apr 1, 2026', amount: '$412.00', status: 'paid', plan: 'Scale · 12 seats' },
	{ id: 'INV-2018', date: 'Mar 1, 2026', amount: '$398.00', status: 'paid', plan: 'Scale · 12 seats' },
	{ id: 'INV-1994', date: 'Feb 1, 2026', amount: '$398.00', status: 'paid', plan: 'Scale · 12 seats' },
	{ id: 'INV-1970', date: 'Jan 1, 2026', amount: '$371.00', status: 'paid', plan: 'Scale · 11 seats' },
	{ id: 'INV-1945', date: 'Dec 1, 2025', amount: '$371.00', status: 'paid', plan: 'Scale · 11 seats' },
	{ id: 'INV-1921', date: 'Nov 1, 2025', amount: '$349.00', status: 'paid', plan: 'Scale · 10 seats' }
];

export const USAGE = { storagePct: 68, opsPct: 41, seats: 12, seatsMax: 15 };

export type NotifPref = { id: string; label: string; description: string; email: boolean; push: boolean; slack: boolean };
export const NOTIF_PREFS: NotifPref[] = [
	{ id: 'deploy', label: 'Deployments', description: 'Build start, promotion and rollback events for your services', email: true, push: true, slack: true },
	{ id: 'incident', label: 'Incidents', description: 'New incidents, escalations and resolutions in your regions', email: true, push: true, slack: true },
	{ id: 'mentions', label: 'Mentions & replies', description: 'Someone @-mentions you or replies to your comment', email: true, push: true, slack: false },
	{ id: 'issues', label: 'Issue assignments', description: 'Issues assigned to you or moved on a board you watch', email: true, push: false, slack: false },
	{ id: 'digest', label: 'Weekly digest', description: 'Monday morning summary of deploys, failures and drift', email: true, push: false, slack: false },
	{ id: 'security', label: 'Security advisories', description: 'CVEs touching your runtime and base images', email: true, push: false, slack: true },
	{ id: 'billing', label: 'Billing', description: 'Usage thresholds, receipts and plan changes', email: false, push: false, slack: false }
];

/* ---------------------------------------------------------------- charts -- */

export type Range = '7d' | '30d' | '90d';
const RANGE_DAYS: Record<Range, number> = { '7d': 7, '30d': 30, '90d': 90 };

function fmtDay(offsetFromEnd: number, total: number): string {
	// MM/DD label relative to the end of the series ("now")
	return TODAY.add({ days: offsetFromEnd - total + 1 }).toString().slice(5).replace('-', '/');
}

/** Deploys + failures per day for a given range — seeded, stable. */
export const DEPLOY_SERIES: Record<Range, { date: string; deploys: number; failures: number }[]> = {
	'7d': [], '30d': [], '90d': []
};
for (const r of ['7d', '30d', '90d'] as Range[]) {
	const total = RANGE_DAYS[r];
	const arr: { date: string; deploys: number; failures: number }[] = [];
	for (let i = 0; i < total; i++) {
		const day = TODAY.add({ days: i - total + 1 });
		const weekend = day.day % 6 === 0; // Sat=6, Sun=7 → 6%6=0, 7%6=1 … close enough
		const base = weekend ? 14 : 34;
		const deploys = Math.round(base + 14 * Math.sin(i / 2.4) + int(-6, 6));
		arr.push({
			date: fmtDay(i, total),
			deploys: Math.max(4, deploys),
			failures: Math.max(0, Math.round(deploys * (0.04 + rng() * 0.06)))
		});
	}
	DEPLOY_SERIES[r] = arr;
}

export const LATENCY_SERIES = Array.from({ length: 30 }, (_, i) => ({
	date: fmtDay(i, 30),
	p50: Math.round(38 + 6 * Math.sin(i / 3) + rng() * 4),
	p95: Math.round(120 + 26 * Math.sin(i / 2.1 + 1) + rng() * 14)
}));

export const USAGE_SERIES = [
	{ month: 'May', storage: 41, bandwidth: 62 },
	{ month: 'Jun', storage: 46, bandwidth: 71 },
	{ month: 'Jul', storage: 52, bandwidth: 66 },
	{ month: 'Aug', storage: 49, bandwidth: 78 },
	{ month: 'Sep', storage: 57, bandwidth: 83 },
	{ month: 'Oct', storage: 61, bandwidth: 88 }
];

export const SLOS = [
	{ label: 'API availability', value: 99.97, target: 99.9, tone: 'bg-emerald-500' },
	{ label: 'Deploy success rate', value: 94.2, target: 95, tone: 'bg-amber-500' },
	{ label: 'p95 cold starts under 200ms', value: 82, target: 90, tone: 'bg-emerald-500' }
];

/* ------------------------------------------------------------ stat tiles -- */

export const STAT_TILES = [
	{
		label: 'Deploys this week',
		value: '218',
		delta: 12.4,
		up: true,
		spark: [12, 14, 13, 16, 15, 18, 17, 21, 19, 24, 22, 26],
		color: 'var(--chart-1)'
	},
	{
		label: 'Failed deploys',
		value: '9',
		delta: 3.1,
		up: false,
		spark: [4, 6, 5, 7, 6, 9, 8, 7, 11, 9, 8, 9],
		color: 'var(--chart-5)'
	},
	{
		label: 'Mean build time',
		value: '2m 41s',
		delta: 8.7,
		up: true,
		spark: [210, 196, 202, 188, 178, 181, 172, 166, 170, 161, 158, 152],
		color: 'var(--chart-2)'
	},
	{
		label: 'Services online',
		value: '8 / 8',
		delta: 0,
		up: true,
		spark: [8, 8, 8, 7, 8, 8, 8, 8, 8, 8, 8, 8],
		color: 'var(--chart-3)'
	}
];
