import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { emptyAnswers, pageNameOf, slugOf, type ProfileAnswers } from '#lib/contributors.ts';
import { contributorPage, contributorPictureKey, peopleDirectory } from '#lib/server/contributor-pages.ts';
import {
	confirmProfile,
	confirmedCredits,
	deleteProfile,
	profileBySubject,
	saveAnswers,
	setBoardMembership,
	type SignedInAccount
} from '#lib/server/contributor-profiles.ts';
import { readProfileForm } from '#lib/server/contributor-form.ts';
import { fileScan } from '#lib/server/file-scans.ts';
import { cleanJpeg, removePicture, savePicture } from '#lib/server/profile-pictures.ts';
import { matchSignIn, type SignedInPerson } from '#lib/server/people.ts';
import { testDatabase } from './database.ts';

let database: D1Database;
let lead: SignedInPerson;
const account: SignedInAccount = { subject: 'account-helper', email: 'helper@example.org', name: 'Helper' };
const adult: ProfileAnswers = {
	...emptyAnswers,
	givenName: 'Ada',
	familyName: 'Lovelace',
	ageGroup: '18-or-older',
	interests: ['write'],
	creditForm: 'name-and-nation',
	nationAnswer: 'listed',
	nations: [
		{ nationIdentifier: 'sample-nation', nationName: 'Sample Nation', connection: 'citizen', showInCredit: true },
		{ nationIdentifier: null, nationName: 'Private Nation', connection: null, showInCredit: false }
	],
	phone: '+1 702 555 0123',
	background: 'Private background.',
	biography: 'Writes about mediation.',
	biographyInCredits: true
};

function memoryBucket(): R2Bucket & { files: Map<string, Uint8Array> } {
	const files = new Map<string, Uint8Array>();
	return {
		files,
		async put(key: string, value: Uint8Array) {
			files.set(key, value);
			return { key };
		},
		async get(key: string) {
			return files.has(key) ? { body: files.get(key) } : null;
		},
		async delete(keys: string | string[]) {
			for (const key of Array.isArray(keys) ? keys : [keys]) files.delete(key);
		}
	} as unknown as R2Bucket & { files: Map<string, Uint8Array> };
}

/** A tiny JPEG: SOI, an APP0, an Exif APP1 with a location, a comment, a frame of the given size, a scan and EOI. */
function jpeg(width: number, height: number): Uint8Array {
	const segment = (marker: number, payload: number[]) => [0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload];
	const text = (value: string) => Array.from(new TextEncoder().encode(value));
	return Uint8Array.from([
		0xff, 0xd8,
		...segment(0xe0, text('JFIF\0')),
		...segment(0xe1, text('Exif\0\0GPS 36.17N 115.14W')),
		...segment(0xfe, text('taken at home')),
		...segment(0xc0, [8, height >> 8, height & 0xff, width >> 8, width & 0xff, 1, 1, 0x11, 0]),
		...segment(0xda, [1, 1, 0, 0, 63, 0]),
		0x12, 0x34,
		0xff, 0xd9
	]);
}

beforeEach(async () => {
	database = testDatabase();
	const result = await matchSignIn(
		database,
		{ subject: 'account-lead', email: 'lead@example.org', emailVerified: true, name: 'Lead Author' },
		'lead@example.org'
	);
	if (result.outcome !== 'signed-in') throw new Error(result.outcome);
	lead = result.person;
});

async function confirmed(answers: ProfileAnswers) {
	await saveAnswers(database, account, answers);
	await confirmProfile(database, (await profileBySubject(database, account.subject))!);
	return (await profileBySubject(database, account.subject))!;
}

describe('page addresses', () => {
	it('makes an address from a name, without accents', () => {
		expect(slugOf('Ada Lovelace')).toBe('ada-lovelace');
		expect(slugOf('  José   Núñez-García ')).toBe('jose-nunez-garcia');
		expect(slugOf('ᏣᎳᎩ')).toBe('');
	});

	it('gives a page only for a credit on the website by name or chosen name', () => {
		expect(pageNameOf(adult)).toBe('Ada Lovelace');
		expect(pageNameOf({ ...adult, creditForm: 'pseudonym', creditPseudonym: 'River Voice' })).toBe('River Voice');
		expect(pageNameOf({ ...adult, creditForm: 'role', creditRole: 'A tribal court clerk' })).toBeNull();
		expect(pageNameOf({ ...adult, creditForm: 'none' })).toBeNull();
		expect(pageNameOf({ ...adult, creditOnWebsite: false })).toBeNull();
	});
});

