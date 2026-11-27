import { describe, expect, it } from 'vitest';
import type { RestrictableItem, RestrictionSettings } from '#lib/nation-restrictions.ts';
import {
	filterBuilderFile,
	filterCopiesCsv,
	filterCopyDetails,
	filterLawItems,
	filterOfflineList,
	filterSearchIndex,
	filterSearchRecords,
	filterTimelineRows,
	type SiteRestrictions
} from '#lib/restricted-files.ts';
import { filterChartBarPage, filterNationPage, filterTimelinePage, restrictedPageView } from '#lib/restricted-pages.ts';
import { gatherRestrictions } from '#lib/server/nation-restrictions.ts';
import { timelineKinds } from '#lib/timeline.ts';

const cherokee = 'cherokee-nation';
const hiddenOpinion = 'caselaw-access-project/am-tribal-law/1/0001-01.html';
const citedOpinion = 'caselaw-access-project/am-tribal-law/1/0002-01.html';
const hiddenLaw = 'constitutions/cherokee-nation/1975.pdf';
const items: RestrictableItem[] = [
	{ id: `copy:${hiddenLaw}`, kind: 'laws', title: '1975 proposed constitution', original: 'https://example.org/1975.pdf', document: 'constitution', version: '1975-proposed', date: '1975-09-05' },
	{ id: 'copy:constitutions/cherokee-nation/1999.pdf', kind: 'laws', title: '1999 constitution', original: 'https://example.org/1999.pdf', document: 'constitution', version: '1999', date: '1999-07-26' },
	{ id: 'version:code/2001', kind: 'laws', title: '2001 code', document: 'code', version: '2001', date: '2001-01-01' },
	{ id: `copy:${hiddenOpinion}`, kind: 'opinions', title: 'Takeda v. Smith', cite: '1 Am. Tribal Law 1', year: '1999', nations: [cherokee, 'navajo-nation'], original: 'https://static.case.law/1.html' },
	{ id: `copy:${citedOpinion}`, kind: 'opinions', title: 'Doe v. Roe', cite: '1 Am. Tribal Law 2', year: '2000', nations: [cherokee], original: 'https://static.case.law/2.html' }
];
const settings: RestrictionSettings = {
	kinds: { opinions: 'cite' },
	items: { [`copy:${hiddenLaw}`]: 'hide', 'version:code/2001': 'hide', [`copy:${hiddenOpinion}`]: 'hide' }
};

async function restrictions(): Promise<SiteRestrictions> {
	const gathered = await gatherRestrictions(new Map([[cherokee, settings]]), async () => ({ items }), [], 'stamp');
	if (!gathered) throw new Error('Nothing restricted');
	return gathered;
}

describe('gathering every nation’s choices', () => {
	it('names nothing when no nation restricts anything', async () => {
		expect(await gatherRestrictions(new Map([[cherokee, { kinds: {}, items: {} }]]), async () => ({ items }), [], 's')).toBeUndefined();
	});

	it('follows the strictest nation for a shared copy, and knows a document whose every version is hidden', async () => {
		const shared = { key: 'caselaw-access-project/shared.html', restrict: { kind: 'opinions' as const, nations: [cherokee, 'navajo-nation'] } };
		const gathered = await gatherRestrictions(
			new Map<string, RestrictionSettings>([
				[cherokee, settings],
				['navajo-nation', { kinds: { opinions: 'hide' }, items: {} }]
			]),
			async (nation) => ({ items: nation === cherokee ? items : [] }),
			[shared],
			's'
		);
		expect(gathered?.levels.get(`copy:${shared.key}`)).toBe('hide');
		expect(gathered?.levels.get(`copy:${citedOpinion}`)).toBe('cite');
		expect(gathered?.hiddenDocuments).toEqual(new Set([`${cherokee}#code`]));
	});
});

