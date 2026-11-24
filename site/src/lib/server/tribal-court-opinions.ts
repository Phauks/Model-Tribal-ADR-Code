/**
 * Tribal court opinions the website shows (decision record 0047, Trevor,
 * Nov. 23, 2026): the opinions in the Caselaw Access Project's American Tribal
 * Law Reporter and Navajo Reporter, each served as its own page from the
 * private bucket at /copies/caselaw-access-project/…
 *
 * The list is research/tribal-court-opinions/opinions.csv, written by
 * scripts/caselaw/tribal_court_opinions.py. An opinion is shown only while its
 * page is a copy the site serves (src/lib/server/content.ts, publicCopies), so
 * a nation's removal request, carried out in the capture index overrides,
 * takes it off every list too.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../csv.ts';
import { mentionWords } from '../opinion-mentions.ts';
import { copyPagePath, removalRequestPath } from '../public-copies.ts';
import { publicCopies, redactedOpinionKeys, repositoryRoot } from './content.ts';

/** The key of the dataset's source record (content/sources/c/). */
export const opinionsSourceKey = 'caselaw-access-project-tribal-reporters';


export interface TribalCourtOpinion {
	name: string;
	citation: string;
	court: string;
	/** YYYY-MM-DD */
	decided: string;
	year: string;
	docket: string;
	nations: string[];
	/** Topic tags, as words: they mean the words appear in the opinion, not what it decides. */
	topics: string[];
	/** The opinion's key in the bucket (src/lib/public-copies.ts). */
	key: string;
	/** Its page on this site, with the site's masthead and sidebar around it. */
	path: string;
	removal: string;
	/** Protected people's names are replaced by initials (research/tribal-court-opinions/redacted.csv). */
	namesReplaced: boolean;
	/** The Caselaw Access Project's own page of the opinion, which an opinion the nation asked to cite only links to. Empty for a redacted opinion, whose original still has the names. */
	original: string;
}

let opinionCache: TribalCourtOpinion[] | undefined;

/** Every opinion the site shows, newest first. */
export function tribalCourtOpinions(): TribalCourtOpinion[] {
	if (!opinionCache) {
		const file = path.join(repositoryRoot, 'research/tribal-court-opinions/opinions.csv');
		const rows = existsSync(file) ? parseCsv(readFileSync(file, 'utf8')) : [];
		const served = new Set(publicCopies().map((copy) => copy.key));
		const redacted = redactedOpinionKeys();
		opinionCache = rows
			.filter((row) => row.copy_key && served.has(row.copy_key))
			.map((row) => {
				const tags = row.topics.split(';').map((tag) => tag.trim()).filter(Boolean);
				return {
					name: row.name,
					citation: row.citation,
					court: row.court,
					decided: row.decision_date,
					year: row.decision_date.slice(0, 4),
					docket: row.docket_number,
					nations: row.nations.split(';').map((nation) => nation.trim()).filter(Boolean),
					topics: tags.map((tag) => mentionWords[tag] ?? tag.replaceAll('-', ' ')),
					key: row.copy_key,
					path: copyPagePath({ key: row.copy_key }),
					removal: removalRequestPath({ key: row.copy_key }),
					namesReplaced: redacted.has(row.copy_key),
					original: redacted.has(row.copy_key) ? '' : row.link
				};
			})
			.sort((first, second) => second.decided.localeCompare(first.decided) || first.name.localeCompare(second.name));
	}
	return opinionCache;
}

/** One nation's opinions, newest first. */
export function opinionsOf(nationId: string): TribalCourtOpinion[] {
	return tribalCourtOpinions().filter((opinion) => opinion.nations.includes(nationId));
}

/** The nations that have at least one opinion. */
export function nationsWithOpinions(): string[] {
	return [...new Set(tribalCourtOpinions().flatMap((opinion) => opinion.nations))];
}
