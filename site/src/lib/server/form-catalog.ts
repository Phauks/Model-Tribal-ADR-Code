/**
 * Builds the forms shown at /forms from their Markdown files (src/lib/forms.ts):
 *   - docs/contributor-forms/*.md, in the order of that folder's README;
 *   - content/forms/**\/*.md, the model forms, by title, once there are any.
 * Runs only at build time, in Node, through the "virtual:forms" module in
 * vite.config.ts, because the form pages are answered by the Worker, which
 * cannot read the repository.
 *
 * A form is written as it is printed. Every "☐" becomes a tick box, every
 * run of four or more underscores ("______") a line to write on (a box of
 * its own when it stands alone in a paragraph), every empty table cell a
 * line, and every placeholder such as {{interview.purpose}} a line labeled
 * with its name. A paragraph starting "**Project use.**" and the
 * {{filing.identifier}} placeholder are for the project to fill in. A line
 * whose label names a date asks for a date; one that names a signature is a
 * signature line.
 *
 * A model form may open with YAML front matter (the forms it was based on, a
 * summary); it is left off the page, and its summary, if any, is the one
 * shown in the list of forms. In a model form, a placeholder the court sets
 * when it adopts the form (a fee, a deadline) shows its model text from
 * content/variables/, such as "[number]"; only {{court.name}} and
 * {{nation.name}} stay lines for the person filling it in.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Marked, type Tokens } from 'marked';
import { parse as parseYaml } from 'yaml';
import { gfmHeadingId } from 'marked-gfm-heading-id';
import {
	tokenFor,
	type FormDownload,
	type FormField,
	type FormFieldKind,
	type FormGroup,
	type FormTemplate
} from '#lib/forms.ts';
import { escapeHtml } from '../escape-html.ts';
import { repositoryRoot } from './content.ts';
import { resolveDocumentLink } from './project-documents.ts';

const contributorFolder = 'docs/contributor-forms';
const modelFolder = 'content/forms';

/** Placeholders the website fills in itself. */
const placeholderText: Record<string, string> = {
	'project.lead_author': 'Trevor Goldsmith',
	'project.contact': 'Use Request a Change, the flag at the top of every page of the project’s website.'
};

/** Readable names for the placeholders a form leaves to whoever fills it in. */
const placeholderLabels: Record<string, string> = {
	'interview.purpose': 'Purpose of the interview',
	'interview.length': 'How long the interview takes',
	'interview.place': 'Where the interview takes place',
	'interviewer.name': 'Interviewer’s name',
	'interviewer.role': 'Interviewer’s role',
	'nation.name': 'Nation',
	'nation.designated_office': 'Office the nation names',
	'filing.items_summary': 'What it is',
	'contributor.credit_to_nation': 'From',
	'contributor.credit_to_rights_holder': 'Given to us by',
	'proposed.use': 'How we’d like to use it',
	'item.title': 'What it is',
	'court.name': 'Court'
};

/** Repository files a form may link to that have a page of their own on the site. */
const sitePages: Record<string, string> = {};

