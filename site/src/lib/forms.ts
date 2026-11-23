/**
 * The forms on the website (/forms): the contributor forms in
 * docs/contributor-forms/ and the model forms in content/forms/. Each form is
 * one Markdown file. At build time (src/lib/server/form-catalog.ts) every
 * "☐", every blank "______", every empty table cell and every placeholder
 * such as {{interview.purpose}} becomes a numbered field, so the same file is
 * the printed form, the form filled in online and the copy kept with a
 * filing. This module turns that template into HTML and reads the answers;
 * it runs in the Worker and in the browser, so it has no Node imports.
 */
import type { RequestKind } from './requests.ts';

export type FormGroup = 'contributor' | 'model';

export const formGroups: {
	group: FormGroup;
	title: string;
	description: string;
	/** True when a filled-in form is sent to the project; model forms are only printed. */
	sendable: boolean;
}[] = [
	{
		group: 'contributor',
		title: 'Forms for sharing material',
		description:
			'For a story, an interview or a document you give the project. Fill one in here and sign by typing your name, or print it, sign it and send us a photo or scan.',
		sendable: true
	},
	{
		group: 'model',
		title: 'Model forms',
		description:
			'Forms from the model code, for nations to adapt and use. Fill one in and print it. Nothing you type is sent to us.',
		sendable: false
	}
];

export type FormFieldKind = 'check' | 'text' | 'long' | 'date' | 'signature';

export interface FormField {
	/** The field's name in the submitted form, such as "f12". */
	name: string;
	kind: FormFieldKind;
	/** The question or choice the field answers, read out by screen readers. */
	label: string;
	/** Filled in by the project, such as the filing number or "Project use" lines; never asked online. */
	projectOnly: boolean;
}

export interface FormTemplate {
	/** The form's address under /forms/, from its file name, such as "contributor-statement". */
	slug: string;
	group: FormGroup;
	title: string;
	/** When to use the form, shown in the list of forms. */
	summary: string;
	version: string;
	/** The form ids written at the top of the form, such as ["interview-consent", "interview-release"]. */
	identifiers: string[];
	/** The file in the repository, such as docs/contributor-forms/contributor-statement.md. */
	file: string;
	/** SHA-256 of the file as the site was built from it, so a filing can show the exact words signed. */
	checksum: string;
	/** The form as HTML without its title, with a %%F<n>%% token where each field goes. */
	html: string;
	/** The form's Markdown with the same tokens, for the copy kept with a filing. */
	markdown: string;
	fields: FormField[];
	/** Word and PDF copies of a model form, with their SHA-256 hashes (scripts/forms/build_forms.py). */
	downloads?: FormDownload[];
}

export interface FormDownload {
	kind: 'Word' | 'PDF';
	/** Where the site serves the file, such as /help/forms/proof-of-service.pdf. */
	href: string;
	sha256: string;
	bytes: number;
}

/** Where each field's token sits in the template's HTML and Markdown. */
export const fieldToken = /%%F(\d+)%%/g;

export function tokenFor(index: number): string {
	return `%%F${index}%%`;
}

/** Answers as the browser sends them: text, or "on" for a ticked box. */
export type FormAnswers = Record<string, string>;

export const maximumAnswerLength: Record<FormFieldKind, number> = {
	check: 2,
	text: 1000,
	long: 8000,
	date: 40,
	signature: 300
};

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * The form as HTML:
 *   - online: fields to fill in, with any answers given back after a problem;
 *   - blank: boxes and lines to fill in by hand, for printing;
 *   - filled: the answers as text, for the signer's copy and the workspace.
 * Lines the project fills in are shown blank and never asked online.
 */
