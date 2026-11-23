import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { filledMarkdown, formHtml, readAnswers, requestKindOfForm, type FormTemplate } from '#lib/forms.ts';
import { buildFormCatalog, downloadFolder, downloadList, templateMarkdown } from '#lib/server/form-catalog.ts';
import {
	formSubmissionsFor,
	nextFilingIdentifier,
	readOnlineForm,
	readUploadedForm,
	setFilingIdentifier
} from '#lib/server/form-submissions.ts';
import { eventsFor } from '#lib/server/events.ts';
import { matchSignIn, type SignedInPerson } from '#lib/server/people.ts';
import { deleteExpiredPersonalDetails, requestByReference, resolveRequest, saveRequest } from '#lib/server/request-store.ts';
import { testDatabase } from './database.ts';

const catalog = buildFormCatalog();
const statement = catalog.find((form) => form.slug === 'contributor-statement')!;

function formData(fields: Record<string, string | File>): FormData {
	const data = new FormData();
	for (const [name, value] of Object.entries(fields)) data.append(name, value);
	return data;
}

function fieldNamed(template: FormTemplate, label: string) {
	const field = template.fields.find((entry) => entry.label === label);
	if (!field) throw new Error(`No field labeled ${label}`);
	return field;
}

describe('form catalog', () => {
	it('lists the contributor forms in the order of their README', () => {
		expect(catalog.slice(0, 3).map((form) => form.slug)).toEqual([
			'contributor-statement',
			'interview-consent-and-release',
			'cultural-authority-permission'
		]);
		expect(statement).toMatchObject({ title: 'Contributor statement', version: '0.2.0', summary: 'Always', group: 'contributor' });
		expect(statement.identifiers).toEqual(['contributor-statement']);
		expect(statement.checksum).toMatch(/^[0-9a-f]{64}$/);
		const interview = catalog.find((form) => form.slug === 'interview-consent-and-release');
		expect(interview?.identifiers).toEqual(['interview-consent', 'interview-release']);
	});

	it('turns boxes, blanks, empty cells and placeholders into labeled fields', () => {
		const { markdown, fields } = templateMarkdown(
			[
				'# A form',
				'',
				'Form `a-form`, version 1.0.0. Filing `{{filing.identifier}}`.',
				'',
				'## 1. About you',
				'',
				'| | |',
				'| --- | --- |',
				'| Name | |',
				'| Signature or typed name | |',
				'| Date | |',
				'',
				'Are you an adult? ☐ Yes ☐ No',
				'',
				'- ☐ Other: ______',
				'',
				'## 2. Which material',
				'',
				'______',
				'',
				'**Questions.** {{project.contact}} Led by {{project.lead_author}}. Purpose: {{interview.purpose}}.',
				'',
				'**Project use.** Received ______.'
			].join('\n')
		);
		expect(fields.map(({ kind, label, projectOnly }) => [kind, label, projectOnly])).toEqual([
			['text', 'Filing number', true],
			['text', 'Name', false],
			['signature', 'Signature or typed name', false],
			['date', 'Date', false],
			['check', 'Are you an adult?: Yes', false],
			['check', 'Are you an adult?: No', false],
			['check', 'About you: Other', false],
			['text', 'About you: Other (write in)', false],
			['long', 'Which material', false],
			['text', 'Purpose of the interview', false],
			['text', 'Project use: Received', true]
		]);
		expect(markdown).toContain('| Name | %%F1%% |');
		expect(markdown).toContain('[request page](/requests)');
		expect(markdown).toContain('Led by Trevor Goldsmith.');
	});

	it('links sibling forms to their pages and drops links to internal documents', () => {
		expect(statement.html).toContain('href="/forms/young-contributor-consent"');
		expect(statement.html).toContain('href="/charter"');
		const interviewer = catalog.find((form) => form.slug === 'interviewer-agreement')!;
		expect(interviewer.html).not.toContain('contributions.md');
		expect(interviewer.html).toContain('rules for contributions and use only approved forms');
		const withdrawal = catalog.find((form) => form.slug === 'change-or-withdrawal-request')!;
		expect(withdrawal.html).toContain('href="/requests"');
		expect(statement.html).toContain('<p class="form-project-use"><strong>Project use.</strong>');
		expect(statement.html).not.toMatch(/<h1/);
	});

	it('reads model forms from content/forms and refuses two forms with one name', () => {
		const root = mkdtempSync(path.join(tmpdir(), 'forms-'));
		mkdirSync(path.join(root, 'docs/contributor-forms'), { recursive: true });
		mkdirSync(path.join(root, 'content/forms/peacemaking'), { recursive: true });
		writeFileSync(
			path.join(root, 'content/forms/peacemaking/petition.md'),
			'# Petition for peacemaking\n\nForm `petition`, version 1.0.0.\n\nAsk for a peacemaking session.\n\n| | |\n| --- | --- |\n| Name | |\n'
		);
		const forms = buildFormCatalog(root);
		expect(forms).toHaveLength(1);
		expect(forms[0]).toMatchObject({ slug: 'petition', group: 'model', summary: 'Ask for a peacemaking session.' });
		writeFileSync(path.join(root, 'docs/contributor-forms/petition.md'), '# Other\n\nForm `other`, version 1.0.0.\n');
		expect(() => buildFormCatalog(root)).toThrow(/Two forms are named petition\.md/);
	});

	it('offers a Word and a PDF copy of every model form, built from its current text', () => {
		const root = path.resolve(import.meta.dirname, '../..');
		const list = downloadList(root);
		expect(list, 'run python3 scripts/forms/build_forms.py').toBeDefined();
		const variables = readdirSync(path.join(root, 'content/variables'))
			.filter((file) => file.endsWith('.yaml'))
			.sort()
			.map((file) => readFileSync(path.join(root, 'content/variables', file)));
		const stale = 'A form or content/variables changed: run python3 scripts/forms/build_forms.py';
		expect(list!.variables, stale).toBe(createHash('sha256').update(Buffer.concat(variables)).digest('hex'));
		for (const form of catalog.filter((template) => template.group === 'model')) {
			expect(form.downloads?.map((download) => download.href)).toEqual([
				`/help/forms/${form.slug}.docx`,
				`/help/forms/${form.slug}.pdf`
			]);
			expect(list!.sources[form.slug], stale).toBe(
				createHash('sha256').update(readFileSync(path.join(root, form.file))).digest('hex')
			);
			for (const download of form.downloads!) {
				const file = readFileSync(path.join(root, downloadFolder, path.basename(download.href)));
				expect(createHash('sha256').update(file).digest('hex')).toBe(download.sha256);
			}
		}
	});

	it('builds every model form on the blank court form', () => {
		const parts = [
			'## Before you start',
			'Court staff can explain the steps but cannot give legal advice.',
			'## Case information',
			'I swear or affirm',
			'Notary or clerk, if the court requires it:',
			'## Notes for courts adapting this form',
			'These notes are not part of the form.'
		];
		const root = path.resolve(import.meta.dirname, '../..');
		const model = catalog.filter((template) => template.group === 'model');
		expect(model.map((form) => form.slug)).toContain('blank-court-form');
		for (const form of model) {
			const text = readFileSync(path.join(root, form.file), 'utf8');
			expect(text, form.file).toContain(`Form \`${form.slug}\`, version ${form.version}. A court may adopt or change this form`);
			for (const part of parts) expect(text, `${form.file} lacks "${part}"`).toContain(part);
		}
	});

	it("leaves a model form's front matter off the page, lists its summary and shows the court's settings as model text", () => {
		const root = mkdtempSync(path.join(tmpdir(), 'forms-'));
		mkdirSync(path.join(root, 'content/forms'), { recursive: true });
		mkdirSync(path.join(root, 'content/variables'), { recursive: true });
		writeFileSync(
			path.join(root, 'content/forms/answer.md'),
			'---\nid: answer\nsummary: Respond to a case filed against you.\nbased_on:\n  - nation: lummi\n---\n\n# Answer\n\nForm `answer`, version 0.1.0.\n\n{{court.name}}. You have {{court.answer_days}} days.\n'
		);
		writeFileSync(
			path.join(root, 'content/variables/court.yaml'),
			'group: court\nvariables:\n  name:\n    description: Court.\n    model: "[Name of Tribal Court]"\n  answer_days:\n    description: Days.\n    model: "[number]"\n'
		);
		const [form] = buildFormCatalog(root);
		expect(form).toMatchObject({ slug: 'answer', title: 'Answer', version: '0.1.0', summary: 'Respond to a case filed against you.' });
		expect(form.html).not.toContain('based_on');
		// The court sets the days when it adopts the form; the person writes in the court's name.
		expect(form.fields.map((field) => field.label)).toEqual(['Court']);
		expect(form.html).toContain('You have [number] days.');
	});
});

