/**
 * The datasets of Build a table (src/lib/server/table-builder-datasets.ts),
 * built from the real records. The sizes change as records are added, so
 * these check the shape every dataset must keep for the builder to read it.
 */
import { describe, expect, it, vi } from 'vitest';
import { nations } from '#lib/server/content.ts';
import { builderDataset, builderDatasetIdentifiers, builderDatasetSummaries, builtChart } from '#lib/server/table-builder-datasets.ts';
import { notRecorded, type BuilderDataset } from '#lib/table-builder.ts';

// The map's outlines are not needed for the datasets, only its rules for sorting nations.
vi.mock('virtual:map-geometry', () => ({ default: { states: [], regions: [], landAreas: [], statePoints: {}, stateBounds: {} } }));

const datasets = builderDatasetIdentifiers.map((identifier) => builderDataset(identifier)!);
const column = (dataset: BuilderDataset, key: string) => dataset.columns.findIndex((candidate) => candidate.key === key);

describe('the datasets', () => {
	it('offers each dataset in menu order, with its size', () => {
		expect(builderDatasetIdentifiers).toEqual(['nations', 'provisions', 'courts', 'compacts', 'constitutions', 'opinions', 'treaties', 'agreements', 'census-areas']);
		expect(builderDatasetSummaries()).toEqual(datasets.map((dataset) => ({ identifier: dataset.identifier, title: dataset.title, rowCount: dataset.rows.length })));
	});

	it('builds each dataset once, and nothing for a name it does not know', () => {
		expect(builderDataset('nations')).toBe(builderDataset('nations'));
		expect(builderDataset('no-such-dataset')).toBeUndefined();
	});

	it('gives every dataset rows, named columns and a starting view', () => {
		for (const dataset of datasets) {
			const keys = dataset.columns.map((entry) => entry.key);
			expect(new Set(keys).size, dataset.identifier).toBe(keys.length);
			expect(keys, dataset.identifier).toContain(dataset.nameColumn);
			if (dataset.nationColumn) expect(keys, dataset.identifier).toContain(dataset.nationColumn);
			expect(dataset.columns.some((entry) => entry.starting), dataset.identifier).toBe(true);
			expect(dataset.rows.length, dataset.identifier).toBeGreaterThan(0);
			expect(dataset.links, dataset.identifier).toHaveLength(dataset.rows.length);
			expect(dataset.sourceHref, dataset.identifier).toMatch(/^\//);
		}
	});

	it('fills each cell with a value of its column’s type, and an empty list as nothing recorded', () => {
		for (const dataset of datasets) {
			for (const row of dataset.rows) {
				expect(row, dataset.identifier).toHaveLength(dataset.columns.length);
				row.forEach((value, index) => {
					const { key, type } = dataset.columns[index];
					const where = `${dataset.identifier}.${key}`;
					if (value === null) return;
					if (type === 'number') expect(typeof value, where).toBe('number');
					else if (type === 'list') {
						expect(Array.isArray(value), where).toBe(true);
						expect((value as string[]).length, where).toBeGreaterThan(0);
					} else expect(typeof value, where).toBe('string');
				});
			}
		}
	});

	it('names every row', () => {
		for (const dataset of datasets) {
			const index = column(dataset, dataset.nameColumn);
			for (const row of dataset.rows) expect(row[index], dataset.identifier).toBeTruthy();
		}
	});
});

describe('the nations dataset', () => {
	const dataset = builderDataset('nations')!;

	it('lists each Native nation once, linked to its page', () => {
		const native = nations().filter((record) => record.entity_type === 'native-nation');
		expect(dataset.rows).toHaveLength(native.length);
		expect(dataset.links).toEqual(native.map((record) => `/nations/${record.id}`));
	});

	it('gives recognition in the words of the map’s table', () => {
		const words = new Set(dataset.rows.flatMap((row) => (row[column(dataset, 'recognition')] as string[] | null) ?? []));
		expect([...words].every((word) => ['Federal', 'State', 'Petitioning', 'Congress or territorial law'].includes(word))).toBe(true);
		expect(words.has('Federal')).toBe(true);
	});

	it('leaves counts of zero as nothing recorded', () => {
		for (const key of ['court-count', 'provision-count', 'opinion-count', 'treaty-count']) {
			for (const row of dataset.rows) expect(row[column(dataset, key)], key).not.toBe(0);
		}
	});
});

describe('the treaties dataset', () => {
	const dataset = builderDataset('treaties')!;

	it('lists each treaty once, oldest first, with its decade', () => {
		const signed = column(dataset, 'signed');
		const dates = dataset.rows.map((row) => (row[signed] as string | null) ?? '');
		expect(dates).toEqual([...dates].sort((first, second) => first.localeCompare(second)));
		const keys = dataset.rows.map((row) => `${row[column(dataset, 'title')]}|${row[signed]}`);
		expect(new Set(keys).size).toBe(keys.length);
		for (const row of dataset.rows) {
			const year = row[column(dataset, 'year')] as string | null;
			if (year) expect(row[column(dataset, 'decade')]).toBe(`${year.slice(0, 3)}0s`);
		}
		for (const link of dataset.links) expect(link).toMatch(/^\/nations\/[a-z0-9-]+#treaties-heading$/);
	});

	it('links each nation named in a treaty to its page', () => {
		const nationsColumn = column(dataset, 'nations');
		const named = new Set(dataset.rows.flatMap((row) => (row[nationsColumn] as string[] | null) ?? []));
		const links = dataset.nationLinks ?? {};
		expect(Object.keys(links).length).toBeGreaterThan(named.size * 0.95);
		for (const link of Object.values(links)) expect(link).toMatch(/^\/nations\/[a-z0-9-]+$/);
	});
});

describe('builtChart', () => {
	it('works out a chart from a Build a table address that groups by one column', () => {
		const built = builtChart('/nations/data/build?data=nations&group=region');
		if (built.kind !== 'chart') throw new Error('Expected a chart');
		const dataset = builderDataset('nations')!;
		// Each nation is in one region, or none recorded, so the bars add up to every nation.
		expect(built.chart.bars.reduce((sum, bar) => sum + bar.value, 0)).toBe(dataset.rows.length);
		expect(built.chart.partsOfWhole).toBe(true);
		const labels = built.chart.bars.map((bar) => bar.label);
		if (labels.includes(notRecorded)) expect(labels.at(-1)).toBe(notRecorded);
		expect(built.title).toBe('Nations by region');
		expect(built.link).toBe('/nations/data/build?data=nations&group=region');
	});

	it('works out a table for an address that groups by two columns', () => {
		const built = builtChart('/nations/data/build?data=treaties&group=decade&across=nations');
		expect(built.kind).toBe('table');
		if (built.kind === 'table') expect(built.columns.at(-1)!.key).toBe('total');
	});

	it('refuses an address that is not Build a table’s, or names a dataset it does not have', () => {
		expect(() => builtChart('/nations/data/build?data=no-such-dataset')).toThrow(/known dataset/);
		expect(() => builtChart('/nations/map?view=gaming')).toThrow(/known dataset/);
		expect(() => builtChart('/nations/data/build')).toThrow(/known dataset/);
	});
});

describe('the Census areas dataset', () => {
	it('gives each Native area its American Community Survey figures and links it to the nations whose pages name it', () => {
		const dataset = builderDataset('census-areas')!;
		const name = column(dataset, 'name');
		const row = dataset.rows.findIndex((cells) => cells[name] === 'Bay Mills Reservation and Off-Reservation Trust Land');
		expect(row).toBeGreaterThanOrEqual(0);
		expect(dataset.rows[row][column(dataset, 'states')]).toEqual(['Michigan']);
		expect(dataset.rows[row][column(dataset, 'kind')]).toBe('Reservation');
		expect(dataset.rows[row][column(dataset, 'population')]).toBeGreaterThan(0);
		expect(dataset.links[row]).toBe('/nations/bay-mills-indian-community');
		expect(dataset.rows.length).toBeGreaterThan(600);
	});
});
