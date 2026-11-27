/**
 * What the Read offline page (/offline) and Settings > This device show about saving for offline reading
 * (site/DESIGN.md, section 10), as plain data, and the reader's choices as the service worker keeps them. The
 * outline of the site comes from the build's catalog (tools/write-offline-catalog.mjs): parts, their groups and, one
 * list at a time, their pages. What is saved comes from the service worker. OfflineSummary.svelte and
 * OfflineSavingView.svelte draw both, so the live page (OfflineSaving.svelte) and a fixed sample look the same.
 * Trevor asked on Nov. 24 and 26, 2026 for accurate counts and sizes, one modular outline in which a reader saves a
 * part, a group or a page, a view of only what they chose, and a quicker check for updates. Shared by
 * src/service-worker/index.ts, so it must not use the page or the worker's own globals.
 */

/** One node of the catalog: a part of the site, a group, or a run of pages in a long group. */
export interface CatalogNode {
	key: string;
	label: string;
	hint?: string;
	/** Pages in this build. */
	pages: number;
	/** Space the pages take once saved, from the built files. */
	bytes: number;
	/** What `pages` counts, when not pages: the documents this site holds. */
	unit?: 'document';
	/** One run of 50 pages of a long group, named by its first and last page. */
	run?: true;
	children?: CatalogNode[];
	/** Address of the list of this node's pages, read when the reader opens it. */
	list?: string;
}

export interface Catalog {
	version: string;
	parts: CatalogNode[];
}

/** One page in a list, as the catalog gives it. A nation's entry also holds its opinions and service pages. */
export interface CatalogPage {
	path: string;
	label: string;
	/** The files saved for the page, when they are not the usual two (filesOf). */
	files?: string[];
	bytes: number;
	/** For a nation's documents: how many there are. */
	count?: number;
}

/** What is saved of one node: kept counts from the worker. */
export interface NodeState {
	/** Pages saved because the reader chose them (the node, a node above it, or the page itself). */
	chosen: number;
	/** Space they take. */
	bytes: number;
	/** The waiting update changes this many of them. */
	changed?: number;
	/** Being saved now: pages done of pages to save. */
	saving?: { done: number; total: number };
}

/** What is saved of one page. */
export interface PageState {
	chosen?: boolean;
	/** Saved because the reader opened it, not chosen. */
	read?: boolean;
	changed?: boolean;
}

export interface UpdateCheck {
	checking: boolean;
	checkedAt?: Date;
	/** A newer version is ready: how many saved pages it changes and about how much they take. */
	waiting?: { changedPages: number; bytes: number };
}

export interface OfflineView {
	online: boolean;
	available: boolean;
	storage: { usedBytes?: number; persisted?: boolean };
	catalog?: Catalog;
	nodes: Record<string, NodeState>;
	pages: Record<string, PageState>;
	/** Pages saved because the reader opened them. */
	read: { pages: number; bytes: number };
	update: UpdateCheck;
	/** Chosen pages not saved yet (ChoicesStatus). */
	missing?: number;
	versions?: { content: string; site: string };
	builtOn?: Date;
	problem?: string;
}

/** A change the reader applies: a node of the catalog or a page (by its address) to save or to remove. */
export interface ChoiceChange {
	key: string;
	kind: 'node' | 'page';
	save: boolean;
}

/** A change the reader has ticked but not applied yet, with what it saves or frees. */
export interface PendingChange extends ChoiceChange {
	pages: number;
	bytes: number;
}

/**
 * What the reader chose to save, as the service worker keeps it: whole nodes of the catalog (parts and groups, never
 * runs, whose bounds move as pages are added) and single pages. Documents are kept with the copies themselves
 * (src/lib/offline-documents.ts).
 */
export interface Choices {
	nodes: string[];
	pages: string[];
}

/** What the service worker says is saved, for the outline and the summary. */
export interface ChoicesStatus {
	/** The build the saved pages come from. */
	version: string;
	nodes: Record<string, NodeState>;
	/** Each page that is chosen or saved, by address. */
	pages: Record<string, PageState>;
	read: { pages: number; bytes: number };
	/** A newer version is installed and waiting: how many saved pages it changes, and about how much they take. */
	waiting?: { changedPages: number; bytes: number };
	/** Chosen pages not saved yet: a save cut short, or more new pages than an update saves on its own. */
	missing: number;
	/** What the reader chose, as kept, for Settings > Your data to export. */
	choices: Choices;
}

/** Whether one page is chosen, for the save button at the top of each page. */
export interface PageChoice {
	path: string;
	/** The page is in the catalog, so it can be saved. */
	known: boolean;
	chosen: boolean;
	saved: boolean;
}

/** The files saved for a page: most are the page and its __data.json; a nation's entry also has its other pages. */
export function filesOf(page: CatalogPage): string[] {
	return page.files ?? [page.path, page.path === '/' ? '/__data.json' : `${page.path}/__data.json`];
}

/** Where the build publishes the catalog. */
export const catalogAddress = '/offline-catalog.json';
/** Where the build publishes every page's address, name and list, for the finder. */
export const catalogIndexAddress = '/offline-catalog/index.json';

/** One finder entry: a page's address, its name and the key of the list it is in. */
export type CatalogIndexEntry = [path: string, label: string, list: string];

/** The page of the catalog a page's address belongs to: "/nations/navajo-nation/opinions" belongs to "/nations/navajo-nation". */
export function catalogPageOf(path: string, known: (path: string) => boolean): string | undefined {
	let at = path.replace(/\/$/, '') || '/';
	while (at) {
		if (known(at)) return at;
		const cut = at.lastIndexOf('/');
		if (cut <= 0) return undefined;
		at = at.slice(0, cut);
	}
	return undefined;
}

