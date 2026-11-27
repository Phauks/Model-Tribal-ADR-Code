import { describe, expect, it } from 'vitest';
import { filterSearchFiles, type SiteRestrictions } from '../src/lib/restricted-files.ts';
import {
	citationsAlone,
	citationsOnlyOptions,
	defaultSelectionOptions,
	fileOf,
	filePaths,
	listedFile,
	plannedEntries,
	readSelectionOptions,
	readSelectionRequest,
	selectionLimit,
	sizeText,
	suggestedZipName,
	type SelectedItem
} from '../src/lib/search-selection.ts';

const law: SelectedItem = { title: 'Navajo and Hopi Indian Relocation Amendments of 1988', group: 'law', file: [974_000, '/copies/govinfo/STATUTE-102/STATUTE-102-Pg3929.pdf'] };
const code: SelectedItem = { title: 'Navajo Nation Code, Title 7: Courts/Procedures', group: 'document', nation: 'Navajo Nation', file: [489_000, '/copies/tribal-law/navajo-nation/title%207.pdf'] };
const link: SelectedItem = { title: 'Agreement Between the New Mexico State Police and the Navajo Tribe', group: 'document', nation: 'Navajo Nation' };

describe('the files list', () => {
	it('keeps only the size for a copy’s own page, and gives the file back whole', () => {
		const page = '/copies/view/tribal-law/navajo-nation/code.pdf';
		expect(listedFile(page, [10, '/copies/tribal-law/navajo-nation/code.pdf'])).toBe(10);
		expect(listedFile('/laws/act', [10, '/copies/govinfo/act.pdf'])).toEqual([10, '/copies/govinfo/act.pdf']);
		const files = { [page]: 10, '/laws/act': [20, '/copies/govinfo/act.pdf'] as [number, string] };
		expect(fileOf(files, page)).toEqual([10, '/copies/tribal-law/navajo-nation/code.pdf']);
		expect(fileOf(files, '/laws/act')).toEqual([20, '/copies/govinfo/act.pdf']);
		expect(fileOf(files, '/laws/other')).toBeUndefined();
	});

	it('leaves out a copy a nation hid or asked to cite only', () => {
		const files = {
			'/copies/view/tribal-law/a/hidden.pdf': 1,
			'/cases/cited': [2, '/copies/tribal-law/a/cited.pdf'] as [number, string],
			'/laws/shown': [3, '/copies/govinfo/shown.pdf'] as [number, string]
		};
		const restrictions: SiteRestrictions = {
			stamp: 's',
			levels: new Map([
				['copy:tribal-law/a/hidden.pdf', 'hide'],
				['copy:tribal-law/a/cited.pdf', 'cite']
			]),
			items: new Map(),
			hiddenDocuments: new Set()
		};
		expect(Object.keys(filterSearchFiles(files, restrictions))).toEqual(['/laws/shown']);
	});
});

describe('the reader’s choices', () => {
	it('takes the defaults for anything unknown, and drops what needs something left out', () => {
		expect(readSelectionOptions(undefined)).toEqual(defaultSelectionOptions);
		expect(readSelectionOptions({ format: 'docx', folders: 'year', files: 'yes' })).toEqual(defaultSelectionOptions);
		const noFiles = readSelectionOptions({ files: false });
		expect(noFiles.sums).toBe(false);
		expect(noFiles.verify).toBe(false);
		expect(readSelectionOptions({ sums: false }).verify).toBe(false);
		expect(readSelectionOptions({ name: ' ../my: list.zip ' }).name).toBe('-my- list');
	});

	it('sends the citations alone when nothing else is ticked', () => {
		expect(citationsAlone(readSelectionOptions({ ...defaultSelectionOptions, ...citationsOnlyOptions }))).toBe(true);
		expect(citationsAlone(defaultSelectionOptions)).toBe(false);
	});

	it('names the .zip for the words searched and the day', () => {
		expect(suggestedZipName('Navajo  peacemaking!', '2026-11-27')).toBe('navajo-peacemaking-search-2026-11-27');
		expect(suggestedZipName('', '2026-11-27')).toBe('search-2026-11-27');
		expect(suggestedZipName('Diné', '2026-11-27')).toBe('dine-search-2026-11-27');
	});
});