describe('filling in a form', () => {
	const signature = fieldNamed(statement, 'Signature or typed name');
	const name = fieldNamed(statement, 'Name (private unless you choose credit by name)');
	const yes = fieldNamed(statement, 'Are you an adult where you live?: Yes');

	it('shows inputs online, lines on paper and answers on the copy, escaping what was typed', () => {
		const online = formHtml(statement, 'online', { [name.name]: '<b>Ann</b>', [yes.name]: 'on' });
		expect(online).toContain(`name="${name.name}" aria-label="Name (private unless you choose credit by name)"`);
		expect(online).toContain('value="&lt;b&gt;Ann&lt;/b&gt;"');
		expect(online).toMatch(new RegExp(`name="${yes.name}"[^>]*checked`));
		// The filing number is never asked online.
		expect(online).not.toContain('name="f0"');

		const blank = formHtml(statement, 'blank');
		expect(blank).not.toContain('<input');
		expect(blank).toContain('class="form-line"');

		const filled = formHtml(statement, 'filled', { [name.name]: '<b>Ann</b>', [yes.name]: 'on' });
		expect(filled).toContain('<span class="form-answer">&lt;b&gt;Ann&lt;/b&gt;</span>');
		expect(filled).toContain('☒');
	});

	it('needs a typed signature and keeps answers to a sensible length', () => {
		expect(readAnswers(statement, formData({ [name.name]: 'Ann' }))).toEqual({
			ok: false,
			errors: { signature: 'Type your name in a signature line of the form.' }
		});
		const tooLong = readAnswers(statement, formData({ [signature.name]: 'Ann', [name.name]: 'x'.repeat(1001) }));
		expect(tooLong.ok).toBe(false);
		const read = readAnswers(statement, formData({ [signature.name]: ' Ann Smith ', [yes.name]: 'on', f0: 'filing-2026-0001' }));
		expect(read).toEqual({ ok: true, answers: { [signature.name]: 'Ann Smith', [yes.name]: 'on' }, signature: 'Ann Smith' });
	});

	it('writes the answers into the Markdown without breaking tables', () => {
		const copy = filledMarkdown(statement, { [name.name]: 'Ann | Smith', [yes.name]: 'on' });
		expect(copy).toContain('| Name (private unless you choose credit by name) | Ann \\| Smith |');
		expect(copy).toContain('| Are you an adult where you live? | ☒ Yes ☐ No');
		expect(copy).toContain('Filing `______`');
		expect(copy).not.toMatch(/%%F\d+%%/);
	});

	it('opens a change or withdrawal as a request to restrict material', () => {
		const withdrawal = catalog.find((form) => form.slug === 'change-or-withdrawal-request')!;
		expect(requestKindOfForm(withdrawal)).toBe('restrict');
		expect(requestKindOfForm(statement)).toBe('contribute');
	});
});

