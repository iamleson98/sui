import { suiFold } from './search.js';

/** One option of a {@link SuiTreeSelect}: a node that may hold more nodes. */
export type SuiTreeItem<V extends string = string> = {
	value: V;
	label: string;
	/** Secondary text rendered below the label. */
	description?: string;
	/** Short trailing text, e.g. a count. */
	badge?: string | number;
	disabled?: boolean;
	children?: SuiTreeItem<V>[];
};

/** Which nodes can be chosen: any of them, or only those without children. */
export type SuiTreeSelectable = 'any' | 'leaf';

/** A node with its place in the tree. */
export type SuiTreeNode<V extends string = string> = {
	item: SuiTreeItem<V>;
	parent: SuiTreeNode<V> | undefined;
	/** 1 for the top level. */
	level: number;
	/** Position among its siblings (0-based) and their number. */
	index: number;
	siblings: number;
	/** Unique across the tree, for DOM ids. */
	seq: number;
};

/** One line of the list: a node as it is currently shown. */
export type SuiTreeRow<V extends string = string> = {
	node: SuiTreeNode<V>;
	expandable: boolean;
	expanded: boolean;
	selectable: boolean;
	/** Search results only: the names above the node, "Math › Grade 1". */
	trail: string;
};

export const SUI_TREE_SEPARATOR = ' › ';

/** The tree's nodes by value, built once per `items`. */
export class SuiTreeIndex<V extends string = string> {
	readonly roots: SuiTreeNode<V>[] = [];
	readonly #nodes = new Map<V, SuiTreeNode<V>>();
	readonly #children = new Map<SuiTreeNode<V>, SuiTreeNode<V>[]>();
	#seq = 0;

	constructor(items: SuiTreeItem<V>[]) {
		this.roots = this.#add(items, undefined, 1);
	}

	#add(items: SuiTreeItem<V>[], parent: SuiTreeNode<V> | undefined, level: number) {
		const nodes = items.map((item, index) => {
			const node: SuiTreeNode<V> = {
				item,
				parent,
				level,
				index,
				siblings: items.length,
				seq: this.#seq++
			};
			// the first of two nodes with one value wins, as for a flat list
			if (!this.#nodes.has(item.value)) this.#nodes.set(item.value, node);
			return node;
		});
		for (const node of nodes) {
			this.#children.set(node, this.#add(node.item.children ?? [], node, level + 1));
		}
		return nodes;
	}

	get(value: V | undefined): SuiTreeNode<V> | undefined {
		return value === undefined ? undefined : this.#nodes.get(value);
	}

	children(node: SuiTreeNode<V>): SuiTreeNode<V>[] {
		return this.#children.get(node) ?? [];
	}

	isLeaf(node: SuiTreeNode<V>): boolean {
		return this.children(node).length === 0;
	}

	/** The node's ancestors from the top level down, then the node itself. */
	path(value: V | undefined): SuiTreeNode<V>[] {
		const path: SuiTreeNode<V>[] = [];
		for (let node = this.get(value); node; node = node.parent) path.unshift(node);
		return path;
	}

	/** Values of the nodes above `value`: what must be open to show it. */
	ancestors(value: V | undefined): V[] {
		return this.path(value)
			.slice(0, -1)
			.map((node) => node.item.value);
	}

	/** Every node with children. */
	branches(): V[] {
		return [...this.#nodes.values()].filter((n) => !this.isLeaf(n)).map((n) => n.item.value);
	}

	#row(
		node: SuiTreeNode<V>,
		selectable: SuiTreeSelectable,
		expanded: boolean,
		trail = ''
	): SuiTreeRow<V> {
		const leaf = this.isLeaf(node);
		return {
			node,
			expandable: !leaf,
			expanded: !leaf && expanded,
			selectable: !node.item.disabled && (selectable === 'any' || leaf),
			trail
		};
	}

	/** The rows shown while browsing: open branches unfold their children. */
	rows(expanded: ReadonlySet<V>, selectable: SuiTreeSelectable): SuiTreeRow<V>[] {
		const rows: SuiTreeRow<V>[] = [];
		const walk = (nodes: SuiTreeNode<V>[]) => {
			for (const node of nodes) {
				const open = expanded.has(node.item.value);
				rows.push(this.#row(node, selectable, open));
				if (open) walk(this.children(node));
			}
		};
		walk(this.roots);
		return rows;
	}

	/**
	 * The rows matching a search, as a flat list in tree order. A node matches
	 * when every word of the search is in its own name or in the names above
	 * it, accents and case ignored, so "toan lop 1" finds "Lớp 1" under
	 * "Toán học". Only choosable nodes are listed.
	 */
	search(query: string, selectable: SuiTreeSelectable): SuiTreeRow<V>[] {
		const words = suiFold(query).split(/\s+/).filter(Boolean);
		const rows: SuiTreeRow<V>[] = [];
		const walk = (nodes: SuiTreeNode<V>[]) => {
			for (const node of nodes) {
				const path = this.path(node.item.value);
				const text = suiFold(
					path.map((n) => `${n.item.label} ${n.item.description ?? ''}`).join(' ')
				);
				const row = this.#row(
					node,
					selectable,
					false,
					path
						.slice(0, -1)
						.map((n) => n.item.label)
						.join(SUI_TREE_SEPARATOR)
				);
				if (row.selectable && words.every((word) => text.includes(word)))
					rows.push({ ...row, expandable: false });
				walk(this.children(node));
			}
		};
		walk(this.roots);
		return rows;
	}
}

/** What a key does to the highlighted row of a tree list. */
export type SuiTreeMove =
	| { kind: 'highlight'; value: string }
	| { kind: 'expand' | 'collapse'; value: string }
	| { kind: 'none' };

/**
 * The WAI-ARIA tree keys over the visible rows: Down/Up/Home/End move the
 * highlight, Right opens a branch (or steps into its first child), Left
 * closes one (or steps up to its parent). Enter and Space are the caller's:
 * they choose the row.
 */
export function treeKey<V extends string>(
	rows: SuiTreeRow<V>[],
	active: V | undefined,
	key: string
): SuiTreeMove {
	if (rows.length === 0) return { kind: 'none' };
	const at = rows.findIndex((r) => r.node.item.value === active);
	const go = (i: number): SuiTreeMove => ({
		kind: 'highlight',
		value: rows[Math.min(Math.max(i, 0), rows.length - 1)].node.item.value
	});
	switch (key) {
		case 'ArrowDown':
			return go(at + 1);
		case 'ArrowUp':
			return go(at < 0 ? rows.length - 1 : at - 1);
		case 'Home':
			return go(0);
		case 'End':
			return go(rows.length - 1);
		case 'ArrowRight': {
			const row = rows[at];
			if (!row?.expandable) return { kind: 'none' };
			if (!row.expanded) return { kind: 'expand', value: row.node.item.value };
			return rows[at + 1]?.node.parent === row.node ? go(at + 1) : { kind: 'none' };
		}
		case 'ArrowLeft': {
			const row = rows[at];
			if (!row) return { kind: 'none' };
			if (row.expanded) return { kind: 'collapse', value: row.node.item.value };
			return row.node.parent
				? { kind: 'highlight', value: row.node.parent.item.value }
				: { kind: 'none' };
		}
		default:
			return { kind: 'none' };
	}
}
