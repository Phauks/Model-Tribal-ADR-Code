import { describe, expect, it } from 'vitest';
import { readRequestForm } from '#lib/server/request-form.ts';

function form(fields: Record<string, string | File>): FormData {
	const data = new FormData();
	for (const [name, value] of Object.entries({ acceptStatements: 'yes', ...fields })) data.append(name, value);
	return data;
}

const pdf = () => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])], 'resolution.pdf', { type: 'application/pdf' });

describe('request form', () => {
	it('needs only an email address, the details and the accepted statements for a question', async () => {
		const result = await readRequestForm(form({ kind: 'question', contact: 'office@example.org', details: 'Hello' }));
		expect(result.ok).toBe(true);
	});

	it('takes an email address only, not a phone number', async () => {
		const result = await readRequestForm(form({ kind: 'question', contact: '555-0100', details: 'Hello' }));
		expect(!result.ok && result.errors.contact).toMatch(/whole address/);
	});

	it('needs the statements accepted before a request is sent', async () => {
		const result = await readRequestForm(form({ kind: 'question', contact: 'office@example.org', details: 'Hello', acceptStatements: '' }));
		expect(!result.ok && Object.keys(result.errors)).toEqual(['acceptStatements']);
	});

	it('shares the sender with the nation’s team only when ticked, and never for a removal', async () => {
		const read = async (fields: Record<string, string>) => {
			const result = await readRequestForm(form({ contact: 'sample@example.org', details: 'Hello', material: 'tribes/sample-nation', nationIdentifier: 'sample-nation', ...fields }));
			return result.ok ? result.request.sharedWithTeam : undefined;
		};
		expect(await read({ kind: 'question', shareWithTeam: 'yes' })).toBe(true);
		expect(await read({ kind: 'question' })).toBe(false);
		expect(await read({ kind: 'remove', shareWithTeam: 'yes' })).toBe(false);
		expect(await read({ kind: 'question', shareWithTeam: 'yes', nationIdentifier: '' })).toBe(false);
	});

	it('asks where the material is for a request to restrict it', async () => {
		const result = await readRequestForm(form({ kind: 'restrict', contact: 'office@example.org', details: 'Please hide it' }));
		expect(result.ok).toBe(false);
		expect(!result.ok && Object.keys(result.errors)).toEqual(['material']);
	});

	it('turns away a filled-in hidden field', async () => {
		const result = await readRequestForm(form({ kind: 'question', contact: 'person@example.org', details: 'y', website: 'spam' }));
		expect(!result.ok && result.spam).toBe(true);
	});

	it('checks a file by its first bytes, not its name', async () => {
		const fake = new File(['<html>'], 'evil.pdf', { type: 'application/pdf' });
		const result = await readRequestForm(form({ kind: 'question', contact: 'person@example.org', details: 'y', files: fake }));
		expect(!result.ok && result.errors.files).toMatch(/Only PDF/);
		const real = await readRequestForm(form({ kind: 'question', contact: 'person@example.org', details: 'y', files: pdf() }));
		expect(real.ok && real.request.sources[0]?.file?.type).toBe('application/pdf');
	});

	it('takes several files under one name, up to the limit', async () => {
		const data = form({ kind: 'question', contact: 'person@example.org', details: 'y' });
		for (let count = 0; count < 2; count += 1) data.append('files', pdf());
		const two = await readRequestForm(data);
		expect(two.ok && two.request.sources).toHaveLength(2);
		for (let count = 0; count < 4; count += 1) data.append('files', pdf());
		const six = await readRequestForm(data);
		expect(!six.ok && six.errors.files).toMatch(/at most 5 files/);
	});

	it('asks a contributor for permission to publish', async () => {
		const result = await readRequestForm(form({ kind: 'contribute', contact: 'person@example.org', details: 'A source' }));
		expect(!result.ok && Object.keys(result.errors)).toEqual(['publicationPermission']);
	});

	describe('adding a nation that is missing', () => {
		const complete = {
			kind: 'add-nation',
			contact: 'clerk@example.org',
			missingNationOfficialName: 'Example Band',
			missingNationStates: 'Nevada',
			authorityStatement: 'authorized-by-government',
			source1Kind: 'state',
			source1Citation: 'Example Rev. Stat. § 1.010'
		};

		it('accepts one cited government source', async () => {
			const result = await readRequestForm(form(complete));
			expect(result.ok).toBe(true);
			expect(result.ok && result.request.sources).toHaveLength(1);
		});

		it('accepts an upload instead of a citation', async () => {
			const { source1Citation: _citation, ...rest } = complete;
			const result = await readRequestForm(form({ ...rest, source1File: pdf() }));
			expect(result.ok).toBe(true);
		});

		it('needs at least one source', async () => {
			const { source1Kind: _kind, source1Citation: _citation, ...rest } = complete;
			const result = await readRequestForm(form(rest));
			expect(!result.ok && result.errors.source1Citation).toMatch(/at least one government source/);
		});

		it('needs the kind of each source and the statement of authority', async () => {
			const result = await readRequestForm(
				form({ ...complete, source2Citation: 'Another source', authorityStatement: '' })
			);
			expect(!result.ok && Object.keys(result.errors).sort()).toEqual(['authorityStatement', 'source2Kind']);
		});
	});
});
