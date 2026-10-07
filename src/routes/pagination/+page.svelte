<script lang="ts">
	import CodeBlock from '$lib/demo/code-block.svelte';
	import Seo from '$lib/demo/seo.svelte';
	import Section from '$lib/demo/section.svelte';

	const cursorServer = `// GET /api/users?cursor=<opaque>&size=25&q=<query>   (cursor / keyset)
// The cursor is OPAQUE — encode the last row's sort key and never let
// clients construct it themselves.
app.get('/api/users', async (req, res) => {
  const size = Math.min(Number(req.query.size) || 25, 100);
  const cursor = req.query.cursor ? decode(req.query.cursor) : null;

  // index-backed range scan: WHERE (created_at, id) < (cursor.createdAt, cursor.id)
  const rows = await db.user.findMany({
    where: cursor
      ? { OR: [{ createdAt: { lt: cursor.createdAt } },
	      { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }
      : undefined,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: size + 1           // fetch one extra to detect hasMore
  });

  const hasMore = rows.length > size;
  const items = hasMore ? rows.slice(0, size) : rows;

  res.json({
    items,
    nextCursor: hasMore ? encode({ createdAt: items.at(-1).createdAt, id: items.at(-1).id }) : null,
    hasMore
  });
});`;

	const offsetServer = `// GET /api/products?page=0&size=20    (offset)
app.get('/api/products', async (req, res) => {
  const page = Math.max(Number(req.query.page) || 0, 0);
  const size = Math.min(Number(req.query.size) || 20, 100);

  const [items, total] = await Promise.all([
    db.product.findMany({ skip: page * size, take: size, orderBy: { id: 'asc' } }),
    db.product.count()
  ]);

  res.json({ items, page, size, total, hasMore: (page + 1) * size < total });
});`;

	const clientCursor = `import { SuiCombobox } from '$lib/sui/combobox/index.js';
	import { cursorSource } from '$lib/sui/pagination.js';

// adapts YOUR response envelope into a SuiSource
const users = cursorSource(async ({ cursor, size, query, signal }) => {
  const res = await fetch(\`/api/users?size=\${size}\${cursor ? '&cursor=' + cursor : ''}\`, { signal });
  const body = await res.json();
  return { items: body.items, nextCursor: body.nextCursor };
});

<SuiCombobox label="Owner" source={users} pageSize={25} bind:value={owner} />`;

	const clientOffset = `import { SuiMultiSelect } from '$lib/sui/multi-select/index.js';
	import { offsetSource } from '$lib/sui/pagination.js';

const products = offsetSource(async ({ page, size, query, signal }) => {
  const res = await fetch(\`/api/products?page=\${page}&size=\${size}\`, { signal });
  const body = await res.json();
  return { items: body.items, total: body.total };  // hasMore inferred
});

<SuiMultiSelect label="Products" source={products} bind:value={selected} />`;

	const rules = [
		{
			title: 'Always cap the page size',
			body: 'Clamp size server-side (…, 100). Uncapped limits are a self-inflicted DoS and break the "fetch one extra row" hasMore trick.'
		},
		{
			title: 'Sort order must be stable & unique',
			body: 'Always append a unique tiebreaker (usually id) to the ORDER BY. Without it, equal keys straddle page boundaries and rows jump between pages.'
		},
		{
			title: 'Prefer cursors for feeds & infinite scroll',
			body: 'OFFSET scans everything it skips — page 500 gets slower the deeper you go. Keyset cursors are O(page size) regardless of depth, and immune to row drift.'
		},
		{
			title: 'Offsets are fine for admin tables',
			body: 'When users jump to arbitrary pages, the data is bounded, and you need total counts — offset pagination is simpler and totally reasonable.'
		},
		{
			title: 'Deduplicate on the client',
			body: 'No strategy is perfect under concurrent writes. sui de-duplicates streamed items by key (default: item.value) so users never see doubles.'
		},
		{
			title: 'Abort superseded requests',
			body: 'Every SuiSource request carries an AbortSignal; when a new search fires, stale in-flight responses are discarded (request-id guard on top).'
		}
	];
</script>

<Seo path="/pagination" />

<h1 class="mb-8 text-3xl font-bold tracking-tight">REST Pagination Patterns</h1>

<p class="mb-10 max-w-3xl text-sm leading-relaxed text-muted-foreground">
	These are the backend conventions the sui selection components are built against. Both demos on
	the <a class="text-primary underline" href="/selection">Selection page</a> run against real
	endpoints in this app (<code>/api/users</code> cursor-style, <code>/api/products</code> offset-style)
	— open the network tab while scrolling to watch them work.
</p>

<Section
	title="Cursor pagination (recommended for infinite scroll)"
	description="Keyset scan on (created_at, id). O(1)-ish per page at any depth, stable under inserts. Fetch size+1 rows to compute hasMore."
>
	<CodeBlock title="server (express + prisma-style)" code={cursorServer} />
	<div class="mt-6">
		<CodeBlock title="client" code={clientCursor} />
	</div>
</Section>

<Section
	title="Offset pagination (fine for bounded admin data)"
	description="Simple skip/take with a total count. Watch for skipped/duplicated rows on high-churn tables — sui dedupes client-side."
>
	<CodeBlock title="server" code={offsetServer} />
	<div class="mt-6">
		<CodeBlock title="client" code={clientOffset} />
	</div>
</Section>

<Section title="Rules of thumb">
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each rules as rule (rule.title)}
			<div class="rounded-lg border bg-card p-4">
				<div class="mb-1.5 text-sm font-medium">{rule.title}</div>
				<p class="text-xs leading-relaxed text-muted-foreground">{rule.body}</p>
			</div>
		{/each}
	</div>
</Section>
