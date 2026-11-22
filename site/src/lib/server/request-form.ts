/**
 * Reads and checks the request form (docs/requests.md, "The form, step by
 * step" and "Adding a nation that is missing"). Kept free of database code
 * so it can be tested on its own.
 */
import {
	authorityStatements,
	isRequestKind,
	sourceKinds,
	type AuthorityStatement,
	type RequestKind,
	type SourceKind
} from '#lib/requests.ts';

export const maximumFileBytes = 10 * 1024 * 1024;
export const maximumFiles = 3;
export const sourceSlots = 3;

const shortText = 300;
const longText = 8000;

/** File types accepted, checked by their first bytes, not only by their name. */
const acceptedFiles: { type: string; extension: string; matches: (bytes: Uint8Array) => boolean }[] = [
	{
		type: 'application/pdf',
		extension: 'pdf',
		matches: (bytes) => startsWith(bytes, [0x25, 0x50, 0x44, 0x46])
	},
	{
		type: 'image/png',
		extension: 'png',
		matches: (bytes) => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
	},
	{ type: 'image/jpeg', extension: 'jpg', matches: (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]) },
	{
		type: 'image/webp',
		extension: 'webp',
		matches: (bytes) =>
			startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
			startsWith(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])
	}
];

export const acceptedFileTypes = acceptedFiles.map((file) => file.type).join(',');

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
	return prefix.every((value, index) => bytes[index] === value);
}

export interface UploadedFile {
	name: string;
	type: string;
	bytes: Uint8Array;
}

export interface SourceInput {
	sourceKind: SourceKind | null;
	title: string | null;
	citation: string | null;
	sourceDate: string | null;
	locationInSource: string | null;
	file: UploadedFile | null;
}

export interface NewRequest {
	kind: RequestKind;
	material: string | null;
	nationIdentifier: string | null;
	requesterName: string | null;
	requesterNation: string | null;
	requesterRole: string | null;
	writingForGovernment: boolean;
	contact: string;
	details: string | null;
	creditPreference: string | null;
	publicationPermission: 'publish' | 'review-only' | null;
	missingNationOfficialName: string | null;
	missingNationOwnName: string | null;
	missingNationStates: string | null;
	authorityStatement: AuthorityStatement | null;
	earlierReference: string | null;
	sources: SourceInput[];
}

/** The text a person typed, given back to the form when something needs fixing. */
export type FormValues = Record<string, string>;

export type FormResult =
	| { ok: true; request: NewRequest }
	| { ok: false; errors: Record<string, string>; values: FormValues; spam?: boolean };

function text(form: FormData, name: string): string {
	const value = form.get(name);
	return typeof value === 'string' ? value.normalize('NFC').trim() : '';
}

function optional(value: string): string | null {
	return value === '' ? null : value;
}

async function readFile(
	form: FormData,
	name: string,
	errors: Record<string, string>
): Promise<UploadedFile | null> {
	const value = form.get(name);
	if (!(value instanceof File) || value.size === 0) return null;
	if (value.size > maximumFileBytes) {
		errors[name] = 'The file is larger than 10 MB. Please send a smaller copy or a link instead.';
		return null;
	}
	const bytes = new Uint8Array(await value.arrayBuffer());
	const accepted = acceptedFiles.find((file) => file.matches(bytes));
	if (!accepted) {
		errors[name] = 'Only PDF, PNG, JPEG and WebP files can be sent.';
		return null;
	}
	const safeName =
		value.name
			.normalize('NFC')
			.replace(/[^\p{L}\p{N}._ -]+/gu, '-')
			.slice(0, 120) || `upload.${accepted.extension}`;
	return { name: safeName, type: accepted.type, bytes };
}

/**
 * Checks a submitted request. Only a way to reply is always required
 * (docs/requests.md, step 3); each kind adds what it needs.
 */
