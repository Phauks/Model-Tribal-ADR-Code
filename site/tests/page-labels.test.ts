import { describe, expect, it } from 'vitest';
import { displayName } from '../src/lib/nation-labels.ts';
import { citationDate, pageCitation, pageDownloads } from '../src/lib/page-downloads.ts';
import { sourceKeys } from '../src/lib/server/source-keys.ts';

describe('pageDownloads', () => {
	const links = (path: string) => pageDownloads(path).files.map((file) => file.link);

	it('offers a nation page its record and its sources, and the map page no file', () => {
		expect(links('/nations/cherokee-nation')).toEqual([
			'/nations/cherokee-nation/record.json',
			'/nations/cherokee-nation/sources.json'
		]);
		expect(pageDownloads('/nations/cherokee-nation').citable).toBe(true);
		expect(links('/nations/map')).toEqual([]);
		expect(pageDownloads('/nations/map').citable).toBe(false);
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
