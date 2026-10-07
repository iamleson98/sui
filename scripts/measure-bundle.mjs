// Measures real per-page JS payload against the built preview server.
// Files are collected from PerformanceResourceTiming, then re-fetched fresh
// (browser cache would report 0 bytes for repeat views).
// Usage: node scripts/measure-bundle.mjs (expects preview on :4173)
import { chromium, request } from '@playwright/test';

const BASE = 'http://localhost:4173';
const PAGES = ['/', '/button', '/input', '/selection', '/toggles', '/data-table', '/validation'];

const browser = await chromium.launch();
const api = await request.newContext();

async function jsFor(path, settle = 400) {
	const page = await browser.newPage();
	await page.goto(BASE + path, { waitUntil: 'networkidle' });
	await page.waitForTimeout(settle);
	const names = await page.evaluate(() =>
		performance
			.getEntriesByType('resource')
			.filter((e) => e.name.endsWith('.js') && e.name.includes('/_app/immutable/'))
			.map((e) => e.name)
	);
	await page.close();
	return names;
}

async function size(url) {
	const r = await api.get(url);
	return (await r.body()).length;
}

console.log(
	'page'.padEnd(14) + 'js files'.padStart(9) + 'raw KB'.padStart(9) + 'gzip KB'.padStart(10)
);
const perPage = {};
for (const path of PAGES) {
	const names = [...new Set(await jsFor(path))];
	const sizes = await Promise.all(names.map((n) => size(n)));
	const raw = Math.round(sizes.reduce((a, b) => a + b, 0) / 1024);
	perPage[path] = new Map(names.map((n, i) => [n, sizes[i]]));
	console.log(path.padEnd(14) + String(names.length).padStart(9) + String(raw).padStart(9));
}

// data-table-only JS (loaded for /data-table but not /button)
const dtNames = [...new Set(await jsFor('/data-table', 1500))];
const buttonSet = perPage['/button'];
const unique = [];
for (const n of dtNames) {
	if (!buttonSet.has(n)) unique.push([n, await size(n)]);
}
const uniqueKb = Math.round(unique.reduce((n, [, s]) => n + s, 0) / 1024);
console.log(`\ndata-table-only JS (not loaded by /button): ${unique.length} files, ${uniqueKb} KB`);
for (const [n, s] of unique.sort((a, b) => b[1] - a[1]).slice(0, 8)) {
	console.log(`  ${String(Math.round(s / 1024)).padStart(4)} KB  ${n.split('/').pop()}`);
}

// the heaviest files on /button — should NOT contain the table engine
const heaviest = [...perPage['/button'].entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
console.log('\nheaviest files on /button:');
for (const [n, s] of heaviest)
	console.log(`  ${String(Math.round(s / 1024)).padStart(4)} KB  ${n.split('/').pop()}`);

await browser.close();
await api.dispose();
