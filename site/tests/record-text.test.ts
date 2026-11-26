import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyRecordText, markRecordText, partInnerHtml, recordTextKey, tidyRecordWords } from '#lib/record-text.ts';
import { publishedRecordText, recordTextCatalog } from '#lib/server/record-text-build.ts';
import { cleanRecordWords, pieceStates, publish, publishedSiteText, saveVersion } from '#lib/server/site-text.ts';
import { entryPlace, siteTextPlace } from '#lib/site-text.ts';
import type { SiteTextEntry } from '#lib/site-text-markers.ts';
import { testDatabase } from './database.ts';

// Trevor, Nov. 24, 2026: the Indian Removal Act's Summary could not be edited in Edit mode.
describe('names of the parts of a box', () => {
	it('come from the record and the part only, so they stay put when the words change', () => {
		expect(recordTextKey('indian-removal-act-1830', 'summary')).toMatch(/^[0-9a-z]{10}$/);
		expect(recordTextKey('indian-removal-act-1830', 'summary')).toBe(recordTextKey('indian-removal-act-1830', 'summary'));
		expect(recordTextKey('indian-removal-act-1830', 'summary')).not.toBe(recordTextKey('indian-removal-act-1830', 'treatment'));
	});

	it('are marked on the prose parts of rendered HTML, not on quotations', () => {
		const html = '<div class="essay-case-part essay-case-summary">\n<p>Did it.</p>\n</div>\n<div class="essay-case-part essay-case-quotes">\n<blockquote>q</blockquote>\n</div>';
		const marked = markRecordText(html, 'indian-removal-act-1830');
		expect(marked).toContain(`essay-case-summary" data-record-text="${recordTextKey('indian-removal-act-1830', 'summary')}"`);
		expect(marked).toContain('<div class="essay-case-part essay-case-quotes">');
		expect(partInnerHtml('<div class="essay-case-part essay-case-summary">\n<p>Did it.</p>\n</div>\n')).toBe('<p>Did it.</p>\n');
	});
});

describe('the words of a part', () => {
	it('keep their paragraphs', () => {
		expect(tidyRecordWords('One.  \r\n\r\n\r\n\nTwo.\n')).toBe('One.\n\nTwo.');
		expect(cleanRecordWords('One.\n\nTwo.', 'Old.')).toBe('One.\n\nTwo.');
		expect(cleanRecordWords(' Old. ', 'Old.')).toBeNull();
	});

	it('go into the records the build reads', () => {
		const records = new Map([
			['a-law', { law_box: { summary: 'Old.' } }],
			['a-case', { case_box: { holding: 'Held.' } }]
		]);
		expect(applyRecordText(records, { 'a-law': { summary: 'New.' }, 'a-case': { holding: 'Held again.' }, missing: { summary: 'x' } })).toBe(2);
		expect(records.get('a-law')?.law_box?.summary).toBe('New.');
		expect(records.get('a-case')?.case_box?.holding).toBe('Held again.');
	});
});

describe('the catalog of parts', () => {
	const catalog = recordTextCatalog();
	const removal = catalog.find((entry) => entry.record?.key === 'indian-removal-act-1830' && entry.record.part === 'summary');

	it('lists the Indian Removal Act Summary, from its record, on its page', () => {
		expect(removal).toBeDefined();
		expect(removal?.file).toBe('../content/sources/i/indian-removal-act-1830.yaml');
		expect(removal?.record?.page).toBe('/laws/indian-removal-act-1830');
		expect(removal?.words).toMatch(/^Authorized the President/);
		expect(entryPlace(removal!)).toBe(`${removal?.record?.name} › Summary`);
		expect(siteTextPlace(removal!.file)).toBe('Record indian-removal-act-1830');
	});

	it('picks out the published words that belong to parts', () => {
		expect(publishedRecordText(catalog, { [removal!.key]: 'Edited.', aaaaaaaaaa: 'A label' })).toEqual({ 'indian-removal-act-1830': { summary: 'Edited.' } });
	});
});

describe('saving and publishing a part', () => {
	let database: D1Database;
	const part: SiteTextEntry = {
		key: recordTextKey('indian-removal-act-1830', 'summary'),
		file: '../content/sources/i/indian-removal-act-1830.yaml',
		line: 0,
		words: 'Authorized the President.',
		record: { key: 'indian-removal-act-1830', part: 'summary', page: '/laws/indian-removal-act-1830', name: 'Indian Removal Act' }
	};

	beforeEach(async () => {
		database = testDatabase();
		await database
			.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES ('lead', 'l@example.org', 'Lead', 'lead-author', 'active', '2026-11-24T00:00:00Z')`)
			.run();
	});

	it('keeps paragraphs through a draft and a publication', async () => {
		await saveVersion(database, { entry: part, words: 'First paragraph.\n\nSecond paragraph.', page: '/laws/indian-removal-act-1830', personIdentifier: 'lead' });
		expect((await pieceStates(database)).get(part.key)?.draft?.words).toBe('First paragraph.\n\nSecond paragraph.');
		await publish(database, 'lead');
		expect((await publishedSiteText(database)).texts[part.key]).toBe('First paragraph.\n\nSecond paragraph.');
	});
});
