/**
 * The pictures on the Supreme Court pages (content/supreme-court/pictures.yaml):
 * one for each Justice and appointing President, and one for each Court. Each
 * was checked by hand against the record of the library, archive or museum
 * that holds the original, so the credit line is written from that record and
 * never from a copy's description page.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { repositoryRoot } from './content.ts';
import type { InfoPicture } from '../info-page.ts';

export interface SupremeCourtPicture {
	/** A person's key in people.yaml or a Court's key in courts.yaml. */
	subject: string;
	/** What the picture shows, for the alt text. */
	shows: string;
	creator?: string;
	/** As the source gives it: "1832", "c. 1860–1865". */
	date?: string;
	/** The library, archive or museum that holds the original. */
	source: string;
	/** The source's number for it: "cwpb.05620", "NPG.67.2". */
	source_id?: string;
	/** The source's record of it. */
	source_link: string;
	/** "Public domain", or an open license by its short name: "CC BY 3.0". */
	license: string;
	license_link?: string;
	/** Why it is in the public domain or may be shown. */
	basis: string;
	checked: string;
	/** The file the copy was downloaded from. */
	copy: string;
	media_type: string;
	width: number;
	height: number;
	sha256: string;
	/** The private bucket's copy the site serves. */
	key: string;
}

let picturesCache: Map<string, SupremeCourtPicture> | undefined;

function pictures(): Map<string, SupremeCourtPicture> {
	if (!picturesCache) {
		const file = parse(readFileSync(path.join(repositoryRoot, 'content/supreme-court/pictures.yaml'), 'utf8').normalize('NFC')) as {
			pictures: SupremeCourtPicture[];
		};
		picturesCache = new Map(file.pictures.map((picture) => [picture.subject, picture]));
	}
	return picturesCache;
}

/** The picture of a person or a Court, if one has been checked. */
export function pictureOf(subject: string): SupremeCourtPicture | undefined {
	return pictures().get(subject);
}

/** A picture's credit line: "Mathew Brady, c. 1860–1865. Library of Congress, cwpb.05620. Public domain." */
export function pictureCredit(picture: SupremeCourtPicture): string {
	const maker = [picture.creator, picture.date].filter(Boolean).join(', ');
	const source = [picture.source, picture.source_id].filter(Boolean).join(', ');
	return [maker, source, picture.license].filter(Boolean).join('. ') + '.';
}

/** A person's or a Court's picture as At a glance shows it. */
export function pictureView(subject: string): InfoPicture | undefined {
	const picture = pictureOf(subject);
	if (!picture) return undefined;
	return {
		src: `/supreme-court/portraits/${subject}`,
		alt: picture.shows,
		credit: pictureCredit(picture),
		original: picture.source_link,
		width: picture.width,
		height: picture.height
	};
}

/** The pictures the Worker may serve, for "virtual:portraits". */
export function servablePortraits(): { person: string; key: string; mediaType: string; sha256: string; link: string }[] {
	return [...pictures().values()].map((picture) => ({
		person: picture.subject,
		key: picture.key,
		mediaType: picture.media_type,
		sha256: picture.sha256,
		link: picture.copy
	}));
}
