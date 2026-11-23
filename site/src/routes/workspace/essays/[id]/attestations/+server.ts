/**
 * Attestations to an essay's sections (src/lib/server/essay-attestations.ts).
 * GET lists them (comment access or above), with who is asking and
 * whether they may attest to writing or editing. POST attests: writing or
 * editing a section needs contribute access, reviewing it comment access.
 * DELETE ?attestation= withdraws one's own attestation, or anyone's with
 * full access.
 */
import { error, json } from '@sveltejs/kit';
import { essayAccess } from '#lib/server/essay-workspace.ts';
import { attest, essayAttestations, withdrawAttestation } from '#lib/server/essay-attestations.ts';
import { isAttestationRole } from '#lib/essays/attestations.ts';
import { atLeast } from '#lib/permissions.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const GET: RequestHandler = async (event) => {
	const { identifier, database, person, level } = await essayAccess(event, 'comment', { forData: true });
	return json(
		{ attestations: await essayAttestations(database, identifier), you: person.identifier, canWriteOrEdit: atLeast(level, 'contribute') },
		{ headers: { 'Cache-Control': 'private, no-store' } }
	);
};

export const POST: RequestHandler = async (event) => {
	const { identifier, database, person, level } = await essayAccess(event, 'comment', { forData: true });
	const body = (await event.request.json().catch(() => null)) as Record<string, unknown> | null;
	if (!body) error(400, 'Send the section and the role.');
	const { role, slug, title, level: sectionLevel, text, note } = body;
	if (!isAttestationRole(role)) error(400, 'Say whether you wrote, edited or reviewed the section.');
	if (role !== 'reviewed' && !atLeast(level, 'contribute')) error(403, 'Only people who can edit this essay can attest that they wrote or edited a section.');
	if (typeof slug !== 'string' || !slugPattern.test(slug) || slug.length > 90) error(400, 'Name the section by its heading.');
	if (typeof title !== 'string' || !title.trim() || title.length > 300) error(400, 'Send the section heading.');
	if (sectionLevel !== 2 && sectionLevel !== 3) error(400, 'Only sections and subsections can be attested to.');
	if (typeof text !== 'string') error(400, 'Send the section text.');
	try {
		const saved = await attest(database, {
			essay: identifier,
			personIdentifier: person.identifier,
			role,
			sectionSlug: slug,
			sectionTitle: title.trim(),
			sectionLevel,
			sectionText: text,
			note: typeof note === 'string' && note.trim() ? note.trim().slice(0, 500) : null
		});
		return json({ ...saved, attestations: await essayAttestations(database, identifier) });
	} catch (problem) {
		if (problem instanceof Error && /empty|too long/.test(problem.message)) error(400, problem.message);
		throw problem;
	}
};

export const DELETE: RequestHandler = async (event) => {
	const { identifier, database, person, level } = await essayAccess(event, 'comment', { forData: true });
	const attestation = event.url.searchParams.get('attestation') ?? '';
	const withdrawn = await withdrawAttestation(database, {
		essay: identifier,
		identifier: attestation,
		personIdentifier: person.identifier,
		anyone: atLeast(level, 'full')
	});
	if (!withdrawn) error(404, 'There is no attestation of yours with this id to withdraw.');
	return json({ attestations: await essayAttestations(database, identifier) });
};
