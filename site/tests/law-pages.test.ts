import { describe, expect, it, vi } from 'vitest';
import { presidentOn } from '#lib/president-terms.ts';
import { sources } from '#lib/server/content.ts';
import { nationsCiting, orderNumber, orderPresident } from '#lib/server/law-facts.ts';
import { isLawRecord, recordName } from '#lib/server/law-records.ts';
import { formatSource } from '#lib/server/markdown.ts';
import { mediaLabel, servedMediaTypes } from '#lib/public-copies.ts';

vi.mock('virtual:source-citations', () => ({ sourceCitations: {} }));
vi.mock('virtual:essay-library', () => ({ essaysInGit: {} }));
vi.mock('$app/env', () => ({ version: 'test-build' }));
vi.mock('cloudflare:workers', () => ({ env: {}, waitUntil: () => undefined }));

const jemez = 'executive-order-1906-12-19-537';

describe('An executive order’s page', () => {
	const orders = () => [...sources().values()].filter((record) => record.kind === 'executive-order');

	it('every executive order has one', () => {
		expect(orders().length).toBeGreaterThan(560);
		expect(orders().filter((record) => !isLawRecord(record)).map((record) => record.key)).toEqual([]);
	});

	it('gives the order’s number and the President who signed it', () => {
		const record = sources().get(jemez)!;
		expect(orderNumber(record)).toBe('537');
		expect(orderPresident(record)).toMatchObject({ name: 'Theodore Roosevelt', key: 'theodore-roosevelt' });
		expect(orderNumber(sources().get('executive-order-14053')!)).toBe('14053');
	});

	it('writes a date in its title as the style guide does', () => {
		expect(recordName(jemez).name).toBe('Executive Order No. 537 of Dec. 19, 1906');
	});

	it('lists the nation pages that cite it, with what each cites it for', () => {
		expect(nationsCiting(jemez)).toEqual([{ id: 'pueblo-of-jemez', name: 'Pueblo of Jemez', what: ['Jemez Pueblo additional lands, New Mexico'] }]);
	});

	it('serves the order’s saved text', () => {
		expect(servedMediaTypes.has('text/plain')).toBe(true);
		expect(mediaLabel('text/plain')).toBe('text');
	});

	it('names the President for every order with a full date', () => {
		const missing = orders().filter((record) => (record.citation.issued?.['date-parts']?.[0]?.length ?? 0) === 3 && !orderPresident(record));
		expect(missing.map((record) => record.key)).toEqual([]);
	});

	it('takes the President its record names over the one its date gives, where the record’s date is off', () => {
		// The database dates Exec. Order No. 8358 to 1925 from a date in its text; Franklin D. Roosevelt signed it in 1940.
		expect(orderPresident(sources().get('executive-order-8358')!)?.key).toBe('franklin-d-roosevelt');
	});
});

describe('Who was President on a day', () => {
	it('goes to the incoming President on inauguration day and to the successor on the day of the oath', () => {
		expect(presidentOn('1906-12-19')?.key).toBe('theodore-roosevelt');
		expect(presidentOn('1913-03-04')?.key).toBe('woodrow-wilson');
		expect(presidentOn('1913-03-03')?.key).toBe('william-h-taft');
		expect(presidentOn('1865-04-15')?.key).toBe('andrew-johnson');
		expect(presidentOn('1886-01-01')?.name).toBe('Grover Cleveland');
		expect(presidentOn('2025-02-01')?.key).toBe('donald-j-trump');
	});

	it('names nobody for a year alone or a day before 1789', () => {
		expect(presidentOn('1906')).toBeUndefined();
		expect(presidentOn('1788-12-31')).toBeUndefined();
	});
});

describe('A reference to a law with its own page', () => {
	it('links the law’s title to the page', () => {
		expect(formatSource(sources().get(jemez), jemez)).toContain(`<a class="source-page" href="/laws/${jemez}">`);
	});

	it('leaves a source without a page as it was', () => {
		const other = [...sources().values()].find((record) => record.kind === 'web-page')!;
		expect(formatSource(other, other.key)).not.toContain('source-page');
	});
});

