/**
 * Profile pictures (docs/contributor-profiles.md, "Profile pictures"). The
 * browser crops the picture to a square and makes a 400 by 400 JPEG before
 * sending it (src/lib/square-picture.ts). The server
 * accepts only a small JPEG, removes everything in it but the picture (camera
 * details, location, comments), and keeps it in the private bucket. It is
 * shown only on the person's public page, and never for someone under 18.
 */
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import type { Profile } from './contributor-profiles.ts';
import { eventStatement } from './events.ts';
import { forgetScan, storeSentFile } from './file-scans.ts';
import { newIdentifier, now } from './identifiers.ts';

/** The size the browser makes, in pixels on each side. */
export const pictureSide = 400;

/** The largest file accepted. A 400 pixel JPEG is far smaller. */
export const pictureMaximumBytes = 1_000_000;

/** The largest picture accepted on either side, for a browser that sends the file as it is. */
export const pictureMaximumSide = 1200;

export const pictureMinimumSide = 64;

export type CleanedPicture = { ok: true; bytes: Uint8Array; width: number; height: number } | { ok: false; message: string };

const notAPicture = 'Choose a photo or picture file, such as a JPEG or PNG.';

/**
 * Checks that the bytes are a JPEG of a sensible size and returns a copy with
 * only the segments needed to show it. Removed: APP1 to APP13 and APP15 (Exif
 * with camera details and location, XMP, ICC profiles, Photoshop data) and
 * comments. Kept: APP0 (JFIF), APP14 (Adobe colour data, which holds nothing
 * personal), the tables, the frame and the image data.
 */
export function cleanJpeg(input: Uint8Array): CleanedPicture {
	if (input.length > pictureMaximumBytes) {
		return { ok: false, message: 'This picture is too large. Choose a smaller one.' };
	}
	if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) return { ok: false, message: notAPicture };
	const kept: Uint8Array[] = [input.subarray(0, 2)];
	let position = 2;
	let width = 0;
	let height = 0;
	while (position < input.length) {
		if (input[position] !== 0xff) return { ok: false, message: notAPicture };
		// Any number of 0xFF fill bytes may come before a marker.
		while (input[position] === 0xff) position++;
		const marker = input[position];
		position++;
		if (marker === undefined) return { ok: false, message: notAPicture };
		if (marker === 0xd9) break;
		if (position + 2 > input.length) return { ok: false, message: notAPicture };
		const length = (input[position]! << 8) | input[position + 1]!;
		if (length < 2 || position + length > input.length) return { ok: false, message: notAPicture };
		const segmentEnd = position + length;
		if (isFrameMarker(marker)) {
			if (length < 7) return { ok: false, message: notAPicture };
			height = (input[position + 3]! << 8) | input[position + 4]!;
			width = (input[position + 5]! << 8) | input[position + 6]!;
		}
		if (marker === 0xda) {
			// Start of scan: the image data runs to the end of the file.
			kept.push(Uint8Array.from([0xff, marker]), input.subarray(position));
			position = input.length;
			break;
		}
		const removed = (marker >= 0xe1 && marker <= 0xef && marker !== 0xee) || marker === 0xfe;
		if (!removed) kept.push(Uint8Array.from([0xff, marker]), input.subarray(position, segmentEnd));
		position = segmentEnd;
	}
	if (!width || !height) return { ok: false, message: notAPicture };
	if (width > pictureMaximumSide || height > pictureMaximumSide) {
		return { ok: false, message: 'This picture is too large. Choose a smaller one.' };
	}
	if (width < pictureMinimumSide || height < pictureMinimumSide) {
		return { ok: false, message: 'This picture is too small. Choose a larger one.' };
	}
	const bytes = new Uint8Array(kept.reduce((total, part) => total + part.length, 0));
	let offset = 0;
	for (const part of kept) {
		bytes.set(part, offset);
		offset += part.length;
	}
	return { ok: true, bytes, width, height };
}

/** Start-of-frame markers, which hold the picture's size: C0 to CF except C4 (Huffman tables), C8 and CC. */
function isFrameMarker(marker: number): boolean {
	return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

/** Stores a cleaned picture as the person's picture and removes the one before it. */
export async function savePicture(
	database: D1Database,
	bucket: R2Bucket,
	profile: Pick<Profile, 'identifier' | 'personIdentifier' | 'pictureKey'>,
	bytes: Uint8Array
): Promise<void> {
	const key = `profile-pictures/${profile.identifier}/${newIdentifier()}.jpg`;
	// Held until the virus check passes (site/SCANNING.md): the cleaning above
	// keeps the picture's own data byte for byte.
	await storeSentFile(database, bucket, {
		objectKey: key,
		purpose: 'profile-picture',
		subject: profile.identifier,
		bytes,
		httpMetadata: { contentType: 'image/jpeg' }
	});
	const time = now();
	await database.batch([
		database
			.prepare('UPDATE contributor_profiles SET picture_key = ?, picture_updated_at = ?, updated_at = ? WHERE identifier = ?')
			.bind(key, time, time, profile.identifier),
		eventStatement(database, {
			personIdentifier: profile.personIdentifier,
			action: profile.pictureKey ? 'Changed the profile picture' : 'Added a profile picture',
			targetKind: 'profile',
			targetIdentifier: profile.identifier
		})
	]);
	if (profile.pictureKey) {
		await bucket.delete(profile.pictureKey);
		await forgetScan(database, profile.pictureKey);
	}
}

/** Removes the person's picture from the profile and the bucket. */
export async function removePicture(
	database: D1Database,
	bucket: R2Bucket,
	profile: Pick<Profile, 'identifier' | 'personIdentifier' | 'pictureKey'>
): Promise<void> {
	if (!profile.pictureKey) return;
	const time = now();
	await database.batch([
		database
			.prepare('UPDATE contributor_profiles SET picture_key = NULL, picture_updated_at = NULL, updated_at = ? WHERE identifier = ?')
			.bind(time, profile.identifier),
		eventStatement(database, {
			personIdentifier: profile.personIdentifier,
			action: 'Removed the profile picture',
			targetKind: 'profile',
			targetIdentifier: profile.identifier
		})
	]);
	await bucket.delete(profile.pictureKey);
	await forgetScan(database, profile.pictureKey);
}
