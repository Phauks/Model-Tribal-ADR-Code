/**
 * Deleting an account at the person's request (docs/contributor-profiles.md,
 * "Deleting an account"). Nothing is kept that could reach or identify the
 * person, except their name on work they helped with, and only if they chose
 * to keep it.
 *
 * What goes: the account, its sessions and unused sign-in codes, and the
 * contributor profile with every confirmed version and the profile picture. What stays: a workspace
 * member's row in `people` (reviews, drafts and the sealed activity log point
 * to it), with the email address and sign-in removed and the name kept or
 * replaced; and signed forms, which are records of consent and are changed or
 * withdrawn through the change or withdrawal request. Files the person sent
 * are deleted unless they were filed or kept for reference (docs/uploads.md,
 * "Deleting").
 */
import type { D1Database, D1PreparedStatement, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { creditOf } from '#lib/contributors.ts';
import type { SignedInAccount } from './contributor-profiles.ts';
import { profileBySubject } from './contributor-profiles.ts';
import { eventStatement } from './events.ts';
import { newIdentifier, now } from './identifiers.ts';
import { forgetAccountUploads } from './uploads.ts';

/** The name shown on work by someone who deleted their account and chose to remove their name. */
export const formerContributorName = 'Former contributor';

export type DeletionResult = { outcome: 'deleted' } | { outcome: 'last-lead-author' };

export async function deleteAccount(
	database: D1Database,
	account: SignedInAccount,
	keepName: boolean,
	bucket?: R2Bucket
): Promise<DeletionResult> {
	const person = await database
		.prepare(`SELECT identifier, role FROM people WHERE sign_in_subject = ? AND status != 'removed'`)
		.bind(account.subject)
		.first<{ identifier: string; role: string }>();
	if (person?.role === 'lead-author') {
		const others = await database
			.prepare(`SELECT COUNT(*) AS count FROM people WHERE role = 'lead-author' AND status != 'removed' AND identifier != ?`)
			.bind(person.identifier)
			.first<{ count: number }>();
		if (!others?.count) return { outcome: 'last-lead-author' };
	}

	const statements: D1PreparedStatement[] = [];
	const time = now();
	const profile = await profileBySubject(database, account.subject);
	if (profile) {
		// The credit is taken from the last confirmed version, as for printing.
		const confirmed = profile.confirmedVersion
			? await database
					.prepare('SELECT snapshot FROM contributor_profile_versions WHERE profile_identifier = ? AND version = ?')
					.bind(profile.identifier, profile.confirmedVersion)
					.first<{ snapshot: string }>()
			: null;
		const credit = confirmed ? creditOf(JSON.parse(confirmed.snapshot)) : null;
		if (keepName && credit && profile.status === 'welcomed' && profile.creditSection) {
			statements.push(
				database
					.prepare(
						`INSERT INTO retained_credits (identifier, section, line, sort_key, biography, in_book, on_website, retained_at)
						 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
					)
					.bind(
						newIdentifier(),
						profile.creditSection,
						credit.line,
						credit.sortKey,
						credit.biography,
						credit.inBook ? 1 : 0,
						credit.onWebsite ? 1 : 0,
						time
					)
			);
		}
		statements.push(database.prepare('DELETE FROM contributor_profiles WHERE identifier = ?').bind(profile.identifier));
	}
	if (person) {
		statements.push(
			database
				.prepare(
					`UPDATE people
					 SET status = 'removed', sign_in_subject = NULL, email = ?,
					     display_name = CASE WHEN ? THEN display_name ELSE ? END
					 WHERE identifier = ?`
				)
				// The address is required and unique, so it becomes one that cannot receive mail.
				.bind(`deleted-${person.identifier}@deleted.invalid`, keepName ? 1 : 0, formerContributorName, person.identifier)
		);
	}
	statements.push(
		database.prepare('DELETE FROM sign_in_codes WHERE email = ?').bind(account.email),
		// Sessions go with the account (ON DELETE CASCADE).
		database.prepare('DELETE FROM accounts WHERE identifier = ?').bind(account.subject)
	);
	// The history notes the deletion when there was a profile or workspace access to note it on. An
	// account with neither leaves nothing behind.
	if (profile || person) {
		statements.push(
			eventStatement(database, {
				personIdentifier: person?.identifier ?? null,
				action: keepName ? 'Deleted their account and kept their name on their work' : 'Deleted their account and removed their name',
				targetKind: profile ? 'profile' : 'person',
				targetIdentifier: (profile?.identifier ?? person?.identifier) as string
			})
		);
	}
	// Before the account row goes, because uploads point to it.
	if (bucket) await forgetAccountUploads(database, bucket, account.subject);
	await database.batch(statements);
	if (bucket && profile?.pictureKey) await bucket.delete(profile.pictureKey);
	return { outcome: 'deleted' };
}
