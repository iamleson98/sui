import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Cursor-based paginated REST endpoint (the recommended pattern for
 * infinite scroll — see /pagination for the full guide).
 *
 * GET /api/users?cursor=<opaque>&size=20&q=<search>
 * → { items, nextCursor, hasMore }
 */

type User = { value: string; label: string; description: string };

const FIRST_NAMES = ['Minh', 'Lena', 'Jonas', 'Aiko', 'Priya', 'Marco', 'Sofia', 'Kai', 'Nora', 'Omar', 'Elena', 'Tobias', 'Yuki', 'Ingrid', 'Pablo', 'Zara', 'Felix', 'Maya', 'Ravi', 'Clara'];
const LAST_NAMES = ['Nguyen', 'Schmidt', 'Tanaka', 'Patel', 'Rossi', 'Silva', 'Okafor', 'Novak', 'Kim', 'Dubois', 'Herrera', 'Berg', 'Larsen', 'Costa', 'Weber', 'Ivanov'];

const TOTAL = 512;

/** Deterministic pseudo-random generator so pagination is stable across requests. */
function mulberry32(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function makeUser(index: number): User {
	const rand = mulberry32(index * 7919 + 13);
	const first = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)]!;
	const last = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)]!;
	return {
		value: `user-${index}`,
		label: `${first} ${last}`,
		description: `Customer #${index + 1} · ${first.toLowerCase()}.${last.toLowerCase()}@example.com`
	};
}

function encodeCursor(index: number): string {
	return btoa(String(index)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function decodeCursor(cursor: string | null): number | null {
	if (!cursor) return null;
	try {
		const padded = cursor.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(cursor.length / 4) * 4, '=');
		const n = Number(atob(padded));
		return Number.isFinite(n) && n >= 0 ? n : null;
	} catch {
		return null;
	}
}

export const GET: RequestHandler = ({ url }) => {
	const size = Math.min(Math.max(Number(url.searchParams.get('size')) || 25, 1), 100);
	const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
	const cursorParam = url.searchParams.get('cursor');

	// Simulate a stable, index-backed keyset scan.
	const start = decodeCursor(cursorParam) ?? 0;
	const items: User[] = [];
	let index = start;
	while (items.length < size && index < TOTAL) {
		const user = makeUser(index);
		if (!q || user.label.toLowerCase().includes(q) || user.description.toLowerCase().includes(q)) {
			items.push(user);
		}
		index += 1;
	}

	const nextCursor = index < TOTAL ? encodeCursor(index) : null;
	return json(
		{ items, nextCursor, hasMore: nextCursor !== null },
		{ headers: { 'cache-control': 'no-store' } }
	);
};