describe('contributor pages', () => {
	it('shows only what the confirmed credit allows', async () => {
		const profile = await confirmed(adult);
		expect(profile.publicSlug).toBe('ada-lovelace');
		const page = await contributorPage(database, 'ada-lovelace');
		expect(page).toMatchObject({
			name: 'Ada Lovelace',
			section: 'contributors',
			nations: [{ name: 'Sample Nation', identifier: 'sample-nation' }],
			biography: 'Writes about mediation.',
			pictureVersion: null,
			essays: [],
			reviewed: []
		});
		expect(JSON.stringify(page)).not.toMatch(/helper@example|555|Private/);
		const [credit] = await confirmedCredits(database);
		expect(credit.slug).toBe('ada-lovelace');
	});

	it('has no page for a description, no credit, or an unconfirmed change', async () => {
		await confirmed({ ...adult, creditForm: 'role', creditRole: 'A tribal court clerk' });
		expect(await contributorPage(database, 'ada-lovelace')).toBeUndefined();
		const [credit] = await confirmedCredits(database);
		expect(credit.slug).toBeNull();
	});

	it('gives a second person with the same name their own address', async () => {
		await confirmed(adult);
		const other: SignedInAccount = { subject: 'account-other', email: 'other@example.org', name: 'Other' };
		await saveAnswers(database, other, adult);
		await confirmProfile(database, (await profileBySubject(database, other.subject))!);
		expect((await profileBySubject(database, other.subject))!.publicSlug).toBe('ada-lovelace-2');
	});

	it('gives a name with no Latin letters a neutral address', async () => {
		const profile = await confirmed({ ...adult, creditForm: 'pseudonym', creditPseudonym: 'ᏣᎳᎩ' });
		expect(profile.publicSlug).toMatch(/^contributor-[0-9a-f]{8}$/);
		expect((await contributorPage(database, profile.publicSlug!))?.name).toBe('ᏣᎳᎩ');
	});

	it('lists published essays the person saved a version of, and what they reviewed', async () => {
		const profile = await confirmed(adult);
		await database.prepare('UPDATE contributor_profiles SET person_identifier = ? WHERE identifier = ?').bind(lead.identifier, profile.identifier).run();
		const time = new Date().toISOString();
		for (const [identifier, part] of [['timeline', 'foundations'], ['draft-only', 'essays']]) {
			await database.prepare('INSERT INTO essays (identifier, part, created_at) VALUES (?, ?, ?)').bind(identifier, part, time).run();
			await database
				.prepare(
					`INSERT INTO essay_versions (essay_identifier, number, object_key, sha256, bytes, title, origin, person_identifier, created_at)
					 VALUES (?, 1, ?, 'x', 1, ?, 'editor', ?, ?)`
				)
				.bind(identifier, `essays/${identifier}/1.md`, identifier === 'timeline' ? 'Timeline' : 'Draft', lead.identifier, time)
				.run();
		}
		await database
			.prepare(`INSERT INTO essay_publications (essay_identifier, number, version_number, person_identifier, published_at) VALUES ('timeline', 1, 1, ?, ?)`)
			.bind(lead.identifier, time)
			.run();
		await database
			.prepare(
				`INSERT INTO reviews (identifier, subject_kind, subject_identifier, content_version, person_identifier, capacity, decision, created_at)
				 VALUES ('r1', 'nation', 'sample-nation', 'v1', ?, 'contributor', 'approved', ?),
				        ('r2', 'nation', 'sample-nation', 'v2', ?, 'contributor', 'comment', ?)`
			)
			.bind(lead.identifier, time, lead.identifier, time)
			.run();
		const page = await contributorPage(database, 'ada-lovelace');
		expect(page?.essays).toEqual([{ title: 'Timeline', path: '/foundations/timeline' }]);
		expect(page?.reviewed).toEqual([{ kind: 'nation', identifier: 'sample-nation' }]);
	});
});