export async function readRequestForm(form: FormData): Promise<FormResult> {
	const errors: Record<string, string> = {};
	const values: FormValues = {};
	for (const [name, value] of form.entries()) {
		if (typeof value === 'string') values[name] = value;
	}

	// A field people cannot see. Bots that fill in every field are turned away.
	if (text(form, 'website') !== '') {
		return { ok: false, errors: {}, values, spam: true };
	}

	const kind = text(form, 'kind');
	if (!isRequestKind(kind)) {
		return { ok: false, errors: { kind: 'Choose what you would like to do.' }, values };
	}

	const limit = (name: string, maximum: number, value: string) => {
		if (value.length > maximum) errors[name] = `Please keep this under ${maximum.toLocaleString('en-US')} characters.`;
		return value;
	};

	const contact = limit('contact', shortText, text(form, 'contact'));
	if (contact === '') errors.contact = 'Give an email address or phone number so we can reply.';

	const details = limit('details', longText, text(form, 'details'));
	if (details === '' && kind !== 'add-nation') {
		errors.details =
			kind === 'restrict' || kind === 'remove'
				? 'Say where the material is and what should happen. Please do not repeat sensitive material.'
				: 'Tell us what you would like.';
	}

	const material = limit('material', longText, text(form, 'material'));
	if ((kind === 'correct' || kind === 'restrict' || kind === 'remove') && material === '') {
		errors.material = 'Say which page, record or passage this is about.';
	}

	const writingFor = text(form, 'writingForGovernment');
	const request: NewRequest = {
		kind,
		material: optional(material),
		nationIdentifier: optional(limit('nationIdentifier', shortText, text(form, 'nationIdentifier'))),
		requesterName: optional(limit('requesterName', shortText, text(form, 'requesterName'))),
		requesterNation: optional(limit('requesterNation', shortText, text(form, 'requesterNation'))),
		requesterRole: optional(limit('requesterRole', shortText, text(form, 'requesterRole'))),
		writingForGovernment: writingFor === 'yes',
		contact,
		details: optional(details),
		creditPreference: null,
		publicationPermission: null,
		missingNationOfficialName: null,
		missingNationOwnName: null,
		missingNationStates: null,
		authorityStatement: null,
		earlierReference: null,
		sources: []
	};

	if (kind === 'contribute') {
		request.creditPreference = optional(limit('creditPreference', shortText, text(form, 'creditPreference')));
		const permission = text(form, 'publicationPermission');
		if (permission === 'publish' || permission === 'review-only') {
			request.publicationPermission = permission;
		} else {
			errors.publicationPermission =
				'Say whether we may publish what you send, or use it for review only.';
		}
	}

	if (kind === 'add-nation') {
		request.missingNationOfficialName = optional(
			limit('missingNationOfficialName', shortText, text(form, 'missingNationOfficialName'))
		);
		if (!request.missingNationOfficialName) {
			errors.missingNationOfficialName = 'Give the nation’s name as the government source writes it.';
		}
		request.missingNationOwnName = optional(
			limit('missingNationOwnName', shortText, text(form, 'missingNationOwnName'))
		);
		request.missingNationStates = optional(
			limit('missingNationStates', shortText, text(form, 'missingNationStates'))
		);
		if (!request.missingNationStates) errors.missingNationStates = 'Name the states where the nation is located.';

		const statement = text(form, 'authorityStatement');
		if ((authorityStatements as readonly string[]).includes(statement)) {
			request.authorityStatement = statement as AuthorityStatement;
		} else {
			errors.authorityStatement =
				'Confirm that you are authorized by the nation’s government, or say that you are not writing for it.';
		}

		const earlier = limit('earlierReference', shortText, text(form, 'earlierReference'));
		request.earlierReference = optional(earlier.toLocaleUpperCase('en-US'));

		for (let slot = 1; slot <= sourceSlots; slot += 1) {
			const prefix = `source${slot}`;
			const sourceKind = text(form, `${prefix}Kind`);
			const source: SourceInput = {
				sourceKind: (sourceKinds as readonly string[]).includes(sourceKind)
					? (sourceKind as SourceKind)
					: null,
				title: optional(limit(`${prefix}Title`, shortText, text(form, `${prefix}Title`))),
				citation: optional(limit(`${prefix}Citation`, longText, text(form, `${prefix}Citation`))),
				sourceDate: optional(limit(`${prefix}Date`, shortText, text(form, `${prefix}Date`))),
				locationInSource: optional(
					limit(`${prefix}Location`, shortText, text(form, `${prefix}Location`))
				),
				file: await readFile(form, `${prefix}File`, errors)
			};
			const used =
				source.title || source.citation || source.sourceDate || source.locationInSource || source.file;
			if (!used) continue;
			if (!source.citation && !source.file) {
				errors[`${prefix}Citation`] = 'Give a citation or web address, upload a copy, or both.';
			}
			if (!source.sourceKind) errors[`${prefix}Kind`] = 'Choose what kind of source this is.';
			request.sources.push(source);
		}
		if (request.sources.length === 0 && !errors.source1Citation) {
			errors.source1Citation =
				'Give at least one government source that names the nation: a citation, an upload, or both.';
		}
	} else {
		for (let slot = 1; slot <= maximumFiles; slot += 1) {
			const file = await readFile(form, `file${slot}`, errors);
			if (file) {
				request.sources.push({
					sourceKind: null,
					title: null,
					citation: null,
					sourceDate: null,
					locationInSource: null,
					file
				});
			}
		}
	}

	if (Object.keys(errors).length > 0) return { ok: false, errors, values };
	return { ok: true, request };
}