export function formHtml(
	template: Pick<FormTemplate, 'html' | 'fields'>,
	mode: 'online' | 'blank' | 'filled',
	answers: FormAnswers = {}
): string {
	return template.html.replace(fieldToken, (_token, index: string) => {
		const field = template.fields[Number(index)];
		if (!field) return '';
		const value = answers[field.name] ?? '';
		if (field.kind === 'check') {
			if (mode === 'online' && !field.projectOnly) {
				return `<input type="checkbox" class="form-check" id="form-${field.name}" name="${field.name}" aria-label="${escapeHtml(field.label)}"${value === 'on' ? ' checked' : ''} />`;
			}
			return mode === 'filled' && value === 'on'
				? '<span class="form-mark" role="img" aria-label="Ticked">☒</span>'
				: '<span class="form-mark" role="img" aria-label="Not ticked">☐</span>';
		}
		if (field.projectOnly) {
			return `<span class="form-line form-project-line" title="Filled in by the project"><span class="visually-hidden">Filled in by the project</span></span>`;
		}
		if (mode === 'online') {
			const common = `id="form-${field.name}" name="${field.name}" aria-label="${escapeHtml(field.label)}" maxlength="${maximumAnswerLength[field.kind]}"`;
			if (field.kind === 'long') {
				return `<textarea class="form-area" rows="4" ${common}>${escapeHtml(value)}</textarea>`;
			}
			const type = field.kind === 'date' ? 'date' : 'text';
			const extra = field.kind === 'signature' ? ' autocomplete="off" spellcheck="false"' : '';
			const kindClass = field.kind === 'signature' ? ' form-signature' : field.kind === 'date' ? ' form-date' : '';
			return `<input type="${type}" class="form-blank${kindClass}" ${common} value="${escapeHtml(value)}"${extra} />`;
		}
		if (mode === 'filled' && value !== '') {
			const kindClass = field.kind === 'long' ? ' form-answer-long' : field.kind === 'signature' ? ' form-signature' : '';
			return `<span class="form-answer${kindClass}">${escapeHtml(value)}</span>`;
		}
		return field.kind === 'long'
			? '<span class="form-area-line"></span>'
			: `<span class="form-line"><span class="visually-hidden">${escapeHtml(field.label)}: blank</span></span>`;
	});
}

export type ReadAnswers =
	| { ok: true; answers: FormAnswers; signature: string }
	| { ok: false; errors: Record<string, string> };

/**
 * Reads a form filled in online. Only fields the reader can see are read,
 * each kept to a sensible length. A form is signed by typing a name in one
 * of its signature lines.
 */
export function readAnswers(template: Pick<FormTemplate, 'fields'>, form: FormData): ReadAnswers {
	const answers: FormAnswers = {};
	const errors: Record<string, string> = {};
	let signature = '';
	for (const field of template.fields) {
		if (field.projectOnly) continue;
		const raw = form.get(field.name);
		if (typeof raw !== 'string') continue;
		const value = raw.normalize('NFC').trim();
		if (value === '') continue;
		if (field.kind === 'check') {
			if (value === 'on') answers[field.name] = 'on';
			continue;
		}
		if (value.length > maximumAnswerLength[field.kind]) {
			errors[field.name] = `“${field.label}” is too long. Please keep it under ${maximumAnswerLength[field.kind].toLocaleString('en-US')} characters.`;
			continue;
		}
		answers[field.name] = value;
		if (field.kind === 'signature' && !signature) signature = value;
	}
	if (!template.fields.some((field) => field.kind === 'signature' && !field.projectOnly)) {
		// A form with no signature line is signed by the sender's agreement below it.
		signature = 'none';
	}
	if (!signature) errors.signature = 'Type your name in a signature line of the form.';
	if (Object.keys(errors).length > 0) return { ok: false, errors };
	return { ok: true, answers, signature: signature === 'none' ? '' : signature };
}

/** Keeps an answer from breaking the Markdown around it, such as a table cell or a bold run. */
function markdownText(value: string, inTable: boolean): string {
	const escaped = value.replace(/([\\`*_[\]<>|#])/g, '\\$1');
	return inTable ? escaped.replace(/\r?\n/g, ' ') : escaped.replace(/\r?\n/g, '  \n');
}

/**
 * The form's Markdown with the answers written in: "☒" for a ticked box and
 * the answer in place of each blank. This copy, stored with the filing, shows
 * exactly what was signed even after the form changes.
 */
export function filledMarkdown(template: Pick<FormTemplate, 'markdown' | 'fields'>, answers: FormAnswers): string {
	const lines = template.markdown.split('\n');
	return lines
		.map((line) => {
			const inTable = line.trimStart().startsWith('|');
			return line.replace(fieldToken, (_token, index: string) => {
				const field = template.fields[Number(index)];
				if (!field) return '';
				const value = answers[field.name] ?? '';
				if (field.kind === 'check') return value === 'on' ? '☒' : '☐';
				if (field.projectOnly || value === '') return '______';
				return markdownText(value, inTable);
			});
		})
		.join('\n');
}

/**
 * The kind of request a sent form opens in the workspace (docs/requests.md):
 * a change or withdrawal is handled like a request to restrict material, so
 * the material is hidden first; every other form comes with a contribution.
 */
export function requestKindOfForm(template: Pick<FormTemplate, 'identifiers'>): RequestKind {
	return template.identifiers.includes('change-or-withdrawal-request') ? 'restrict' : 'contribute';
}

export function isSendable(template: Pick<FormTemplate, 'group'>): boolean {
	return formGroups.find((entry) => entry.group === template.group)?.sendable ?? false;
}
