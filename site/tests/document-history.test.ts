import { describe, expect, it } from 'vitest';
import type { DocumentHistoryRecord } from '#lib/server/content.ts';
import { documentHistoryView } from '#lib/server/document-history.ts';

function recorder() {
	const used: { key: string; section: string; text: string }[] = [];
	return {
		used,
		add(key: string, use: { section: string; text: string }) {
			used.push({ key, section: use.section, text: use.text });
		},
		use(fact: { source?: string } | undefined, section: string, text: string) {
			if (fact?.source) used.push({ key: fact.source, section, text });
		}
	};
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
	it('describes each version, what it did to earlier ones and how its clauses changed', () => {
		const view = documentHistoryView(record, recorder());
		expect(view.inEffect).toBe('2003 compact, as amended by 2009 amendment');
		expect(view.versions.map((version) => version.inEffect)).toEqual([false, true, true]);
		expect(view.versions[0].dates).toBe('Signed 1993-02-05; effective 1993-03-31');
		expect(view.versions[1].relation).toBe('Replaced the 1993 compact');
		expect(view.versions[2].relation).toBe('Amended the 2003 compact');
		expect(view.versions[1].changes).toEqual([
			{ topic: 'Dispute resolution', change: 'changed', summary: 'Adds mediation.' }
		]);
		expect(view.versions[2].changes[0].change).toBe('not compared yet');
	});

	it('lists every version and approval notice under the document in the Sources section', () => {
		const sources = recorder();
		documentHistoryView(record, sources);
		expect(sources.used.map((use) => use.key)).toEqual([
			'compact-1993',
			'compact-2003',
			'notice-2003',
			'amendment-2009'
		]);
		expect(new Set(sources.used.map((use) => use.section))).toEqual(new Set([record.title]));
	});
});
