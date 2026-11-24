/**
 * Legal help for a nation's page: Native legal aid, the nation's own legal aid
 * office, self-help centers and legal information sites that serve the
 * nation, from the provider records in research/legal-help/providers and the
 * matches scripts/legal-help/match_nations.py writes to
 * research/legal-help/nation-matches.csv. Trevor chose its own "Legal help"
 * section after Courts, grouped as Legal aid, Self-help and Legal information
 * (option B, Nov. 24, 2026).
 *
 * Each provider is cited to the source its match rests on, such as the Legal
 * Services Corporation's description of a service area. Those sources live in
 * the provider record, not in content/sources, so they get keys of their own
 * (legalHelpSourceKey) that legalHelpCitation formats.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { parseCsv } from '../csv.ts';
import { escapeHtml } from '../escape-html.ts';
import { webLink } from '../contact-links.ts';
import { stateName } from '../nation-labels.ts';
import { repositoryRoot } from './content.ts';
import type { CitationMark } from '../citation-marks.ts';
import type { SourceUses } from './source-uses.ts';

/** The page heading the section and its sources go under. */
export const legalHelpHeading = 'Legal help';

interface ProviderSource {
	id: string;
	title: string;
	publisher?: string;
	link?: string;
	accessed?: string;
}

interface ProviderRecord {
	id: string;
	name: string;
	kind: string;
	status?: string;
	link: string;
	sources: ProviderSource[];
}

interface MatchRow {
	nation: string;
	state: string;
	provider: string;
	kind: string;
	basis: string;
	status: string;
	lsc_service_area: string;
	link: string;
	source: string;
}

/** One provider as the page lists it. */
export interface LegalHelpItem {
	text: string;
	link: string;
	/** What kind of help it is, with "Opening soon" or "Suspended" when it is not open. */
	detail: string;
	/** Why it is listed for this nation. */
	note: string;
	citations: CitationMark[];
}

export interface LegalHelpGroup<Own = LegalHelpItem> {
	field: string;
	label: string;
	items: (LegalHelpItem | Own)[];
}

/** The group each kind of provider is listed under, in the order the page shows the groups. */
const groupOfKind: Record<string, string> = {
	'tribal-legal-aid': 'Legal aid',
	'legal-aid': 'Legal aid',
	'self-help-center': 'Self-help',
	'legal-information-site': 'Legal information'
};
export const legalHelpGroups = ['Legal aid', 'Self-help', 'Legal information'];

const kindWords: Record<string, string> = {
	'tribal-legal-aid': 'The nation’s legal aid office',
	'legal-aid': 'Native legal aid',
	'self-help-center': 'Self-help center',
	'legal-information-site': 'Legal information'
};

const statusWords: Record<string, string> = {
	opening: 'Opening soon',
	suspended: 'Suspended'
};

/** Statuses the page shows; "to-classify" records wait for review and stay off the page. */
const shownStatuses = new Set(['open', 'opening', 'suspended']);

/** Nations' own offices first, then providers that name the nation, then members-only, then statewide ones. */
const basisRank: Record<string, number> = { named: 0, members: 1, statewide: 2 };

let providerCache: Map<string, ProviderRecord> | undefined;
let matchCache: Map<string, MatchRow[]> | undefined;

function providers(): Map<string, ProviderRecord> {
	if (!providerCache) {
		providerCache = new Map();
		const folder = path.join(repositoryRoot, 'research/legal-help/providers');
		for (const name of readdirSync(folder).sort()) {
			if (!name.endsWith('.yaml')) continue;
			const record = parse(readFileSync(path.join(folder, name), 'utf8').normalize('NFC')) as ProviderRecord;
			providerCache.set(record.id, record);
		}
	}
	return providerCache;
}

function matches(): Map<string, MatchRow[]> {
	if (!matchCache) {
		matchCache = new Map();
		const text = readFileSync(path.join(repositoryRoot, 'research/legal-help/nation-matches.csv'), 'utf8').normalize('NFC');
		for (const row of parseCsv(text) as unknown as MatchRow[]) {
			const list = matchCache.get(row.nation) ?? [];
			list.push(row);
			matchCache.set(row.nation, list);
		}
	}
	return matchCache;
}