describe('forms sent to the project', () => {
	let database: D1Database;
	let stored: Map<string, Uint8Array>;
	let bucket: R2Bucket;
	let editor: SignedInPerson;
	const signature = fieldNamed(statement, 'Signature or typed name');

	beforeEach(async () => {
		database = testDatabase();
		stored = new Map();
		bucket = {
			put: async (key: string, value: Uint8Array) => void stored.set(key, value),
			delete: async (keys: string[]) => keys.forEach((key) => stored.delete(key))
		} as unknown as R2Bucket;
		const result = await matchSignIn(
			database,
			{ subject: 'account-lead', email: 'lead@example.org', emailVerified: true, name: 'Lead' },
			'lead@example.org'
		);
		if (result.outcome !== 'signed-in') throw new Error('not signed in');
		editor = result.person;
	});

	it('saves a form signed online with a copy of the filled form, and files it', async () => {
		const sent = readOnlineForm(
			statement,
			formData({ [signature.name]: 'Ann Smith', senderName: 'Ann Smith', contact: 'ann@example.org', electronicSignature: 'on' })
		);
		if (!sent.ok) throw new Error(JSON.stringify(sent.errors));
		const reference = await saveRequest(database, bucket, sent.request, sent.submission);
		const found = await requestByReference(database, reference);
		expect(found?.request).toMatchObject({ kind: 'contribute', requesterName: 'Ann Smith', contact: 'ann@example.org' });
		const [submission] = await formSubmissionsFor(database, found!.request.identifier);
		expect(submission).toMatchObject({ form: 'contributor-statement', formVersion: '0.2.0', method: 'online', signedName: 'Ann Smith' });
		const copy = new TextDecoder().decode(stored.get(submission.filledCopyKey!));
		expect(copy).toContain('| Signature or typed name | Ann Smith |');
		expect(copy).toContain('who agreed that the name typed in the signature line is their signature');

		expect(await nextFilingIdentifier(database, new Date('2026-11-22T00:00:00Z'))).toBe('filing-2026-0001');
		await setFilingIdentifier(database, found!.request, 'filing-2026-0001', editor);
		expect(await nextFilingIdentifier(database, new Date('2026-11-22T00:00:00Z'))).toBe('filing-2026-0002');
		const history = await eventsFor(database, 'request', found!.request.identifier);
		expect(history.map((event) => event.action)).toEqual([
			'Form received through the website: Contributor statement, version 0.2.0, signed online',
			'Forms filed under filing-2026-0001'
		]);
	});

	it('needs the sender to agree that the typed name is a signature', () => {
		const sent = readOnlineForm(
			statement,
			formData({ [signature.name]: 'Ann Smith', senderName: 'Ann Smith', contact: 'ann@example.org' })
		);
		expect(sent.ok).toBe(false);
		if (!sent.ok) expect(Object.keys(sent.errors)).toEqual(['electronicSignature']);
	});

	it('saves a photo of a signed paper copy as a file of the request', async () => {
		const missing = await readUploadedForm(statement, formData({ senderName: 'Ann', contact: 'ann@example.org' }));
		expect(missing.ok).toBe(false);
		const sent = await readUploadedForm(
			statement,
			formData({
				senderName: 'Ann',
				contact: 'ann@example.org',
				scan1: new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'page 1.jpg')
			})
		);
		if (!sent.ok) throw new Error(JSON.stringify(sent.errors));
		const reference = await saveRequest(database, bucket, sent.request, sent.submission);
		const found = await requestByReference(database, reference);
		expect(found?.sources).toHaveLength(1);
		expect(found?.sources[0]).toMatchObject({ fileName: 'page 1.jpg', fileType: 'image/jpeg' });
		const [submission] = await formSubmissionsFor(database, found!.request.identifier);
		expect(submission).toMatchObject({ method: 'paper-upload', filledCopyKey: null, answers: null });
	});

	it('keeps the personal details of a request that came with a signed form', async () => {
		const sent = readOnlineForm(
			statement,
			formData({ [signature.name]: 'Ann Smith', senderName: 'Ann Smith', contact: 'ann@example.org', electronicSignature: 'on' })
		);
		if (!sent.ok) throw new Error('not read');
		const reference = await saveRequest(database, bucket, sent.request, sent.submission);
		const found = await requestByReference(database, reference);
		await resolveRequest(database, found!.request, 'answered', null, editor);
		await database
			.prepare(`UPDATE requests SET resolved_at = '2020-01-01T00:00:00Z' WHERE identifier = ?`)
			.bind(found!.request.identifier)
			.run();
		expect(await deleteExpiredPersonalDetails(database)).toBe(0);
	});
});