describe('profile pictures', () => {
	it('keeps the picture and removes camera details, location and comments', () => {
		const cleaned = cleanJpeg(jpeg(400, 400));
		if (!cleaned.ok) throw new Error(cleaned.message);
		expect([cleaned.width, cleaned.height]).toEqual([400, 400]);
		const text = new TextDecoder().decode(cleaned.bytes);
		expect(text).toContain('JFIF');
		expect(text).not.toMatch(/Exif|GPS|taken at home/);
		expect(Array.from(cleaned.bytes.slice(-4))).toEqual([0x12, 0x34, 0xff, 0xd9]);
	});

	it('refuses files that are not a JPEG of a sensible size', () => {
		expect(cleanJpeg(new TextEncoder().encode('<svg></svg>')).ok).toBe(false);
		expect(cleanJpeg(jpeg(4000, 3000)).ok).toBe(false);
		expect(cleanJpeg(jpeg(20, 20)).ok).toBe(false);
		expect(cleanJpeg(jpeg(400, 400).slice(0, 30)).ok).toBe(false);
	});

	it('shows the picture on the page only for someone 18 or older, and deletes it with the profile', async () => {
		const bucket = memoryBucket();
		const profile = await confirmed(adult);
		const cleaned = cleanJpeg(jpeg(400, 400));
		if (!cleaned.ok) throw new Error(cleaned.message);
		await savePicture(database, bucket, profile, cleaned.bytes);
		const withPicture = (await profileBySubject(database, account.subject))!;
		expect(bucket.files.has(withPicture.pictureKey!)).toBe(true);
		expect(await fileScan(database, withPicture.pictureKey!)).toMatchObject({ status: 'waiting', purpose: 'profile-picture' });
		expect(await contributorPictureKey(database, 'ada-lovelace')).toBe(withPicture.pictureKey);
		expect((await contributorPage(database, 'ada-lovelace'))?.pictureVersion).toBe(withPicture.pictureUpdatedAt);

		// A change of answer to under 18 hides it at once, before it is confirmed.
		await saveAnswers(database, account, { ...adult, ageGroup: '13-to-17', creditForm: 'pseudonym', creditPseudonym: 'River Voice' });
		expect(await contributorPictureKey(database, 'ada-lovelace')).toBeUndefined();

		await removePicture(database, bucket, withPicture);
		expect(bucket.files.size).toBe(0);
		expect(await fileScan(database, withPicture.pictureKey!)).toBeNull();
		await savePicture(database, bucket, (await profileBySubject(database, account.subject))!, cleaned.bytes);
		await deleteProfile(database, (await profileBySubject(database, account.subject))!, bucket);
		expect(bucket.files.size).toBe(0);
	});
});

describe('the People page', () => {
	it('lists people with a public page, with the board marked and specialties from the confirmed version', async () => {
		const profile = await confirmed({ ...adult, specialties: ['peacemaking', 'tribal-courts'], specialtyOther: 'Gaming law' });
		const other: SignedInAccount = { subject: 'account-other', email: 'other@example.org', name: 'Other' };
		await saveAnswers(database, other, { ...adult, givenName: 'Grace', familyName: 'Hopper', creditForm: 'role', creditRole: 'A court clerk' });
		await confirmProfile(database, (await profileBySubject(database, other.subject))!);
		await setBoardMembership(database, profile, true, null, lead);

		const [entry, ...rest] = await peopleDirectory(database);
		expect(rest).toEqual([]);
		expect(entry).toMatchObject({
			slug: 'ada-lovelace',
			name: 'Ada Lovelace',
			boardMember: true,
			boardOffice: null,
			specialties: ['peacemaking', 'tribal-courts'],
			specialtyOther: 'Gaming law',
			essayCount: 0
		});

		// An unconfirmed change of specialties does not show until it is confirmed.
		await saveAnswers(database, account, { ...adult, specialties: ['language'] });
		expect((await peopleDirectory(database))[0].specialties).toEqual(['peacemaking', 'tribal-courts']);
		expect((await contributorPage(database, 'ada-lovelace'))?.specialties).toEqual(['Peacemaking', 'Tribal courts', 'Gaming law']);
	});

	it('reads specialties from the form, keeping only the listed ones', () => {
		const form = new FormData();
		form.append('specialties', 'peacemaking');
		form.append('specialties', 'not-a-specialty');
		form.append('specialtyOther', '  Gaming law ');
		const result = readProfileForm(form, []);
		if (!result.ok) throw new Error('The form was refused.');
		expect(result.answers.specialties).toEqual(['peacemaking']);
		expect(result.answers.specialtyOther).toBe('Gaming law');
	});
});