describe('Title 25 of the Code and of the regulations', () => {
	it('lists a chapter’s sections, each linking into our copy of the chapter at its page', async () => {
		const { sectionsOf } = await import('#lib/server/title-25-sections.ts');
		const chapter = sectionsOf('usc-25-chapter-45')!;
		expect(chapter.kind).toBe('code');
		const reorganization = chapter.inForce.find((section) => section.label === '§ 5123')!;
		expect(reorganization).toMatchObject({ anchor: 'sec-5123', heading: expect.stringMatching(/^Organization of Indian tribes/) });
		expect(reorganization.link).toMatch(/^\/copies\/united-states-code\/2024\/title-25-chapter-45\.pdf#page=\d+$/);
		expect(reorganization.act).toMatchObject({ link: '/laws/indian-reorganization-act-1934' });
	});

	it('lists a part’s sections, linking to the eCFR', async () => {
		const { sectionsOf } = await import('#lib/server/title-25-sections.ts');
		const part = sectionsOf('cfr-25-part-11-courts-of-indian-offenses')!;
		expect(part.kind).toBe('regulations');
		expect(part.inForce.find((section) => section.label === '§ 11.100')?.link).toBe('https://www.ecfr.gov/current/title-25/section-11.100');
	});

	it('gives an Act the sections it enacted, linking to each section’s own page', async () => {
		const { sectionsEnactedBy } = await import('#lib/server/title-25-sections.ts');
		const enacted = sectionsEnactedBy('indian-reorganization-act-1934');
		expect(enacted.map((section) => section.label)).toContain('25 U.S.C. § 5123');
		expect(enacted.find((section) => section.label === '25 U.S.C. § 5123')?.link).toBe('/laws/usc-25/5123');
	});

	it('gives every Act a Title 25 section names a record, and every Act record a page', () => {
		const acts = [...sources().values()].filter((record) => (record as { found_in?: string[] }).found_in?.includes('2026-11-26-title-25-acts'));
		expect(acts.length).toBeGreaterThan(250);
		expect(acts.filter((record) => !isLawRecord(record)).map((record) => record.key)).toEqual([]);
	});
});

describe('A state statute section’s page', () => {
	const tribalCourts = 'oklahoma-statutes-title-12-section-728';

	it('every Oklahoma section the state statutes pilot found has one, labeled core or incidental', () => {
		const statutes = [...sources().values()].filter((record) => record.kind === 'state-statute' && record.state_law);
		expect(statutes.filter((record) => !isLawRecord(record))).toEqual([]);
		const oklahoma = statutes.filter((record) => ((record as typeof record & { jurisdictions?: { state?: string }[] }).jurisdictions ?? []).some((place) => place.state === 'OK'));
		expect(oklahoma.length).toBe(381);
		expect(oklahoma.filter((record) => record.state_law!.relevance === 'core').length).toBe(101);
	});

	it('is named by its citation, with no year after it', () => {
		expect(recordName(tribalCourts).name).toBe('Okla. Stat. tit. 12, § 728');
	});

	it('gives its state, its label and its Indigo Book citation, and links the official text', async () => {
		const { lawPage } = await import('#lib/server/law-pages.ts');
		const page = lawPage(tribalCourts);
		if ('movedTo' in page) throw new Error('A state statute is not a Title 25 section.');
		expect(page.citation).toBe('Okla. Stat. tit. 12, § 728 (2026)');
		expect(page.fullTitle).toBe('Standards for recognizing records and proceedings of tribal courts - Reciprocity');
		const glance = Object.fromEntries(page.glance.map((group) => [group.label, group.items.map((item) => item.text).join('; ')]));
		expect(glance).toMatchObject({ Type: 'State statute', State: 'Oklahoma', 'Indian law': 'Core', Enacted: 'Sept. 1, 1992' });
		expect(page.readingHtml).toContain('href="https://www.oklegislature.gov/OK_Statutes/CompleteTitles/os12.pdf#page=160"');
	});
});

describe('Title 25 as an outline', () => {
	it('gives every section its own page, with its place, status and neighbors', async () => {
		const { sectionPage, titleTwentyFiveSectionLink } = await import('#lib/server/code-outline.ts');
		expect(titleTwentyFiveSectionLink('5321')).toBe('/laws/usc-25/5321');
		expect(titleTwentyFiveSectionLink('13–1')).toBe('/laws/usc-25/13-1');
		expect(titleTwentyFiveSectionLink('99999')).toBeUndefined();
		const page = sectionPage('5321');
		expect(page.name).toBe('§ 5321. Self-determination contracts');
		expect(page.status).toBe('in force');
		expect(page.trail.map((crumb) => crumb.label)).toEqual(['Federal law', 'U.S. Code, Title 25', 'Chapter 46', 'Subchapter I']);
		expect(page.previous?.number).toBe('§ 5310');
		expect(page.next?.number).toBe('§ 5322');
		expect(page.movedFrom.map((from) => from.label)).toContain('§ 450f');
	});

	it('says where a moved section went', async () => {
		const { sectionPage } = await import('#lib/server/code-outline.ts');
		const page = sectionPage('450f');
		expect(page.status).toBe('moved');
		expect(page.movedTo).toEqual({ label: '§ 5321', link: '/laws/usc-25/5321' });
	});

	it('sends an older record of one section to the section’s page', async () => {
		const { lawPage } = await import('#lib/server/law-pages.ts');
		expect(lawPage('us-code-title-25-section-232')).toEqual({ movedTo: '/laws/usc-25/232' });
		expect(lawPage('usc-25-5329-c-model-agreement-disputes')).toEqual({ movedTo: '/laws/usc-25/5329' });
	});

	it('shows the official text kept for a section’s older record', async () => {
		const { sectionPageData } = await import('#lib/server/law-pages.ts');
		expect(sectionPageData('1911').text).toMatchObject({ isPdf: true });
		expect(sectionPageData('5321').text).toBeUndefined();
	});

	it('lists a chapter’s contents under its subchapters', async () => {
		const { contentsOf } = await import('#lib/server/code-outline.ts');
		const groups = contentsOf('6');
		expect(groups.map((group) => group.label)).toEqual(['Subchapter I', 'Subchapter II', 'Subchapter III']);
		expect(groups[0].rows[1]).toMatchObject({ label: '§§ 212–215', status: 'repealed', note: 'June 25, 1948, ch. 645, §21, 62 Stat. 862' });
	});
});

describe('A congressional document’s page and a law’s legislative history', () => {
	it('gives every hearing, report, print and Congressional Research Service product a page', () => {
		const documents = [...sources().values()].filter((record) => record.kind === 'congressional-document');
		expect(documents.length).toBeGreaterThan(5000);
		expect(documents.filter((record) => !isLawRecord(record)).map((record) => record.key)).toEqual([]);
	});

	it('names the report’s committee, Congress and the law it is the history of', async () => {
		const { lawPage } = await import('#lib/server/law-pages.ts');
		const page = lawPage('senate-report-100-157');
		if ('movedTo' in page) throw new Error('A Senate report is not a Title 25 section.');
		const facts = Object.fromEntries(page.glance.map((group) => [group.field, group.items.map((item) => item.text)]));
		expect(facts.kind).toEqual(['Senate report']);
		expect(facts.committee).toEqual(['Permanent Select Committee on Indian Affairs']);
		expect(facts.congress).toEqual(['100th Congress, 1st session']);
		expect(page.glance.find((group) => group.field === 'laws')?.items[0]).toMatchObject({ link: '/laws/public-law-100-139' });
	});

	it('lists the reports on the bill under the law’s Legislative history, oldest first', async () => {
		const { lawPage } = await import('#lib/server/law-pages.ts');
		const page = lawPage('public-law-100-139');
		if ('movedTo' in page) throw new Error('A public law is not a Title 25 section.');
		const history = page.legislativeHistory;
		expect(history).toContainEqual({ name: 'S. Rep. No. 100-157', link: '/laws/senate-report-100-157', detail: 'Senate report, 1987' });
	});
});
