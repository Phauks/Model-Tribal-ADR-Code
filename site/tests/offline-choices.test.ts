import { describe, expect, it } from 'vitest';
import { applyChoice, catalogPageOf, catalogTree, chosenPages, filesOf, type Catalog, type CatalogPage, type Choices } from '#lib/offline-choices.ts';

const page = (path: string): CatalogPage => ({ path, label: path, bytes: 100 });

// Laws has two groups; treaties is long, so it is cut into two runs.
const catalog: Catalog = {
	version: 'test',
	parts: [
		{
			key: 'laws',
			label: 'Laws',
			pages: 5,
			bytes: 500,
			children: [
				{
					key: 'laws-treaties',
					label: 'Treaties',
					pages: 4,
					bytes: 400,
					children: [
						{ key: 'laws-treaties-1', label: 'A – B', run: true, pages: 2, bytes: 200, list: '/offline-catalog/laws-treaties-1.json' },
						{ key: 'laws-treaties-2', label: 'C – D', run: true, pages: 2, bytes: 200, list: '/offline-catalog/laws-treaties-2.json' }
					]
				},
				{ key: 'laws-orders', label: 'Executive orders', pages: 1, bytes: 100, list: '/offline-catalog/laws-orders.json' }
			]
		},
		{ key: 'glossary', label: 'Glossary', pages: 1, bytes: 100, list: '/offline-catalog/glossary.json' }
	]
};
const lists: Record<string, CatalogPage[]> = {
	'laws-treaties-1': [page('/laws/a'), page('/laws/b')],
	'laws-treaties-2': [page('/laws/c'), page('/laws/d')],
	'laws-orders': [page('/laws/order')],
	glossary: [page('/glossary/x')]
};
const tree = catalogTree(catalog, lists);
const apply = (choices: Choices, key: string, kind: 'node' | 'page', save: boolean) => applyChoice(choices, { key, kind, save }, tree);
const sorted = (choices: Choices) => ({ nodes: [...choices.nodes].sort(), pages: [...choices.pages].sort() });
const none: Choices = { nodes: [], pages: [] };

describe('the outline as a tree', () => {
	it('knows what is above and below a node or page', () => {
		expect(tree.above('/laws/c')).toEqual(['laws', 'laws-treaties', 'laws-treaties-2']);
		expect([...tree.below('laws-treaties')].sort()).toEqual(['/laws/a', '/laws/b', '/laws/c', '/laws/d', 'laws-treaties-1', 'laws-treaties-2']);
		expect(tree.listNodes().map((node) => node.key)).toEqual(['laws-treaties-1', 'laws-treaties-2', 'laws-orders', 'glossary']);
	});
});

describe('applying a choice', () => {
	it('keeps a part, and drops the choices inside it', () => {
		expect(sorted(apply({ nodes: ['laws-orders'], pages: ['/laws/a'] }, 'laws', 'node', true))).toEqual({ nodes: ['laws'], pages: [] });
	});

	it('changes nothing when a part above is already chosen', () => {
		const choices = { nodes: ['laws'], pages: [] };
		expect(apply(choices, '/laws/a', 'page', true)).toBe(choices);
		expect(apply(choices, 'laws-orders', 'node', true)).toBe(choices);
	});

	it('keeps a run as its pages, since runs move as pages are added', () => {
		expect(sorted(apply(none, 'laws-treaties-2', 'node', true))).toEqual({ nodes: [], pages: ['/laws/c', '/laws/d'] });
	});

	it('opens a chosen part into its other groups, runs and pages when one page inside is removed', () => {
		expect(sorted(apply({ nodes: ['laws', 'glossary'], pages: [] }, '/laws/c', 'page', false))).toEqual({
			nodes: ['glossary', 'laws-orders'],
			pages: ['/laws/a', '/laws/b', '/laws/d']
		});
	});

	it('removes a group and whatever was chosen inside it', () => {
		expect(sorted(apply({ nodes: ['laws-orders'], pages: ['/laws/a', '/laws/c'] }, 'laws-treaties', 'node', false))).toEqual({ nodes: ['laws-orders'], pages: [] });
	});

	it('removes a single page', () => {
		expect(apply({ nodes: [], pages: ['/laws/a', '/glossary/x'] }, '/laws/a', 'page', false)).toEqual({ nodes: [], pages: ['/glossary/x'] });
	});
});

describe('the pages chosen', () => {
	it('gathers the pages of chosen parts and the single pages', () => {
		const chosen = chosenPages({ nodes: ['laws-treaties'], pages: ['/glossary/x', '/not/in/the/catalog'] }, catalog, lists);
		expect([...chosen.keys()].sort()).toEqual(['/glossary/x', '/laws/a', '/laws/b', '/laws/c', '/laws/d']);
	});
});

describe('files and addresses', () => {
	it('saves a page with its data file unless the list names other files', () => {
		expect(filesOf(page('/laws/a'))).toEqual(['/laws/a', '/laws/a/__data.json']);
		expect(filesOf(page('/'))).toEqual(['/', '/__data.json']);
		expect(filesOf({ ...page('/nations/x'), files: ['/nations/x', '/nations/x/opinions'] })).toEqual(['/nations/x', '/nations/x/opinions']);
	});

	it('finds the entry a page is folded into', () => {
		const known = new Set(['/nations/navajo-nation', '/']);
		expect(catalogPageOf('/nations/navajo-nation/opinions', (path) => known.has(path))).toBe('/nations/navajo-nation');
		expect(catalogPageOf('/nations/navajo-nation/', (path) => known.has(path))).toBe('/nations/navajo-nation');
		expect(catalogPageOf('/workspace/x', (path) => known.has(path))).toBeUndefined();
	});
});