/**
 * The reader's choices after one change. Saving a node or page that a chosen node above holds changes nothing.
 * Removing one that a chosen node above holds opens that node into its other children, level by level, down to what
 * is removed. Runs never stay in the choices: a run's pages stand for it. `childrenOf` gives a node's children, and
 * for a node with a list, its pages; `above` gives the nodes above a node or page, nearest last.
 */
export function applyChoice(
	choices: Choices,
	change: ChoiceChange,
	tree: {
		above: (key: string) => string[];
		/** A node's children: nodes, or for a list, pages. Runs are opened into their pages. */
		childrenOf: (key: string) => { key: string; kind: 'node' | 'page' }[];
		/** Every node and page below a node. */
		below: (key: string) => Set<string>;
		isRun: (key: string) => boolean;
	}
): Choices {
	const nodes = new Set(choices.nodes);
	const pages = new Set(choices.pages);
	const chosenAbove = tree.above(change.key).find((key) => nodes.has(key));
	const below = change.kind === 'node' ? tree.below(change.key) : new Set<string>();
	const drop = (keys: Set<string>) => {
		for (const key of keys) {
			nodes.delete(key);
			pages.delete(key);
		}
	};
	if (change.save) {
		if (chosenAbove) return choices;
		if (change.kind === 'page') pages.add(change.key);
		else {
			drop(below);
			if (tree.isRun(change.key)) for (const child of tree.childrenOf(change.key)) pages.add(child.key);
			else nodes.add(change.key);
		}
	} else {
		if (chosenAbove) {
			// Open each chosen level down to the change into its other children.
			const path = [...tree.above(change.key), change.key];
			nodes.delete(chosenAbove);
			for (let at = path.indexOf(chosenAbove); at < path.length - 1; at += 1) {
				for (const child of tree.childrenOf(path[at])) {
					if (child.key === path[at + 1]) continue;
					if (child.kind === 'page') pages.add(child.key);
					else if (tree.isRun(child.key)) for (const page of tree.childrenOf(child.key)) pages.add(page.key);
					else nodes.add(child.key);
				}
			}
		}
		nodes.delete(change.key);
		pages.delete(change.key);
		drop(below);
	}
	return { nodes: [...nodes], pages: [...pages] };
}

const numbers = new Intl.NumberFormat('en-US');

/** "1 page", "1,447 pages". */
export function countOf(count: number, unit: 'page' | 'file' | 'document' = 'page'): string {
	return `${numbers.format(count)} ${unit}${count === 1 ? '' : 's'}`;
}

/** Every node under (and including) this one. */
export function nodesUnder(node: CatalogNode): CatalogNode[] {
	return [node, ...(node.children ?? []).flatMap(nodesUnder)];
}

/** The nodes whose pages hold a filter's words, with the path to each, for the outline's filter. */
export function matchesFilter(node: CatalogNode, words: string[]): boolean {
	const text = `${node.label} ${node.hint ?? ''}`.toLowerCase();
	return words.every((word) => text.includes(word));
}

/** The catalog as a tree, for applyChoice and for counting what is saved, with the lists read so far. */
export function catalogTree(catalog: Catalog, lists: Record<string, CatalogPage[]>) {
	const parent = new Map<string, string>();
	const nodeOf = new Map<string, CatalogNode>();
	const walk = (node: CatalogNode) => {
		nodeOf.set(node.key, node);
		for (const child of node.children ?? []) {
			parent.set(child.key, node.key);
			walk(child);
		}
		for (const page of lists[node.key] ?? []) parent.set(page.path, node.key);
	};
	for (const part of catalog.parts) walk(part);
	const tree = {
		nodeOf,
		/** The nodes above a node or page, from the part down. */
		above(key: string): string[] {
			const found: string[] = [];
			for (let at = parent.get(key); at; at = parent.get(at)) found.unshift(at);
			return found;
		},
		childrenOf(key: string): { key: string; kind: 'node' | 'page' }[] {
			const node = nodeOf.get(key);
			if (!node) return [];
			if (node.children) return node.children.map((child) => ({ key: child.key, kind: 'node' as const }));
			return (lists[key] ?? []).map((page) => ({ key: page.path, kind: 'page' as const }));
		},
		below(key: string): Set<string> {
			const found = new Set<string>();
			for (const child of tree.childrenOf(key)) {
				found.add(child.key);
				if (child.kind === 'node') for (const deeper of tree.below(child.key)) found.add(deeper);
			}
			return found;
		},
		isRun: (key: string) => nodeOf.get(key)?.run === true,
		/** The nodes that hold a list of pages. */
		listNodes(): CatalogNode[] {
			return [...nodeOf.values()].filter((node) => node.list);
		}
	};
	return tree;
}

/** Every page the choices hold, by address, with the list each is in. */
export function chosenPages(choices: Choices, catalog: Catalog, lists: Record<string, CatalogPage[]>): Map<string, CatalogPage> {
	const tree = catalogTree(catalog, lists);
	const nodes = new Set(choices.nodes);
	const pages = new Set(choices.pages);
	const found = new Map<string, CatalogPage>();
	for (const node of tree.listNodes()) {
		const whole = [node.key, ...tree.above(node.key)].some((key) => nodes.has(key));
		for (const page of lists[node.key] ?? []) if (whole || pages.has(page.path)) found.set(page.path, page);
	}
	return found;
}
