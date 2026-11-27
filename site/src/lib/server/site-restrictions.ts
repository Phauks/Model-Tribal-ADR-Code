/**
 * What every nation has chosen the site shows of its own laws and court
 * opinions, gathered for the files made when the site is built: the search
 * records, the copies lists, the timelines, the data sets and the
 * prerendered pages (src/lib/restricted-files.ts). Those files cannot know
 * the choices, so the Worker filters them when they are asked for
 * (tools/nation-page-changes-worker.js sends them to src/routes/restricted).
 *
 * Most of the time no nation restricts anything, and one small query says
 * so. Otherwise the choices are read once and kept until a nation saves a
 * new one: the count of saves and the newest save's time name the state.
 * Nothing here is ever sent to a reader: it names what nations asked to keep
 * out of view.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { readSettings, type RestrictionSettings } from '../nation-restrictions.ts';
import type { SiteRestrictions } from '../restricted-files.ts';
import { restrictableCopies } from './copy-list.ts';
import { gatherRestrictions, restrictableList } from './nation-restrictions.ts';
import { report } from './report.ts';
import { restrictionStamp, restrictionStampSql, type RestrictionStampRow } from './restriction-stamp.ts';

type Assets = { fetch: (input: string) => Promise<Response> };

let cached: { stamp: string; value: Promise<SiteRestrictions | undefined> } | undefined;

function parse(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch (problem) {
		// As in nation-restrictions.ts: reported, with what a damaged row means left for Trevor to decide.
		report(problem, { code: 'nation-restrictions.read', place: 'site-restrictions' });
		return undefined;
	}
}

/** Each nation's setting in force: its newest save. */
async function allSettings(database: D1Database): Promise<Map<string, RestrictionSettings>> {
	const result = await database
		.prepare(
			`SELECT nation_identifier AS nationIdentifier, settings FROM (
				SELECT nation_identifier, settings,
				       ROW_NUMBER() OVER (PARTITION BY nation_identifier ORDER BY made_at DESC, rowid DESC) AS position
				FROM nation_restriction_changes
			) WHERE position = 1`
		)
		.all<{ nationIdentifier: string; settings: string }>();
	return new Map(result.results.map((row) => [row.nationIdentifier, readSettings(parse(row.settings))]));
}

/**
 * What every nation restricts now, or undefined when none restricts
 * anything (or the database cannot be read, when the files are served as
 * built rather than not at all).
 */
export async function siteRestrictions(database: D1Database | undefined, assets: Assets | undefined, origin: string): Promise<SiteRestrictions | undefined> {
	if (!database) return undefined;
	let stamp: string;
	try {
		const row = await database.prepare(restrictionStampSql).first<RestrictionStampRow>();
		const read = restrictionStamp(row);
		if (!read) return undefined;
		stamp = read;
	} catch (problem) {
		console.error('Nation restrictions could not be read', problem);
		return undefined;
	}
	if (cached?.stamp !== stamp) {
		const url = new URL(origin);
		const value = allSettings(database)
			.then(async (settings) => gatherRestrictions(settings, (nation) => restrictableList(nation, url, fetch, assets), await restrictableCopies(), stamp))
			.catch((problem) => {
				console.error('Nation restrictions could not be gathered', problem);
				cached = undefined;
				return undefined;
			});
		cached = { stamp, value };
	}
	return cached.value;
}