describe('the plan of the .zip', () => {
	it('puts files in folders by kind, named by title, with the copy’s own extension', () => {
		expect(filePaths([law, link, code], defaultSelectionOptions)).toEqual([
			'Federal law/Navajo and Hopi Indian Relocation Amendments of 1988.pdf',
			undefined,
			'Laws and governing documents/Navajo Nation Code, Title 7- Courts-Procedures.pdf'
		]);
	});

	it('goes by nation or into one folder, and keeps the publisher’s names when asked', () => {
		expect(filePaths([law, code], { folders: 'nation', names: 'publisher' })).toEqual([
			'Other documents/STATUTE-102-Pg3929.pdf',
			'Navajo Nation/title 7.pdf'
		]);
		expect(filePaths([law], { folders: 'none', names: 'title' })[0]).toMatch(/^documents\//);
	});

	it('tells apart two files that would share a name', () => {
		const twin = { ...law, file: [1, '/copies/other/x.pdf'] as [number, string] };
		expect(filePaths([law, twin], defaultSelectionOptions)).toEqual([
			'Federal law/Navajo and Hopi Indian Relocation Amendments of 1988.pdf',
			'Federal law/Navajo and Hopi Indian Relocation Amendments of 1988 (2).pdf'
		]);
	});

	it('lists the notes first, then each folder with its files, as the preview shows', () => {
		const entries = plannedEntries([law, link, code], defaultSelectionOptions);
		expect(entries.map((entry) => entry.name)).toEqual([
			'README.txt',
			'citations.txt',
			'selection.csv',
			'SHA256SUMS.txt',
			'verify.sh',
			'verify.ps1',
			'Federal law/',
			'Navajo and Hopi Indian Relocation Amendments of 1988.pdf',
			'Laws and governing documents/',
			'Navajo Nation Code, Title 7- Courts-Procedures.pdf'
		]);
		expect(entries[1].count).toBe(3);
		expect(plannedEntries([link], defaultSelectionOptions).map((entry) => entry.name)).toEqual(['README.txt', 'citations.txt', 'selection.csv']);
	});
});

describe('the request', () => {
	it('keeps each result once, with a link on this site or the web and a known group', () => {
		const request = readSelectionRequest(
			JSON.stringify({
				items: [
					{ link: '/laws/a', title: 'A', group: 'law' },
					{ link: '/laws/a', title: 'A again', group: 'law' },
					{ link: 'javascript:alert(1)', title: 'B', group: 'law' },
					{ link: 'https://example.org/c.pdf', title: 'C', group: 'document', nation: 'Navajo Nation' },
					{ link: '/d', title: 'D', group: 'nonsense' }
				],
				options: { format: 'bib' },
				query: 'navajo'
			})
		);
		expect(request?.items.map((item) => item.link)).toEqual(['/laws/a', 'https://example.org/c.pdf']);
		expect(request?.options.format).toBe('bib');
		expect(readSelectionRequest('not json')).toBeUndefined();
		expect(readSelectionRequest(JSON.stringify({ items: [] }))).toBeUndefined();
	});

	it('takes at most the limit', () => {
		const items = Array.from({ length: selectionLimit + 20 }, (_, index) => ({ link: `/laws/${index}`, title: String(index), group: 'law' }));
		expect(readSelectionRequest(JSON.stringify({ items }))?.items).toHaveLength(selectionLimit);
	});
});

it('gives sizes as the tags do', () => {
	expect(sizeText(974_000)).toBe('974 KB');
	expect(sizeText(1_700_000)).toBe('1.7 MB');
	expect(sizeText(42_000_000)).toBe('42 MB');
});
