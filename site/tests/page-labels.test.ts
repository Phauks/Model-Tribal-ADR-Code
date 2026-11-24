import { describe, expect, it } from 'vitest';
import { dataChartList, dataTopicList } from '../src/lib/data-chart-list.ts';
import { displayName } from '../src/lib/nation-labels.ts';
import { citationDate, fileExtension, pageCitation, pageDownloads } from '../src/lib/page-downloads.ts';
import { sourceKeys } from '../src/lib/server/source-keys.ts';

describe('pageDownloads', () => {
	const links = (path: string) => pageDownloads(path).files.flatMap((file) => file.links.map((link) => link.link));

	it('offers a nation page its record, its timeline, its sources in three formats and its contacts, and the map page its layers', () => {
		expect(links('/nations/cherokee-nation')).toEqual([
			'/nations/cherokee-nation/record.json',
			'/nations/cherokee-nation/timeline.csv',
			'/nations/cherokee-nation/timeline.json',
			'/nations/cherokee-nation/sources.json',
			'/nations/cherokee-nation/sources.ris',
			'/nations/cherokee-nation/sources.bib',
			'/nations/cherokee-nation/contacts.vcf'
		]);
		expect(pageDownloads('/nations/cherokee-nation').citable).toBe(true);
		expect(links('/nations/timeline')).toEqual([
			'/nations/timeline/entries.csv',
			'/nations/timeline/entries.json',
			'/nations/timeline/sources.json',
			'/nations/timeline/sources.ris',
			'/nations/timeline/sources.bib'
		]);
		expect(links('/nations/map')).toEqual([
			'/nations/map/land-areas.geojson',
			'/nations/map/bureau-of-indian-affairs-regions.geojson',
			'/nations/map/government-offices.geojson'
		]);
		expect(pageDownloads('/nations/map').citable).toBe(false);
		// The table of the view on screen comes first.
		const onScreen = pageDownloads('/nations/map', { file: 'gaming-by-state', label: 'Gaming by State' }).files[0];
		expect(onScreen.label).toBe('The Gaming by State table');
		expect(onScreen.links.map((link) => link.link)).toEqual(['/nations/map/tables/gaming-by-state.csv']);
	});

	it('offers every Data and charts table on its own, as CSV, Excel and JSON', () => {
		const files = pageDownloads('/nations/data').files;
		expect(files).toHaveLength(dataChartList.length);
		expect(files[0].label).toBe('Supreme Court cases by Court');
		expect(files[0].links.map((link) => link.link)).toEqual([
			'/nations/data/tables/supreme-court-cases-by-court.csv',
			'/nations/data/tables/supreme-court-cases-by-court.xlsx',
			'/nations/data/tables/supreme-court-cases-by-court.json'
		]);
	});

	it('offers a topic page only its own charts’ tables', () => {
		const files = pageDownloads('/nations/data/gaming').files;
		expect(files.map((file) => file.label)).toEqual(dataChartList.filter((chart) => dataTopicList.find((topic) => topic.identifier === 'gaming')!.charts.includes(chart.identifier)).map((chart) => chart.title));
		expect(files[0].label).toBe('Nations with each kind of federal gaming record');
	});

	it('names a file by its extension, as the format buttons show it', () => {
		expect(fileExtension('/nations/cherokee-nation/sources.bib')).toBe('.bib');
		expect(fileExtension('/help/forms/notice.DOCX?x=1#y')).toBe('.docx');
		expect(fileExtension('/downloads')).toBe('');
	});

	it('offers the index pages the list, and the glossary its terms', () => {
		expect(links('/nations/letter/n')).toEqual(['/nations/nations.csv']);
		expect(links('/nations/state/nv')).toEqual(['/nations/nations.csv']);
		expect(links('/glossary/native-nations')).toEqual(['/glossary/terms.json']);
		expect(pageDownloads('/glossary').citable).toBe(false);
		expect(pageDownloads('/glossary/native-nations').citable).toBe(true);
	});

	it('offers other pages no file of their own, and a story a citation', () => {
		expect(pageDownloads('/changelog')).toEqual({ files: [], citable: false });
		expect(pageDownloads('/stories/coyote-and-the-river').citable).toBe(true);
	});

	it('offers the Cite button on pages about one record, and not on lists', () => {
		for (const path of ['/cases/worcester-v-georgia', '/supreme-court/marshall-court', '/supreme-court/justices/john-marshall', '/supreme-court/presidents/andrew-jackson']) {
			expect(pageDownloads(path).citable, path).toBe(true);
		}
		for (const path of ['/supreme-court', '/supreme-court/justices', '/supreme-court/presidents', '/nations/coverage']) {
			expect(pageDownloads(path).citable, path).toBe(false);
		}
	});
});

describe('pageCitation', () => {
	it('cites a page with its version, address and the day visited', () => {
		const citation = pageCitation(
			'Navajo Nation',
			'Model Tribal ADR Code',
			'0.3.0',
			'https://example.org/nations/navajo-nation',
			new Date(2026, 10, 22)
		);
		expect(citation.text).toBe(
			'Navajo Nation, Model Tribal ADR Code (draft content ver. 0.3.0), https://example.org/nations/navajo-nation (last visited Nov. 22, 2026).'
		);
		expect(citation.html.startsWith('<i>Navajo Nation</i>, Model Tribal ADR Code')).toBe(true);
	});

	it('abbreviates months as the Indigo Book does', () => {
		expect(citationDate(new Date(2026, 8, 3))).toBe('Sept. 3, 2026');
		expect(citationDate(new Date(2026, 5, 30))).toBe('June 30, 2026');
	});
});

describe('sourceKeys', () => {
	it('finds sources at any depth, in source fields, …_source fields and sources lists', () => {
		const record = {
			names: { official: 'X', official_source: 'a' },
			recognition: [{ status: 'federal', source: 'b' }],
			governing_documents: [{ versions: [{ sources: ['c', 'a'] }] }]
		};
		expect([...sourceKeys(record)].sort()).toEqual(['a', 'b', 'c']);
	});
});

describe('displayName', () => {
	it('leaves out the states a list adds after a comma', () => {
		expect(displayName('Navajo Nation, Arizona, New Mexico, & Utah')).toBe('Navajo Nation');
		expect(displayName('Confederated Tribes of the Goshute Reservation, Nevada and Utah')).toBe('Confederated Tribes of the Goshute Reservation');
		expect(displayName('Pueblo of Zia, New Mexico')).toBe('Pueblo of Zia');
	});

	it('keeps a state that is part of the name', () => {
		expect(displayName('Paiute Indian Tribe of Utah')).toBe('Paiute Indian Tribe of Utah');
		expect(displayName('Fort Mojave Indian Tribe of Arizona, California & Nevada')).toBe('Fort Mojave Indian Tribe of Arizona, California & Nevada');
		expect(displayName('Metlakatla Indian Community, Annette Island Reserve')).toBe('Metlakatla Indian Community, Annette Island Reserve');
	});
});
