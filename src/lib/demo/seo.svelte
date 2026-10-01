<script lang="ts">
	import { SITE_ORIGIN, SITE_NAME, routeMeta } from '$lib/demo/site';

	// Optional overrides; defaults come from the shared route table.
	let {
		path,
		title,
		description
	}: {
		path: string;
		title?: string;
		description?: string;
	} = $props();

	const meta = $derived(routeMeta(path));
	const fullTitle = $derived(title ?? meta.title);
	const desc = $derived(description ?? meta.description);
	const url = $derived(`${SITE_ORIGIN}${path === '/' ? '' : path}`);
</script>

<svelte:head>
	<title>{fullTitle} · {SITE_NAME}</title>
	<meta name="description" content={desc} />
	<link rel="canonical" href={url} />

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:title" content={fullTitle} />
	<meta property="og:description" content={desc} />
	<meta property="og:url" content={url} />

	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={fullTitle} />
	<meta name="twitter:description" content={desc} />
</svelte:head>
