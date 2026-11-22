import { describe, expect, it } from 'vitest';
import type { DocumentHistoryRecord } from '#lib/server/content.ts';
import { documentHeading, documentHistoryView } from '#lib/server/document-history.ts';
import { SourceUses } from '#lib/server/source-uses.ts';

/** A Sources collector that cites each source by its key, so no source records are needed. */
function recorder() {
	return new SourceUses((key) => key);
}

const record: DocumentHistoryRecord = {
	id: 'example-nation-state-gaming-compact',
	kind: 'gaming-compact',
	title: 'Example Nation–State Gaming Compact',
	nations: ['example-nation'],
	versions: [
		{
			id: '1993-original',
			label: '1993 compact',
			event: 'original',
			status: 'superseded',
			dates: { signed: '1993-02-05', effective: '1993-03-31' },
			source: 'compact-1993',
			confidence: 'high'
		},
		{
			id: '2003-replacement',
			label: '2003 compact',
			event: 'replacement',
			status: 'in-effect',
			supersedes: ['1993-original'],
			dates: { approved: '2003-01-24', published: '2003-02-05' },
			approval: { authority: 'secretary-of-the-interior', action: 'approved', source: 'notice-2003' },
			source: 'compact-2003',
			confidence: 'high',
			changes: [
				{ topic: 'dispute-resolution', compared_with: '1993-original', change: 'changed', summary: 'Adds mediation.' }
			]
		},
		{
			id: '2009-amendment',
			label: '2009 amendment',
			event: 'amendment',
			status: 'in-effect',
			amends: ['2003-replacement'],
			dates: { published: '2009-03-25' },
			source: 'amendment-2009',
			confidence: 'high',
			changes: [{ topic: 'dispute-resolution', compared_with: '2003-replacement', change: 'not-compared' }]
		}
	]
};

describe('documentHistoryView', () => {
	it('describes each version and what it did to earlier ones, without clause summaries', () => {
		const view = documentHistoryView(record, recorder());
		expect(view.inEffect).toBe('2003 compact, as amended by 2009 amendment');
		expect(view.versions.map((version) => version.inEffect)).toEqual([false, true, true]);
		expect(view.versions[0].dates).toBe('Signed Feb. 5, 1993; effective Mar. 31, 1993');
		expect(view.versions[1].relation).toBe('Replaced the 1993 compact');
		expect(view.versions[2].relation).toBe('Amended the 2003 compact');
		expect(JSON.stringify(view)).not.toContain('Adds mediation.');
	});

	it('lists every version and approval notice under the document in the Sources section', () => {
		const sources = recorder();
		documentHistoryView(record, sources);
		expect(sources.list.map((entry) => entry.key)).toEqual([
			'compact-1993',
			'compact-2003',
			'notice-2003',
			'amendment-2009'
		]);
		expect(new Set(sources.list.flatMap((entry) => entry.groups.map((group) => group.section)))).toEqual(
			new Set([record.title])
		);
	});

	it('gives each version a marker for its source and its approval notice, linked both ways', () => {
		const sources = recorder();
		const view = documentHistoryView(record, sources);
		expect(view.versions[1].citations).toEqual([
			{ number: 2, anchor: 'cite-2-1', where: undefined },
			{ number: 3, anchor: 'cite-3-1', where: undefined }
		]);
		expect(sources.list.map((entry) => entry.backlinks)).toEqual([
			['cite-1-1'],
			['cite-2-1'],
			['cite-3-1'],
			['cite-4-1']
		]);
	});
});

describe('documentHeading', () => {
	const names = ['Example Nation, Arizona', 'Example Nation'];

	it('drops the nation’s name from the front of a document’s title', () => {
		expect(documentHeading('Example Nation–State of Arizona Gaming Compact', names)).toBe('Gaming compact with Arizona');
	});

	it('calls the nation’s own constitution “Constitution”', () => {
		expect(documentHeading('Constitution of the Example Nation', names)).toBe('Constitution');
	});

	it('leaves other titles as they are', () => {
		expect(documentHeading('Tribal–State Water Settlement', names)).toBe('Tribal–State Water Settlement');
	});
});
