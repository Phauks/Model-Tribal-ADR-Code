/**
 * Checks and data shared by the workspace's essay pages: each page and
 * action checks the person's level on the essay itself (decision record
 * 0023): comment to read drafts, contribute to save versions, full to
 * publish, restore, hold back or bring in the git text.
 */
import { error } from '@sveltejs/kit';
import { essaysInGit } from 'virtual:essay-library';
import { atLeast, everyDocument, type AccessLevel } from '#lib/permissions.ts';
import { accessTo, requireDocumentLevel } from './access.ts';
import { isEssayIdentifier, sha256Hex, type EssaySummary } from './essays.ts';
import { requirePerson, storage } from './workspace.ts';
import type { SignedInPerson } from './people.ts';
import type { D1Database } from '@cloudflare/workers-types/index.ts';

interface WorkspaceEvent {
	locals: App.Locals;
	url: URL;
	params: Partial<Record<string, string>>;
}

/** The essay named in the address, and the person's level on it (at least `minimum`). */
export async function essayAccess(event: WorkspaceEvent, minimum: AccessLevel) {
	const person = requirePerson(event);
	const identifier = event.params.id ?? '';
	if (!isEssayIdentifier(identifier)) error(404, 'No essay has this address.');
	const { database, bucket } = storage(event);
	const access = await requireDocumentLevel(event, database, { kind: 'essay', identifier }, minimum);
	return { person, identifier, database, bucket, level: access.level };
}

export async function levelOn(database: D1Database, person: SignedInPerson, identifier: string): Promise<AccessLevel> {
	return (await accessTo(database, person, { kind: 'essay', identifier })).level;
}

/** Whether the person may start a new essay: full access to every essay. */
export async function canStartEssays(database: D1Database, person: SignedInPerson): Promise<boolean> {
	return atLeast(await levelOn(database, person, everyDocument), 'full');
}

/** The essays in git when the site was built, and whether each differs from the bucket's latest version. */
export async function gitCopies(summaries: EssaySummary[], latestHashes: Map<string, string>) {
	const known = new Map(summaries.map((summary) => [summary.identifier, summary]));
	return Promise.all(
		Object.entries(essaysInGit).map(async ([identifier, text]) => {
			const normalized = text.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\s*$/, '\n');
			const hash = await sha256Hex(normalized);
			return {
				identifier,
				inBucket: known.has(identifier),
				sameAsLatest: latestHashes.get(identifier) === hash
			};
		})
	);
}

export function gitText(identifier: string): string | undefined {
	return essaysInGit[identifier];
}
