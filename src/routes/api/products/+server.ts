import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Dynamic endpoint (query-param driven) — opted out of the root layout's
// prerender = true so it stays a live server route in every deployment.
export const prerender = false;

/**
 * Offset-based paginated REST endpoint (Spring-style envelope):
 *
 * GET /api/products?page=0&size=20&q=<search>
 * → { items, page, size, total }
 */

type Product = { value: string; label: string; description: string };

const CATEGORIES = [
	'Keyboard',
	'Monitor',
	'Laptop',
	'Mouse',
	'Headset',
	'Webcam',
	'Dock',
	'Cable',
	'SSD',
	'RAM'
];
const TOTAL = 87;

function makeProduct(index: number): Product {
	const category = CATEGORIES[index % CATEGORIES.length]!;
	return {
		value: `sku-${1000 + index}`,
		label: `${category} ${String.fromCharCode(65 + (index % 26))}${Math.floor(index / 26) + 1}`,
		description: `SKU-${1000 + index} · in stock: ${((index * 7) % 50) + 1}`
	};
}

export const GET: RequestHandler = ({ url }) => {
	const size = Math.min(Math.max(Number(url.searchParams.get('size')) || 25, 1), 100);
	const page = Math.max(Number(url.searchParams.get('page')) || 0, 0);
	const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();

	const all = Array.from({ length: TOTAL }, (_, i) => makeProduct(i));
	const filtered = q
		? all.filter(
				(p) => p.label.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
			)
		: all;
	const items = filtered.slice(page * size, (page + 1) * size);

	return json(
		{ items, page, size, total: filtered.length },
		{ headers: { 'cache-control': 'no-store' } }
	);
};
