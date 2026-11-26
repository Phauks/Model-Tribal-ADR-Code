/**
 * Every stub on the site (src/lib/stubs.ts), most mentioned first, for
 * Workspace › Stubs: what Wikipedia's lists of stubs and wanted pages give
 * its editors (design /mnt/project-files/design/stub-pages/). Made when the
 * site is built, as /stubs.json.
 */
import { biographies, biographyPage } from './biographies.ts';
import { caseKeys, casePage } from './case-pages.ts';
import { courtPage, courts } from './courts.ts';
import { lawKeys, lawPage } from './law-pages.ts';
import type { StubListing } from '../stubs.ts';


function plural(count: number, one: string, many: string): string {
	return `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;
}

export function stubList(): StubListing[] {
	const list: StubListing[] = [];
	for (const court of courts()) {
		const page = courtPage(court.key);
		const parts = [
			page.opinionKeys.length > 0 ? plural(page.opinionKeys.length, 'opinion', 'opinions') : '',
			page.cases.length > 0 ? plural(page.cases.length, 'case', 'cases') : '',
			page.mentions.length > 0 ? plural(page.mentions.length, 'page', 'pages') : ''
		].filter(Boolean);
		list.push({
			kind: 'court',
			name: page.name,
			link: `/courts/${page.key}`,
			made: 'references',
			mentions: page.opinionKeys.length + page.cases.length + page.mentions.length,
			mentionsText: parts.join(', '),
			record: page.stub.record
		});
	}
	for (const key of caseKeys()) {
		const page = casePage(key);
		if (!page.stub) continue;
		const pages = page.essays.length + page.nationPages.length + (page.court ? 1 : 0) + (page.decidedBy ? 1 : 0);
		list.push({ kind: 'case', name: page.name, link: `/cases/${key}`, made: 'short', mentions: pages, mentionsText: pages > 0 ? plural(pages, 'page', 'pages') : '', record: page.stub.record });
	}
	for (const key of lawKeys()) {
		const page = lawPage(key);
		if (!page.stub) continue;
		const pages = page.essays.length;
		list.push({ kind: 'law', name: page.name, link: `/laws/${key}`, made: 'short', mentions: pages, mentionsText: pages > 0 ? plural(pages, 'page', 'pages') : '', record: page.stub.record });
	}
	for (const person of biographies()) {
		const page = biographyPage(person.key);
		if (!page?.stub) continue;
		// Each treaty's page lists its signers, so every treaty is a page that names the person.
		const pages = page.treaties.length;
		list.push({ kind: 'person', name: page.name, link: `/biographies/${person.key}`, made: 'short', mentions: pages, mentionsText: pages > 0 ? plural(pages, 'page', 'pages') : '', record: page.stub.record });
	}
	return list.sort((first, second) => second.mentions - first.mentions || first.name.localeCompare(second.name));
}
