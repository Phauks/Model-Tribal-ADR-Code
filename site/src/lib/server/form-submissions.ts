/**
 * Forms sent from the Forms pages (src/routes/forms/[form]): a form filled in
 * and signed online, or a photo or scan of a signed paper copy. Each opens a
 * request (src/lib/server/request-store.ts) with a row in form_submissions
 * (migrations/0007_form_submissions.sql), and an editor gives it a filing
 * number in the workspace (docs/contributions.md).
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import {
	filledMarkdown,
	readAnswers,
	requestKindOfForm,
	type FormAnswers,
	type FormTemplate
} from '#lib/forms.ts';
import { activityStatement } from './activity-log.ts';
import type { SignedInPerson } from './people.ts';
import { maximumFiles, readFile, type NewRequest, type UploadedFile } from './request-form.ts';
import type { NewFormSubmission } from './request-store.ts';

const shortText = 300;
const longText = 4000;

function text(form: FormData, name: string): string {
	const value = form.get(name);
	return typeof value === 'string' ? value.normalize('NFC').trim() : '';
}

export type SentForm =
	| { ok: true; request: NewRequest; submission: NewFormSubmission; answers: FormAnswers }
	| { ok: false; errors: Record<string, string>; values: Record<string, string>; spam?: boolean };

function newRequest(template: FormTemplate, sender: { name: string; contact: string; note: string }): NewRequest {
	const kind = requestKindOfForm(template);
	return {
		kind,
		material: `${template.title} form, version ${template.version}`,
		nationIdentifier: null,
		requesterName: sender.name || null,
		requesterNation: null,
		requesterRole: null,
		writingForGovernment: false,
		contact: sender.contact,
		sharedWithTeam: false,
		details: sender.note || null,
		creditPreference: null,
		publicationPermission: null,
		missingNationOfficialName: null,
		missingNationOwnName: null,
		missingNationStates: null,
		authorityStatement: null,
		earlierReference: null,
		sources: []
	};
}

/** Who is sending the form and how to reach them, asked below every form. */
function readSender(form: FormData, errors: Record<string, string>) {
	const name = text(form, 'senderName');
	const contact = text(form, 'contact');
	const note = text(form, 'note');
	if (name === '') errors.senderName = 'Give your name.';
	if (name.length > shortText) errors.senderName = `Please keep this under ${shortText} characters.`;
	if (contact === '') errors.contact = 'Give an email address or phone number so we can reply.';
	if (contact.length > shortText) errors.contact = `Please keep this under ${shortText} characters.`;
	if (note.length > longText) errors.note = `Please keep this under ${longText.toLocaleString('en-US')} characters.`;
	return { name, contact, note };
}

function valuesOf(form: FormData): Record<string, string> {
	const values: Record<string, string> = {};
	for (const [name, value] of form.entries()) {
		if (typeof value === 'string') values[name] = value;
	}
	return values;
}

/** A form filled in and signed online. */
export function readOnlineForm(template: FormTemplate, form: FormData): SentForm {
	const values = valuesOf(form);
	if (text(form, 'website') !== '') return { ok: false, errors: {}, values, spam: true };
	const errors: Record<string, string> = {};
	const read = readAnswers(template, form);
	if (!read.ok) Object.assign(errors, read.errors);
	const sender = readSender(form, errors);
	if (text(form, 'electronicSignature') !== 'on') {
		errors.electronicSignature = 'Confirm that the name you typed is your signature.';
	}
	if (!read.ok || Object.keys(errors).length > 0) return { ok: false, errors, values };

	const signedAt = new Date().toISOString();
	const copy = [
		filledMarkdown(template, read.answers),
		'',
		'---',
		'',
		`Sent through the website on ${signedAt} by ${sender.name}, who agreed that the name typed in the signature line is their signature. Form file ${template.file}, SHA-256 ${template.checksum}.`,
		''
	].join('\n');
	return {
		ok: true,
		answers: read.answers,
		request: newRequest(template, sender),
		submission: {
			form: template.slug,
			title: template.title,
			identifiers: template.identifiers,
			version: template.version,
			checksum: template.checksum,
			method: 'online',
			signedName: read.signature || sender.name,
			answers: read.answers,
			filledCopy: copy
		}
	};
}

