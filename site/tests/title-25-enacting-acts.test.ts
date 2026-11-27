// The Act each section of Title 25 of the Code links to as the one that enacted it
// (content/law/title-25-sections.json, written by scripts/law/title_25_acts.py) must be
// the Act the section's own source credit names first. A misread credit once gave
// 25 U.S.C. § 5321 to a 1988 appropriations Act (Nov. 27, 2026).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { repositoryRoot, sources } from '#lib/server/content.ts';

vi.mock('virtual:source-citations', () => ({ sourceCitations: {} }));
vi.mock('virtual:essay-library', () => ({ essaysInGit: {} }));
vi.mock('$app/env', () => ({ version: 'test-build' }));
vi.mock('cloudflare:workers', () => ({ env: {}, waitUntil: () => undefined }));

type Row = { number: string; inForce: boolean; act?: string; partOf?: string; amendedBy?: string[]; credit?: string };
const file = JSON.parse(readFileSync(path.join(repositoryRoot, 'content/law/title-25-sections.json'), 'utf8')) as { code: Record<string, Row[]> };
const rows = Object.values(file.code).flat();
const row = (number: string) => rows.find((each) => each.number === number)!;

/** The credit's first citation, up to the first semicolon outside brackets and parentheses. */
function firstCitation(credit: string): string {
	let depth = 0;
	for (let index = 0; index < credit.length; index++) {
		const character = credit[index];
		if ('(['.includes(character)) depth++;
		else if (')]'.includes(character)) depth--;
		else if (character === ';' && depth <= 0) return credit.slice(0, index);
	}
	return credit;
}

describe('The Act that enacted each section of Title 25', () => {
	it('is the first Act in the section’s source credit', () => {
		expect(row('5321').act).toBe('indian-self-determination-and-education-assistance-act-1975');
		expect(row('5321').amendedBy).toContain('public-law-100-446');
	});

	it('is the Act that added the section, for a section added to another Act', () => {
		// "Pub. L. 94-437, title II, §203, as added Pub. L. 100-713, title II, §203(c), Nov. 23, 1988, 102 Stat. 4805"
		expect(row('1621b')).toMatchObject({ act: 'public-law-100-713', partOf: 'public-law-94-437' });
	});

	it('is none for a section from the Revised Statutes, whatever amended it later', () => {
		expect(row('71').act).toBeUndefined();
		expect(row('71').amendedBy).toEqual(['public-law-100-647']);
	});

	it('names, for every section in force, the public law its credit cites first', () => {
		const records = sources();
		const wrong = [];
		for (const section of rows.filter((each) => each.inForce && each.act && each.credit)) {
			const number = records.get(section.act!)?.citation.number ?? '';
			const law = /^Pub\. L\. No\. (\d+-\d+)$/.exec(number)?.[1] ?? /^public-law-(\d+-\d+)$/.exec(section.act!)?.[1];
			const first = firstCitation(section.credit!).split(' as added ').at(-1)!.trim();
			// An Act cited by date and chapter ("June 18, 1934, ch. 576, ...") can carry a public law number in its record too.
			if (!law || !/^(?:Added )?Pub\. L\. /.test(first)) continue;
			if (!new RegExp(`^(?:Added )?Pub\\. L\\. ${law}\\b`).test(first)) wrong.push(`${section.number}: ${section.act}`);
		}
		expect(wrong).toEqual([]);
	});
});