/** The SourceUses key of a source kept in a provider record. */
export function legalHelpSourceKey(provider: string, source: string): string {
	return `legal-help/${provider}/${source}`;
}

/** A provider record's source as a citation, in the short form of formatSource (src/lib/server/markdown.ts); undefined for other keys. */
export function legalHelpCitation(key: string): string | undefined {
	const [prefix, providerId, sourceId] = key.split('/');
	if (prefix !== 'legal-help' || !providerId || !sourceId) return undefined;
	const source = providers().get(providerId)?.sources.find((candidate) => candidate.id === sourceId);
	if (!source) return undefined;
	let text = [source.publisher ? escapeHtml(source.publisher) : undefined, `<cite>${escapeHtml(source.title)}</cite>`]
		.filter(Boolean)
		.join(', ');
	if (source.accessed) text += ` (accessed ${escapeHtml(source.accessed)})`;
	const link = webLink(source.link);
	if (link) {
		const url = new URL(link);
		text += `. <span class="source-links"><a class="source-original" href="${escapeHtml(url.href)}">${escapeHtml(url.hostname)}</a></span>`;
	}
	return text;
}

/** Why the provider is listed for this nation, in the page's words. */
function basisWords(row: MatchRow): string {
	if (row.basis === 'named') {
		return row.lsc_service_area ? `Serves this nation (Legal Services Corporation area ${row.lsc_service_area})` : 'Serves this nation';
	}
	if (row.basis === 'members') return 'For members of the nation';
	const state = stateName(row.state);
	return row.kind === 'legal-information-site' ? `For anyone in ${state}` : `Serves Native people throughout ${state}`;
}

/**
 * The legal help that serves the nation, grouped as the page shows it.
 * `ownLegalAid` holds the legal aid the nation's own record lists
 * (court_practice, kind legal-aid), which goes first under Legal aid.
 */
export function legalHelpFor<Own>(
	nation: string,
	sources: SourceUses,
	ownLegalAid: Own[] = []
): LegalHelpGroup<Own>[] {
	const rows = (matches().get(nation) ?? []).filter((row) => shownStatuses.has(row.status) && groupOfKind[row.kind]);
	// One line per provider: the strongest reason it serves the nation.
	const best = new Map<string, MatchRow>();
	for (const row of rows) {
		const current = best.get(row.provider);
		if (!current || (basisRank[row.basis] ?? 9) < (basisRank[current.basis] ?? 9)) best.set(row.provider, row);
	}
	const ordered = [...best.values()].sort(
		(first, second) =>
			Number(second.kind === 'tribal-legal-aid') - Number(first.kind === 'tribal-legal-aid') ||
			(basisRank[first.basis] ?? 9) - (basisRank[second.basis] ?? 9) ||
			(providers().get(first.provider)?.name ?? '').localeCompare(providers().get(second.provider)?.name ?? '', 'en')
	);
	const grouped = new Map<string, (LegalHelpItem | Own)[]>();
	if (ownLegalAid.length > 0) grouped.set('Legal aid', [...ownLegalAid]);
	for (const row of ordered) {
		const provider = providers().get(row.provider);
		const link = webLink(row.link || provider?.link);
		if (!provider || !link) continue;
		const label = groupOfKind[row.kind];
		const status = statusWords[row.status];
		const citations: CitationMark[] = [];
		const source = provider.sources.find((candidate) => candidate.id === row.source);
		if (source) {
			sources.cite(
				legalHelpSourceKey(provider.id, source.id),
				{ section: legalHelpHeading, text: `${label}: ${provider.name}`, where: source.accessed ? `as of ${source.accessed}` : undefined },
				citations
			);
		}
		const list = grouped.get(label) ?? [];
		list.push({
			text: provider.name,
			link,
			detail: status ? `${kindWords[row.kind]} · ${status}` : kindWords[row.kind],
			note: basisWords(row),
			citations
		});
		grouped.set(label, list);
	}
	return legalHelpGroups
		.filter((label) => grouped.has(label))
		.map((label) => ({ field: `legal-help-${label}`, label, items: grouped.get(label)! }));
}