describe('files made at build time', () => {
	it('drops search rows for documents with nothing left', async () => {
		const file = {
			nations: [],
			documents: [
				{ title: 'Code', kind: 'law-code', nation: cherokee, anchor: 'document-code' },
				{ title: 'Constitution', kind: 'constitution', nation: cherokee, anchor: 'document-constitution' }
			],
			storyNations: {},
			stateOptions: [],
			regionOptions: []
		};
		expect(filterSearchRecords(file, await restrictions()).documents.map((row) => row.anchor)).toEqual(['document-constitution']);
	});

	it('drops search rows linked to a hidden copy and sends a cited one to the original', async () => {
		const file = {
			nations: [],
			documents: [
				{ title: '1975 constitution', kind: 'constitution', nation: cherokee, anchor: '', link: `/copies/view/${hiddenLaw}` },
				{ title: '1999 constitution', kind: 'constitution', nation: cherokee, anchor: '', link: '/copies/view/constitutions/cherokee-nation/1999.pdf' }
			],
			storyNations: {},
			stateOptions: [],
			regionOptions: []
		};
		const restricted = await restrictions();
		restricted.levels.set('copy:constitutions/cherokee-nation/1999.pdf', 'cite');
		expect(filterSearchRecords(file, restricted).documents).toEqual([{ ...file.documents[1], link: 'https://example.org/1999.pdf' }]);
	});

	it('leaves hidden opinions and laws out of the search index and sends cited opinions to the original', async () => {
		const entries = [
			{ kind: 'case' as const, title: 'Takeda v. Smith', link: `/copies/view/${hiddenOpinion}` },
			{ kind: 'case' as const, title: 'Doe v. Roe', link: `/copies/view/${citedOpinion}` },
			{ kind: 'reference' as const, title: '1975 proposed constitution', link: `/copies/view/${hiddenLaw}` },
			{ kind: 'reference' as const, title: 'Code', link: `/nations/${cherokee}#document-code` },
			{ kind: 'case' as const, title: 'Worcester v. Georgia', link: '/cases/worcester-v-georgia' }
		];
		expect(filterSearchIndex(entries, await restrictions())).toEqual([
			{ kind: 'case', title: 'Doe v. Roe', link: 'https://static.case.law/2.html' },
			{ kind: 'case', title: 'Worcester v. Georgia', link: '/cases/worcester-v-georgia' }
		]);
	});

	it('drops hidden copies from the copies list and takes the copy off cited ones, keeping the file’s form', async () => {
		const csv = [
			'title,nations,copy,published_at,captured,bytes,sha256',
			`1975,Cherokee Nation,/copies/${hiddenLaw},https://example.org/1975.pdf,2026-11-20,50,aa`,
			`"Doe v. Roe, 2000",Cherokee Nation,/copies/${citedOpinion},https://static.case.law/2.html,2026-11-20,20,bb`,
			'Statute,,/copies/govinfo/s.pdf,https://govinfo.gov/s.pdf,2026-11-20,10,cc',
			''
		].join('\n');
		expect(filterCopiesCsv(csv, await restrictions())).toBe(
			[
				'title,nations,copy,published_at,captured,bytes,sha256',
				'"Doe v. Roe, 2000",Cherokee Nation,,https://static.case.law/2.html,2026-11-20,,',
				'Statute,,/copies/govinfo/s.pdf,https://govinfo.gov/s.pdf,2026-11-20,10,cc',
				''
			].join('\n')
		);
	});

	it('leaves hidden and cited copies out of offline lists, and hidden ones out of copy details', async () => {
		const r = await restrictions();
		const list = { title: 'Cherokee Nation', files: [[`/copies/${hiddenLaw}`, 1], [`/copies/${citedOpinion}`, 2], ['/copies/constitutions/cherokee-nation/1999.pdf', 3]] };
		expect(filterOfflineList(list, r).files).toEqual([list.files[2]]);
		const details = { [hiddenLaw]: { title: '1975' }, [citedOpinion]: { title: 'Doe' } } as never;
		expect(Object.keys(filterCopyDetails(details, r))).toEqual([citedOpinion]);
	});

	it('takes hidden laws off timelines, links cited ones to their originals and leaves hidden opinions uncounted', async () => {
		const r = await restrictions();
		const row = (kind: string, date: string, title: string, link: string) => ({ date, kind, title, citation: '', detail: '', nations: '', link });
		const rows = [
			row('Laws and agreements', '1975-09-05', 'Constitution, 1975 proposed constitution', `/copies/view/${hiddenLaw}`),
			row('Laws and agreements', '2001-01-01', 'Code, 2001 code', `/nations/${cherokee}#document-code`),
			row('Laws and agreements', '1999-07-26', 'Constitution, 1999 constitution', '/copies/view/constitutions/cherokee-nation/1999.pdf'),
			row('Tribal court opinions', '1999', '1 published opinion', ''),
			row('Tribal court opinions', '2000', '3 published opinions', '')
		];
		expect(filterTimelineRows(rows, r, cherokee).map((entry) => entry.title)).toEqual(['Constitution, 1999 constitution', '3 published opinions']);
		const site = [row('Tribal court opinions', '1999', '4 published opinions', '/nations/navajo-nation/opinions')];
		expect(filterTimelineRows(site, r)[0].title).toBe('3 published opinions');
	});

	it('takes rows linked to hidden copies out of Find the law and the table builder, and the words off cited opinions', async () => {
		const r = await restrictions();
		expect(filterLawItems([{ link: `/copies/view/${hiddenLaw}` }, { link: `/copies/view/${citedOpinion}` }, {}], r)).toEqual([{ link: 'https://static.case.law/2.html' }, {}]);
		const opinions = {
			identifier: 'opinions',
			columns: [{ key: 'name' }, { key: 'citation' }, { key: 'topics' }],
			rows: [
				['Takeda v. Smith', '1 Am. Tribal Law 1', ['custom']],
				['Doe v. Roe', '1 Am. Tribal Law 2', ['peacemaking']],
				['Other v. Other', '1 Am. Tribal Law 3', ['gaming']]
			],
			links: [`/copies/view/${hiddenOpinion}`, `/copies/view/${citedOpinion}`, '/copies/view/other.html']
		};
		const filtered = filterBuilderFile(opinions, r);
		expect(filtered.rows).toEqual([['Doe v. Roe', '1 Am. Tribal Law 2', null], opinions.rows[2]]);
		expect(filtered.links).toEqual(['https://static.case.law/2.html', '/copies/view/other.html']);
	});
});

