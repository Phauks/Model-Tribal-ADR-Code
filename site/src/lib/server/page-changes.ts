/**
 * A page's own Changes view: the page's changes in the page's place, at its
 * address with /changes after it (Trevor, Nov. 27, 2026, option B of
 * design/page-changes-in-page). The view keeps what the reader saw on the
 * page: the section bar's tab, the side column with the page's family, the
 * breadcrumbs, the title and, on a nation's page, its badges. Only the list
 * below the title changes. It shows what Recent changes shows for one page
 * (src/lib/server/page-history.ts), so nation pages and stories still name
 * the parts that changed, never earlier wording.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { error } from '@sveltejs/kit';
import { nationFamily } from '../nation-family.ts';
import { readFilters, type NationHeading } from '../page-history.ts';
import { navigationSections } from '../site-navigation.ts';
import type { PageFamily } from '../site-sections.ts';
import { readStaticJson } from './built-files.ts';
import { storageForPages } from './essay-pages.ts';
import { claimedBadge, historyBadge } from './nation-page-overlay.ts';
import { claimOf } from './nation-teams.ts';
import { listChanges, pageHistorySummary, pageRecordedSince } from './page-history.ts';
import { builtPages, recordThisBuildOnce } from './page-history-run.ts';

/** The link above a section's pages in the breadcrumbs, by the first part of the address. */
const sectionCrumbs: Record<string, string> = {
	nations: 'Nations',
	stories: 'Stories',
	glossary: 'Glossary',
	essays: 'Essays',
	foundations: 'Foundations',
	'back-matter': 'Back matter',
	licenses: 'Licenses'
};

/** What a nation's page shows on the badge line, for its Changes view. */
export interface NationBadgeLine extends NationHeading {
	identifier: string;
	/** The claimed badge, written by the server, when the nation's team keeps the page. */
	claimedBadge?: string;
	/** The history badge with its count, written by the server. */
	historyBadge?: string;
}

export interface PageChangesOptions {
	/** The page whose changes are shown, as followedPageAddress gives it. */
	address: string;
	account: string | undefined;
	setHeaders: (headers: Record<string, string>) => void;
	/** The pages the root layout lists beside this one, such as the essays of Foundations, which name it. */
	pagesBeside?: PageFamily;
}

export async function pageChangesView({ address, account, setHeaders, pagesBeside }: PageChangesOptions) {
	const { database, bucket } = storageForPages();
	await recordThisBuildOnce(database, bucket);
	const filters = readFilters(new URLSearchParams({ page: address }));
	const directory = await builtPages();
	const list = await listChanges(database, filters, directory, new Date(), account);
	// "Only pages I follow" is never asked here, but a signed-in reader's page is still not shared.
	setHeaders({ 'cache-control': account ? 'private, max-age=0' : 'public, max-age=60' });

	const listed = directory.get(address);
	const nationIdentifier = /^\/nations\/([a-z0-9-]+)$/.exec(address)?.[1];
	const nation = nationIdentifier ? await nationBadgeLine(database, nationIdentifier, address) : undefined;
	// A page with no recorded changes, such as an essay or About the Project, is named by its link beside or in a menu.
	const linkedAs = (pagesBeside?.pages ?? []).find((item) => item.link === address)?.label ?? menuLabel(address);
	const title = nation?.name ?? listed?.title ?? list.changes.find((change) => change.title)?.title ?? linkedAs;
	const pageOnSite = Boolean(listed || nation || linkedAs) || list.changes.some((change) => change.change !== 'removed' && change.title);
	if (!title) error(404, 'No page has this address.');

	const section = address.split('/')[1];
	const trail = [
		...(address.split('/').length > 2 && sectionCrumbs[section] ? [{ label: sectionCrumbs[section], href: `/${section}` }] : []),
		...(pageOnSite ? [{ label: title ?? address, href: address }] : [])
	];
	const family: PageFamily | undefined = nation ? nationFamily(nation.identifier, nation.name, nation.opinions) : undefined;

	return {
		/** The page these are the changes of: the side column marks its "Changes to This Page" link. */
		historyOf: address,
		pageTitle: title ?? address,
		pageKind: listed?.kind ?? list.changes[0]?.kind,
		pageOnSite,
		changes: list.changes,
		// A page that has not changed since the history began still shows the version readers see.
		recordedSince: list.changes.length === 0 ? await pageRecordedSince(database, address) : undefined,
		trail,
		nation,
		// A nation's own pages; the layout gives the essays theirs.
		...(family ? { family } : {})
	};
}

/** The label of a link to the page in the section menus, such as "About the Project". */
function menuLabel(address: string): string | undefined {
	for (const section of navigationSections) {
		for (const group of section.groups) {
			const link = group.links.find((item) => item.link === address && !item.soon);
			if (link) return link.label;
		}
	}
	return undefined;
}

async function nationBadgeLine(database: D1Database, identifier: string, address: string): Promise<NationBadgeLine | undefined> {
	const heading = await readStaticJson<NationHeading>(`/nations/${identifier}/heading.json`).catch((problem: unknown) => {
		console.error('Could not read the nation page’s heading', problem);
		return undefined;
	});
	if (!heading) return undefined;
	const [claim, history] = await Promise.all([claimOf(database, identifier), pageHistorySummary(database, address)]);
	return {
		...heading,
		identifier,
		claimedBadge: claim ? claimedBadge(identifier, claim) : undefined,
		historyBadge: historyBadge(identifier, history)
	};
}

/** What a page's Changes view draws (src/lib/components/PageChangesView.svelte). */
export type PageChangesData = Awaited<ReturnType<typeof pageChangesView>>;
