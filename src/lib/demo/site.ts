/**
 * Canonical site facts shared by the SEO head component, the sitemap and
 * robots.txt. Change SITE_ORIGIN when deploying to a real domain
 * (or set PUBLIC_SITE_URL at build time) — everything else follows.
 */
export const SITE_ORIGIN = 'https://sui-demo.vercel.app';

export const SITE_NAME = 'sui';

export const SITE_DESCRIPTION =
	'Opinionated Svelte 5 + shadcn-svelte component library: one-liner form fields with zod v4 validation, infinite-scroll selects backed by REST, and a virtualized TanStack data table.';

export type SiteRoute = { path: string; title: string; description: string };

export const SITE_ROUTES: SiteRoute[] = [
	{
		path: '/',
		title: 'Home',
		description: SITE_DESCRIPTION
	},
	{
		path: '/button',
		title: 'Button',
		description:
			'Buttons, icon buttons and loading states with size-matched variants, icons and skeletons — one component, every affordance.'
	},
	{
		path: '/input',
		title: 'Input & Textarea',
		description:
			'Text inputs and textareas with labels, sub-text, icons, actions, mobile input modes and zod validation wired in a single line.'
	},
	{
		path: '/selection',
		title: 'Selection',
		description:
			'Select, combobox and multi-select fields with infinite REST scroll, responsive chips, clear buttons and mobile bottom sheets.'
	},
	{
		path: '/toggles',
		title: 'Toggles',
		description: 'Checkbox, switch and radio-group fields with validation, variants and size-matched skeletons.'
	},
	{
		path: '/data-table',
		title: 'Data Table',
		description:
			'Virtualized TanStack-powered data table: sorting, pagination, selection, column visibility, pinning and CSV export for huge datasets.'
	},
	{
		path: '/skeletons',
		title: 'Skeletons',
		description: 'Size-matched loading skeletons for every sui control, with optional label placeholders.'
	},
	{
		path: '/validation',
		title: 'Validation',
		description:
			'zod v4 field validation with blur-first timing, stale server-error clearing, error summaries and focus-first-invalid on submit.'
	},
	{
		path: '/pagination',
		title: 'Pagination & REST',
		description: 'Cursor and offset pagination sources for infinite scroll, with best-practice REST integration guides.'
	}
];

export const routeMeta = (path: string): SiteRoute =>
	SITE_ROUTES.find((r) => r.path === path) ?? { path, title: SITE_NAME, description: SITE_DESCRIPTION };