describe('pages drawn again', () => {
	it('knows which pages can be', () => {
		expect(restrictedPageView('/nations/cherokee-nation')?.view).toBe('nation');
		expect(restrictedPageView('/nations/timeline')?.view).toBe('timeline');
		expect(restrictedPageView('/nations/map')).toBeUndefined();
		expect(restrictedPageView('/nations/data/tribal-opinions-by-decade/1990s')?.view).toBe('chart-bar');
		expect(restrictedPageView('/nations/data/tribal-opinions-by-decade/sources')).toBeUndefined();
	});

	it('takes hidden items off a nation’s page, with their References and outline entries', async () => {
		const r = await restrictions();
		const data = {
			opinions: { count: 3, shown: [{ key: hiddenOpinion, topics: ['custom'] }, { key: citedOpinion, topics: ['peacemaking'] }] },
			documents: [
				{ id: 'constitution', heading: 'Constitution', versions: [{ id: '1975-proposed', label: '1975 proposed constitution', link: `/copies/view/${hiddenLaw}` }, { id: '1999', label: '1999 constitution', link: '/copies/view/constitutions/cherokee-nation/1999.pdf' }] },
				{ id: 'code', heading: 'Code', versions: [{ id: '2001', label: '2001 code' }] }
			],
			timeline: { entries: [{ id: 'document-constitution-1975-proposed', kind: 'document', date: '1975-09-05', title: 'Constitution, 1975 proposed constitution', link: `/copies/view/${hiddenLaw}` }], opinions: [{ year: 1999, count: 1 }] },
			sources: [
				{ number: 1, groups: [{ section: 'Constitution', facts: ['1975 proposed constitution'] }] },
				{ number: 2, groups: [{ section: 'Constitution', facts: ['1975 proposed constitution', '1999 constitution'] }] }
			],
			outline: { items: [{ label: 'Laws and agreements', link: '#law-heading', children: [{ link: '#document-constitution' }, { link: '#document-code' }] }] }
		};
		const page = filterNationPage(data, r, cherokee) as typeof data;
		expect(page.opinions).toEqual({ count: 3, shown: [{ key: citedOpinion, topics: [] }] });
		expect(page.documents.map((document) => [document.id, document.versions.map((version) => version.id)])).toEqual([['constitution', ['1999']]]);
		expect(page.timeline).toEqual({ entries: [], opinions: [] });
		expect(page.sources).toEqual([{ number: 2, groups: [{ section: 'Constitution', facts: ['1999 constitution'] }] }]);
		expect(page.outline.items[0].children).toEqual([{ link: '#document-constitution' }]);
		expect(JSON.stringify(page)).not.toMatch(/1975|Takeda|0001-01/);
	});

	it('counts a chart bar without hidden opinions', async () => {
		const r = await restrictions();
		const data = {
			bar: { value: 1201, label: '1990s' },
			description: 'The 1,201 published tribal court opinions counted under “1990s”.',
			rows: [{ key: hiddenOpinion, cells: { opinion: { text: 'Takeda v. Smith', href: `/copies/view/${hiddenOpinion}` } } }, { key: 'other.html', cells: {} }]
		};
		const page = filterChartBarPage(data, r) as typeof data;
		expect(page.bar.value).toBe(1200);
		expect(page.description).toBe('The 1,200 published tribal court opinions counted under “1990s”.');
		expect(page.rows.map((row) => row.key)).toEqual(['other.html']);
	});

	it('takes hidden laws and opinions off the full timeline', async () => {
		const r = await restrictions();
		const kinds = timelineKinds.map(({ kind }) => kind);
		const data = {
			nations: [{ id: cherokee }, { id: 'navajo-nation' }],
			entries: [[kinds.indexOf('document'), '1975-09-05', 'Constitution, 1975 proposed constitution', '', '', `/copies/view/${hiddenLaw}`, [0], 0]],
			opinions: [[1999, 2, 1, []], [1999, 1, 0, []]]
		};
		const page = filterTimelinePage(data, r, kinds) as typeof data;
		expect(page.entries).toEqual([]);
		expect(page.opinions).toEqual([[1999, 1, 1, []]]);
	});
});
