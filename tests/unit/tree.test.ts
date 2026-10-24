import { describe, expect, it } from 'vitest';
import { SuiTreeIndex, treeKey, type SuiTreeItem } from '$lib/sui/tree';

const items: SuiTreeItem[] = [
	{
		value: 'math',
		label: 'Toán học',
		children: [
			{ value: 'g1', label: 'Lớp 1' },
			{
				value: 'g2',
				label: 'Lớp 2',
				children: [{ value: 'frac', label: 'Phân số' }]
			},
			{ value: 'off', label: 'Đại học', disabled: true }
		]
	},
	{ value: 'eng', label: 'Tiếng Anh' }
];

const values = (rows: { node: { item: { value: string } } }[]) =>
	rows.map((r) => r.node.item.value);

describe('SuiTreeIndex', () => {
	const tree = new SuiTreeIndex(items);

	it('finds nodes, paths and ancestors', () => {
		expect(tree.get('frac')?.level).toBe(3);
		expect(tree.path('frac').map((n) => n.item.label)).toEqual(['Toán học', 'Lớp 2', 'Phân số']);
		expect(tree.ancestors('frac')).toEqual(['math', 'g2']);
		expect(tree.ancestors('math')).toEqual([]);
		expect(tree.path('nope')).toEqual([]);
		expect(tree.get(undefined)).toBeUndefined();
	});

	it('tells leaves from branches', () => {
		expect(tree.isLeaf(tree.get('g1')!)).toBe(true);
		expect(tree.isLeaf(tree.get('math')!)).toBe(false);
		expect(tree.branches()).toEqual(['math', 'g2']);
	});

	it('numbers siblings for the accessibility tree', () => {
		const second = tree.get('g2')!;
		expect([second.index, second.siblings, second.level]).toEqual([1, 3, 2]);
	});

	it('gives every node its own sequence number', () => {
		const seqs = ['math', 'g1', 'g2', 'frac', 'off', 'eng'].map((v) => tree.get(v)!.seq);
		expect(new Set(seqs).size).toBe(seqs.length);
	});

	describe('browsing', () => {
		it('lists the top level while everything is closed', () => {
			expect(values(tree.rows(new Set(), 'any'))).toEqual(['math', 'eng']);
		});

		it('unfolds open branches in place', () => {
			expect(values(tree.rows(new Set(['math']), 'any'))).toEqual([
				'math',
				'g1',
				'g2',
				'off',
				'eng'
			]);
			expect(values(tree.rows(new Set(['math', 'g2']), 'any'))).toEqual([
				'math',
				'g1',
				'g2',
				'frac',
				'off',
				'eng'
			]);
		});

		it('marks what can be chosen', () => {
			const rows = tree.rows(new Set(['math']), 'leaf');
			const choosable = Object.fromEntries(rows.map((r) => [r.node.item.value, r.selectable]));
			expect(choosable).toEqual({ math: false, g1: true, g2: false, off: false, eng: true });
			const any = tree.rows(new Set(['math']), 'any');
			expect(any.find((r) => r.node.item.value === 'math')?.selectable).toBe(true);
			expect(any.find((r) => r.node.item.value === 'off')?.selectable).toBe(false);
		});

		it('only a branch can be expanded', () => {
			const rows = tree.rows(new Set(['math']), 'any');
			expect(rows.map((r) => [r.node.item.value, r.expandable, r.expanded])).toEqual([
				['math', true, true],
				['g1', false, false],
				['g2', true, false],
				['off', false, false],
				['eng', false, false]
			]);
		});
	});

	describe('searching', () => {
		it('ignores accents and case, and shows where a node sits', () => {
			const rows = tree.search('LOP 1', 'any');
			expect(values(rows)).toEqual(['g1']);
			expect(rows[0].trail).toBe('Toán học');
		});

		it('matches the names above a node, so a family is found by its head', () => {
			expect(values(tree.search('toan', 'any'))).toEqual(['math', 'g1', 'g2', 'frac']);
			expect(values(tree.search('toan', 'leaf'))).toEqual(['g1', 'frac']);
		});

		it('needs every word', () => {
			expect(values(tree.search('toan phan', 'any'))).toEqual(['frac']);
			expect(tree.search('toan english', 'any')).toEqual([]);
		});

		it('nests the trail', () => {
			expect(tree.search('phan so', 'any')[0].trail).toBe('Toán học › Lớp 2');
		});

		it('does not list what cannot be chosen', () => {
			expect(values(tree.search('dai hoc', 'any'))).toEqual([]);
		});
	});
});

describe('treeKey', () => {
	const tree = new SuiTreeIndex(items);
	const rows = tree.rows(new Set(['math']), 'any');

	it('moves the highlight and stops at the ends', () => {
		expect(treeKey(rows, 'math', 'ArrowDown')).toEqual({ kind: 'highlight', value: 'g1' });
		expect(treeKey(rows, 'eng', 'ArrowDown')).toEqual({ kind: 'highlight', value: 'eng' });
		expect(treeKey(rows, 'g1', 'ArrowUp')).toEqual({ kind: 'highlight', value: 'math' });
		expect(treeKey(rows, 'math', 'ArrowUp')).toEqual({ kind: 'highlight', value: 'math' });
		expect(treeKey(rows, 'g1', 'Home')).toEqual({ kind: 'highlight', value: 'math' });
		expect(treeKey(rows, 'g1', 'End')).toEqual({ kind: 'highlight', value: 'eng' });
	});

	it('starts from the ends when nothing is highlighted', () => {
		expect(treeKey(rows, undefined, 'ArrowDown')).toEqual({ kind: 'highlight', value: 'math' });
		expect(treeKey(rows, undefined, 'ArrowUp')).toEqual({ kind: 'highlight', value: 'eng' });
	});

	it('Right opens a closed branch, then steps into it', () => {
		expect(treeKey(rows, 'g2', 'ArrowRight')).toEqual({ kind: 'expand', value: 'g2' });
		expect(treeKey(rows, 'math', 'ArrowRight')).toEqual({ kind: 'highlight', value: 'g1' });
		expect(treeKey(rows, 'g1', 'ArrowRight')).toEqual({ kind: 'none' });
	});

	it('Left closes an open branch, then steps up', () => {
		expect(treeKey(rows, 'math', 'ArrowLeft')).toEqual({ kind: 'collapse', value: 'math' });
		expect(treeKey(rows, 'g1', 'ArrowLeft')).toEqual({ kind: 'highlight', value: 'math' });
		expect(treeKey(rows, 'eng', 'ArrowLeft')).toEqual({ kind: 'none' });
	});

	it('leaves other keys to the caller', () => {
		expect(treeKey(rows, 'g1', 'Enter')).toEqual({ kind: 'none' });
		expect(treeKey([], undefined, 'ArrowDown')).toEqual({ kind: 'none' });
	});
});