/** A label without Markdown: no emphasis, code marks or link targets. */
export function plainText(markdown: string): string {
	return markdown
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/☐|_{4,}|%%F\d+%%/g, '')
		.replace(/[*`]/g, '')
		.replace(/\\(.)/g, '$1')
		.replace(/^\s*(?:[-+]|\d+\.)\s+/, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/** A short label for a choice: its words up to the first full stop or bracket. */
function choiceLabel(text: string): string {
	const plain = plainText(text);
	const cut = plain.search(/\.\s|\.$|\s\(/);
	return (cut === -1 ? plain : plain.slice(0, cut)).replace(/[:,;]$/, '').trim().slice(0, 120);
}

function questionLabel(text: string): string {
	return plainText(text)
		.replace(/[.:,;]$/, '')
		.trim()
		.slice(0, 160);
}

/** The last sentence of a lead-in, which is the question a blank answers. */
function lastSentence(text: string): string {
	const sentences = text.split(/(?<=[.?!])\s+(?=[A-Z])/);
	return sentences[sentences.length - 1] ?? '';
}

function kindOfBlank(label: string): FormFieldKind {
	if (/\bdates?\b/i.test(label) || /\bon$/i.test(label)) return 'date';
	if (/signature|agreed aloud/i.test(label)) return 'signature';
	return 'text';
}

const marker = /☐|_{4,}|\{\{\s*([\w.]+)\s*\}\}/g;

interface Segment {
	text: string;
	/** The question the segment answers, such as a table row's label or the section it sits in. */
	context: string;
	projectOnly: boolean;
}

/**
 * Puts a field token in place of each marker in one line or table cell, and
 * records the field. Returns the segment's new text.
 */
function tokenize(segment: Segment, fields: FormField[], fixed: Record<string, string> = {}): string {
	const { text } = segment;
	const matches = [...text.matchAll(marker)];
	if (matches.length === 0) return text;

	const before = text.slice(0, matches[0].index);
	const question = questionLabel(before) || segment.context;
	let result = '';
	let last = 0;
	for (const [position, match] of matches.entries()) {
		const start = match.index;
		const end = start + match[0].length;
		const next = matches[position + 1]?.index ?? text.length;
		result += text.slice(last, start);
		last = end;

		const placeholder = match[1];
		const fixedText = placeholder ? (fixed[placeholder] ?? placeholderText[placeholder]) : undefined;
		if (fixedText !== undefined) {
			result += fixedText;
			continue;
		}

		let kind: FormFieldKind;
		let label: string;
		let projectOnly = segment.projectOnly;
		if (match[0] === '☐') {
			kind = 'check';
			const choice = choiceLabel(text.slice(end, next));
			label = question && question !== choice ? `${question}: ${choice}` : choice;
		} else if (placeholder) {
			projectOnly = projectOnly || placeholder === 'filing.identifier';
			label =
				placeholder === 'filing.identifier'
					? 'Filing number'
					: (placeholderLabels[placeholder] ??
						placeholder.replace(/[._]+/g, ' ').replace(/^./, (letter) => letter.toUpperCase()));
			kind = 'text';
		} else {
			const previous = position === 0 ? 0 : (matches[position - 1].index ?? 0) + matches[position - 1][0].length;
			const lead = lastSentence(questionLabel(text.slice(previous, start)));
			const afterChoice = position > 0 && matches[position - 1][0] === '☐' && !projectOnly;
			if (afterChoice) {
				label = `${fields[fields.length - 1].label} (write in)`;
			} else if (lead.length >= 12 || (lead && !segment.context)) {
				label = lead;
			} else {
				label = [segment.context, lead].filter(Boolean).join(': ') || 'Answer';
			}
			const alone = plainText(text.replace(match[0], '')) === '';
			kind = alone ? 'long' : kindOfBlank(lead || label);
		}
		fields.push({ name: `f${fields.length}`, kind, label, projectOnly });
		result += tokenFor(fields.length - 1);
	}
	return result + text.slice(last);
}

function splitRow(line: string): string[] {
	const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '');
	return inner.split(/(?<!\\)\|/);
}

function isSeparatorRow(line: string): boolean {
	return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line);
}

/** The form's Markdown with a token for every field, and the fields in order. */
export function templateMarkdown(
	markdown: string,
	fixed: Record<string, string> = {}
): { markdown: string; fields: FormField[] } {
	const fields: FormField[] = [];
	const lines = markdown.split('\n');
	const output: string[] = [];
	let context = '';
	let projectParagraph = false;
	let tableHeader: string[] | undefined;

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		const trimmed = line.trim();

		if (trimmed === '') {
			projectParagraph = false;
			tableHeader = undefined;
			output.push(line);
			continue;
		}

		const heading = /^#{1,6}\s+(.*)$/.exec(trimmed);
		if (heading) {
			context = plainText(heading[1]).replace(/^(?:\d+\.|Part [A-Z]\.)\s*/, '');
			output.push(line);
			continue;
		}

		if (trimmed.startsWith('|')) {
			if (!tableHeader) {
				tableHeader = splitRow(line).map((cell) => plainText(cell));
				output.push(line);
				continue;
			}
			if (isSeparatorRow(line)) {
				output.push(line);
				continue;
			}
			const cells = splitRow(line);
			const rowLabel = plainText(cells[0] ?? '');
			const labelTable = tableHeader.every((cell) => cell === '');
			const rewritten = cells.map((cell, column) => {
				const header = tableHeader?.[column] ?? '';
				let cellContext = labelTable || column === 0 ? rowLabel : header;
				if (!labelTable && column > 0 && rowLabel) {
					cellContext = /^\d+$/.test(rowLabel) ? `${header}, item ${rowLabel}` : `${header}, ${rowLabel}`;
				}
				if (cell.trim() === '' && column > 0) {
					const label = cellContext || context || 'Answer';
					fields.push({ name: `f${fields.length}`, kind: kindOfBlank(label), label, projectOnly: false });
					return ` ${tokenFor(fields.length - 1)} `;
				}
				return tokenize({ text: cell, context: column === 0 ? context : cellContext, projectOnly: false }, fields, fixed);
			});
			output.push(`|${rewritten.join('|')}|`);
			continue;
		}
		tableHeader = undefined;

		if (/^\*\*Project use\.\*\*/.test(trimmed)) projectParagraph = true;
		const lead = /^\*\*([^*]+?)[.:]\*\*/.exec(trimmed);
		if (lead) context = plainText(lead[1]);
		output.push(tokenize({ text: line, context, projectOnly: projectParagraph }, fields, fixed));
	}
	return { markdown: output.join('\n'), fields };
}

function checksumOf(text: string): string {
	return createHash('sha256').update(text, 'utf8').digest('hex');
}

function renderer(from: string, formFiles: Map<string, string>): Marked {
	const marked = new Marked({ gfm: true });
	marked.use(gfmHeadingId());
	marked.use({
		renderer: {
			link(this: { parser: { parseInline(tokens: Tokens.Generic[]): string } }, token: Tokens.Link) {
				const text = this.parser.parseInline(token.tokens);
				const hashAt = token.href.indexOf('#');
				const target = hashAt === -1 ? token.href : token.href.slice(0, hashAt);
				const anchor = hashAt === -1 ? '' : token.href.slice(hashAt);
				if (target && !/^[a-z][a-z0-9+.-]*:|^\//i.test(target)) {
					const file = path.posix.normalize(path.posix.join(path.posix.dirname(from), decodeURI(target)));
					const form = formFiles.get(file);
					if (form) return `<a href="/forms/${form}${escapeHtml(anchor)}">${text}</a>`;
					if (sitePages[file]) return `<a href="${sitePages[file]}${escapeHtml(anchor)}">${text}</a>`;
				}
				const resolved = resolveDocumentLink(token.href, from);
				if (resolved.kind === 'unshown-file') return text;
				const github = resolved.kind === 'web' && resolved.toGithub ? ' <span class="github-note">(GitHub)</span>' : '';
				return `<a href="${escapeHtml(resolved.href)}">${text}${github}</a>`;
			},
			// Forms hold no raw HTML; any written there is shown as text.
			html(token: Tokens.HTML | Tokens.Tag) {
				return escapeHtml(token.text);
			}
		}
	});
	return marked;
}

/** "Use it when" for each contributor form, from the table in the folder's README, in its order. */
function contributorIndex(root: string): { file: string; summary: string }[] {
	const readme = path.join(root, contributorFolder, 'README.md');
	if (!existsSync(readme)) return [];
	const entries: { file: string; summary: string }[] = [];
	for (const line of readFileSync(readme, 'utf8').split('\n')) {
		const row = /^\|\s*\[[^\]]+\]\(([\w-]+\.md)\)\s*\|[^|]*\|\s*(.+?)\s*\|\s*$/.exec(line);
		if (row) entries.push({ file: `${contributorFolder}/${row[1]}`, summary: row[2] });
	}
	return entries;
}

function markdownFiles(root: string, folder: string): string[] {
	const full = path.join(root, folder);
	if (!existsSync(full)) return [];
	return readdirSync(full, { recursive: true, encoding: 'utf8' })
		.filter((name) => name.endsWith('.md') && path.basename(name) !== 'README.md')
		.map((name) => `${folder}/${name.split(path.sep).join('/')}`)
		.sort();
}

/** Placeholders a person filling in a model form still writes in: which court, which nation. */
const filledInByThePerson = new Set(['court.name', 'nation.name']);

/**
 * The text a model form shows for each placeholder the court sets when it
 * adopts the form, such as "[number]" for {{court.answer_days}}, from
 * content/variables/*.yaml. The person filling in the form does not write these.
 */
export function courtSetText(root: string): Record<string, string> {
	const folder = path.join(root, 'content/variables');
	if (!existsSync(folder)) return {};
	const texts: Record<string, string> = {};
	for (const name of readdirSync(folder).filter((file) => file.endsWith('.yaml')).sort()) {
		const record = parseYaml(readFileSync(path.join(folder, name), 'utf8')) as {
			group: string;
			variables?: Record<string, { model: string }>;
		};
		for (const [variable, entry] of Object.entries(record.variables ?? {})) {
			const key = `${record.group}.${variable}`;
			if (!filledInByThePerson.has(key)) texts[key] = entry.model;
		}
	}
	return texts;
}

/** Where scripts/forms/build_forms.py puts the Word and PDF copies of the model forms. */
export const downloadFolder = 'site/static/help/forms';

interface DownloadList {
	files: Record<string, { sha256: string; bytes: number }>;
	/** SHA-256 of each form's Markdown file when its copies were built. */
	sources: Record<string, string>;
	/** SHA-256 of the content/variables/*.yaml files, in name order, when the copies were built. */
	variables: string;
}

/** The list of built copies and their hashes, if the copies have been built. */
export function downloadList(root: string): DownloadList | undefined {
	const file = path.join(root, downloadFolder, 'checksums.json');
	return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as DownloadList) : undefined;
}

function downloadsFor(slug: string, list: DownloadList | undefined): FormDownload[] | undefined {
	if (!list) return undefined;
	const downloads: FormDownload[] = [];
	for (const [kind, extension] of [
		['Word', 'docx'],
		['PDF', 'pdf']
	] as const) {
		const entry = list.files[`${slug}.${extension}`];
		if (entry) downloads.push({ kind, href: `/help/forms/${slug}.${extension}`, sha256: entry.sha256, bytes: entry.bytes });
	}
	return downloads.length ? downloads : undefined;
}

/** One form file as a template. */
export function buildForm(
	root: string,
	file: string,
	group: FormGroup,
	summary: string | undefined,
	formFiles: Map<string, string>,
	fixed: Record<string, string> = {},
	downloads?: DownloadList
): FormTemplate {
	const source = readFileSync(path.join(root, file), 'utf8');
	const frontMatter = /^---\n([\s\S]*?)\n---\n/.exec(source.normalize('NFC'));
	const text = source.normalize('NFC').slice(frontMatter?.[0].length ?? 0);
	const frontSummary = frontMatter
		? /^summary:\s*(.+)$/m
				.exec(frontMatter[1])?.[1]
				.trim()
				.replace(/^(["'])(.*)\1$/, '$2')
		: undefined;
	const title = /^#\s+(.+)$/m.exec(text);
	if (!title) throw new Error(`${file} has no title (a line starting "# ").`);
	const header = /^Forms? `.*$/m.exec(text)?.[0] ?? '';
	const version = /version (\d+\.\d+\.\d+)/.exec(header)?.[1];
	if (!version) throw new Error(`${file} has no line such as "Form \`id\`, version 1.0.0."`);
	const identifiers = [...header.matchAll(/`([a-z0-9-]+)`/g)].map((match) => match[1]);

	const { markdown, fields } = templateMarkdown(text, fixed);
	const body = markdown.replace(/^#\s+.+\n+/m, '');
	let html = renderer(file, formFiles).parse(body, { async: false }) as string;
	// A table too wide for a phone scrolls sideways in a box keyboard users can reach (WCAG 2.1.1).
	html = html.replace(/<table>[\s\S]*?<\/table>/g, (table) =>
		(table.match(/<th[\s>]/g)?.length ?? 0) > 2
			? `<div class="form-wide-table" role="group" aria-label="Table, scrolls sideways" tabindex="0">${table}</div>`
			: table
	);
	// Hidden when the form is filled in online; printed for the project to fill in.
	html = html.replace(/<p><strong>Project use\.<\/strong>/g, '<p class="form-project-use"><strong>Project use.</strong>');
	const firstParagraph = body
		.split(/\n\s*\n/)
		.map((block) => block.trim())
		.find((block) => block && !block.startsWith('Form') && !block.startsWith('#') && !block.startsWith('|'));

	return {
		slug: path.posix.basename(file, '.md'),
		group,
		title: plainText(title[1]),
		summary: summary ?? frontSummary ?? plainText(firstParagraph ?? '').replace(/%%F\d+%%/g, '______'),
		version,
		identifiers,
		file,
		checksum: checksumOf(source),
		html,
		markdown,
		fields,
		...(group === 'model' && downloads ? { downloads: downloadsFor(path.posix.basename(file, '.md'), downloads) } : {})
	};
}

/** Every form on the site, contributor forms first. */
export function buildFormCatalog(root: string = repositoryRoot): FormTemplate[] {
	const index = contributorIndex(root);
	const contributorFiles = markdownFiles(root, contributorFolder).sort((a, b) => {
		const order = (file: string) => {
			const at = index.findIndex((entry) => entry.file === file);
			return at === -1 ? index.length : at;
		};
		return order(a) - order(b) || a.localeCompare(b);
	});
	const modelFiles = markdownFiles(root, modelFolder);
	const formFiles = new Map(
		[...contributorFiles, ...modelFiles].map((file) => [file, path.posix.basename(file, '.md')])
	);
	const slugs = new Set<string>();
	for (const slug of formFiles.values()) {
		if (slugs.has(slug)) throw new Error(`Two forms are named ${slug}.md; give one another name.`);
		slugs.add(slug);
	}
	const contributor = contributorFiles.map((file) =>
		buildForm(root, file, 'contributor', index.find((entry) => entry.file === file)?.summary, formFiles)
	);
	const courtSet = courtSetText(root);
	const downloads = downloadList(root);
	const model = modelFiles
		.map((file) => buildForm(root, file, 'model', undefined, formFiles, courtSet, downloads))
		.sort((a, b) => a.title.localeCompare(b.title));
	return [...contributor, ...model];
}