/** A photo or scan of a signed paper copy. */
export async function readUploadedForm(template: FormTemplate, form: FormData): Promise<SentForm> {
	const values = valuesOf(form);
	if (text(form, 'website') !== '') return { ok: false, errors: {}, values, spam: true };
	const errors: Record<string, string> = {};
	const sender = readSender(form, errors);
	const files: UploadedFile[] = [];
	for (let slot = 1; slot <= maximumFiles; slot += 1) {
		const file = await readFile(form, `scan${slot}`, errors);
		if (file) files.push(file);
	}
	if (files.length === 0 && !errors.scan1) errors.scan1 = 'Choose a photo or scan of the signed form.';
	if (Object.keys(errors).length > 0) return { ok: false, errors, values };

	const request = newRequest(template, sender);
	request.sources = files.map((file) => ({
		sourceKind: null,
		title: null,
		citation: null,
		sourceDate: null,
		locationInSource: null,
		file
	}));
	return {
		ok: true,
		answers: {},
		request,
		submission: {
			form: template.slug,
			title: template.title,
			identifiers: template.identifiers,
			version: template.version,
			checksum: template.checksum,
			method: 'paper-upload',
			signedName: null,
			answers: null,
			filledCopy: null
		}
	};
}

export interface FormSubmission {
	identifier: string;
	form: string;
	formIdentifiers: string;
	formVersion: string;
	formChecksum: string;
	method: 'online' | 'paper-upload';
	signedName: string | null;
	signedAt: string | null;
	answers: string | null;
	filledCopyKey: string | null;
	filingIdentifier: string | null;
	receivedAt: string;
}

const submissionColumns = `identifier, form, form_identifiers AS formIdentifiers, form_version AS formVersion,
	form_checksum AS formChecksum, method, signed_name AS signedName, signed_at AS signedAt, answers,
	filled_copy_key AS filledCopyKey, filing_identifier AS filingIdentifier, received_at AS receivedAt`;

export async function formSubmissionsFor(database: D1Database, requestIdentifier: string): Promise<FormSubmission[]> {
	const result = await database
		.prepare(`SELECT ${submissionColumns} FROM form_submissions WHERE request_identifier = ? ORDER BY received_at`)
		.bind(requestIdentifier)
		.all<FormSubmission>();
	return result.results;
}

export async function formSubmission(
	database: D1Database,
	requestIdentifier: string,
	identifier: string
): Promise<FormSubmission | undefined> {
	const row = await database
		.prepare(`SELECT ${submissionColumns} FROM form_submissions WHERE request_identifier = ? AND identifier = ?`)
		.bind(requestIdentifier, identifier)
		.first<FormSubmission>();
	return row ?? undefined;
}

export function isFilingIdentifier(text: string): boolean {
	return /^filing-\d{4}-\d{4}$/.test(text);
}

/** The next unused filing number of the year, such as filing-2026-0003. */
export async function nextFilingIdentifier(database: D1Database, now: Date = new Date()): Promise<string> {
	const year = now.getUTCFullYear();
	const row = await database
		.prepare(`SELECT MAX(filing_identifier) AS last FROM form_submissions WHERE filing_identifier LIKE ?`)
		.bind(`filing-${year}-%`)
		.first<{ last: string | null }>();
	const last = row?.last ? Number(row.last.slice(-4)) : 0;
	return `filing-${year}-${String(last + 1).padStart(4, '0')}`;
}

/**
 * Files every form sent with a request under one filing number, new or
 * existing, so all the forms for one contribution sit together.
 */
export async function setFilingIdentifier(
	database: D1Database,
	request: { identifier: string },
	filing: string,
	person: SignedInPerson
): Promise<void> {
	await database.batch([
		database
			.prepare(`UPDATE form_submissions SET filing_identifier = ? WHERE request_identifier = ?`)
			.bind(filing, request.identifier),
		activityStatement(database, {
			personIdentifier: person.identifier,
			action: `Forms filed under ${filing}`,
			targetKind: 'request',
			targetIdentifier: request.identifier
		})
	]);
}
