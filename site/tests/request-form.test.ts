import { describe, expect, it } from 'vitest';
import { readRequestForm } from '#lib/server/request-form.ts';

function form(fields: Record<string, string | File>): FormData {
	const data = new FormData();
	for (const [name, value] of Object.entries(fields)) data.append(name, value);
	return data;
}

const pdf = () => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])], 'resolution.pdf', { type: 'application/pdf' });

describe('request form', () => {
	it('needs only a way to reply and the details for a question', async () => {
		const result = await readRequestForm(form({ kind: 'question', contact: 'office@example.org', details: 'Hello' }));
		expect(result.ok).toBe(true);
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
		const result = await readRequestForm(form({ kind: 'restrict', contact: '555-0100', details: 'Please hide it' }));
		expect(result.ok).toBe(false);
		expect(!result.ok && Object.keys(result.errors)).toEqual(['material']);
	});

	it('turns away a filled-in hidden field', async () => {
		const result = await readRequestForm(form({ kind: 'question', contact: 'x', details: 'y', website: 'spam' }));
		expect(!result.ok && result.spam).toBe(true);
	});

	it('checks a file by its first bytes, not its name', async () => {
		const fake = new File(['<html>'], 'evil.pdf', { type: 'application/pdf' });
		const result = await readRequestForm(form({ kind: 'question', contact: 'x', details: 'y', file1: fake }));
		expect(!result.ok && result.errors.file1).toMatch(/Only PDF/);
		const real = await readRequestForm(form({ kind: 'question', contact: 'x', details: 'y', file1: pdf() }));
		expect(real.ok && real.request.sources[0]?.file?.type).toBe('application/pdf');
	});

	it('asks a contributor for permission to publish', async () => {
		const result = await readRequestForm(form({ kind: 'contribute', contact: 'x', details: 'A source' }));
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
