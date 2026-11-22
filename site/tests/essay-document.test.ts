import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { Fragment, Slice } from 'prosemirror-model';
import { describe, expect, it } from 'vitest';
import { essaySchema, parseEssay, serializeEssay, writeEssay } from '#lib/essays/document.ts';
import { referencesIn, splitFrontMatter } from '#lib/essays/syntax.ts';

const essayFolder = path.resolve(import.meta.dirname, '../../content/essays');
const essays = readdirSync(essayFolder)
	.filter((name) => name.endsWith('.md') && name !== 'README.md')
	.map((name) => ({ name, body: splitFrontMatter(readFileSync(path.join(essayFolder, name), 'utf8').normalize('NFC')).body }));

const sample = `# Title

Intro with a [@worcester-v-georgia, at 561] citation, a [[tribal-court|Tribal court]] link, *italics*, **bold** and ++underline++.

:::: case worcester-v-georgia
What the Court held.

::: quotes
> The Cherokee nation, then, is a distinct community.

— [@worcester-v-georgia, at 561]
:::

::: treatment
Distinguished in later cases.
:::
::::

::: quote
Peacemaking is not alternative dispute resolution.

— [@narf-ipi-home]
:::

::: analysis Why it matters
Our reading of the case.
:::

| Year | Event |
| --- | ---: |
| 1832 | Decided |
`;

describe('essay documents', () => {
	it('reads every essay block into the editor schema', () => {
		const document = parseEssay(sample);
		document.check();
		const types: string[] = [];
		document.descendants((node) => {
			types.push(node.type.name);
		});
		for (const type of ['case_block', 'case_part', 'quote_block', 'analysis_block', 'citation', 'term_link', 'table']) {
			expect(types).toContain(type);
		}
		const caseBlock = document.child(2);
		expect(caseBlock.attrs.source).toBe('worcester-v-georgia');
		expect(document.child(4).attrs.title).toBe('Why it matters');
	});

	it('writes blocks back so they read the same', () => {
		const document = parseEssay(sample);
		expect(parseEssay(serializeEssay(document)).eq(document)).toBe(true);
		expect(serializeEssay(document)).toContain(':::: case worcester-v-georgia');
	});

	it('keeps untouched text exactly as it was', () => {
		expect(writeEssay(parseEssay(sample), sample)).toBe(sample);
		for (const essay of essays) {
			expect(writeEssay(parseEssay(essay.body), essay.body), essay.name).toBe(essay.body.replace(/\n*$/, '\n'));
		}
	});

	it('rewrites only the block that changed', () => {
		const document = parseEssay(sample);
		const heading = document.child(0);
		const edited = document.replace(0, heading.nodeSize, new Slice(Fragment.from(essaySchema.node('heading', { level: 1 }, essaySchema.text('New title'))), 0, 0));
		const written = writeEssay(edited, sample);
		expect(written.split('\n')[0]).toBe('# New title');
		expect(written.split('\n').slice(1)).toEqual(sample.split('\n').slice(1));
	});

	it('reads every Part I essay and gets the same document back', () => {
		for (const essay of essays) {
			const document = parseEssay(essay.body);
			document.check();
			expect(parseEssay(serializeEssay(document)).eq(document), essay.name).toBe(true);
		}
	});

	it('lists the sources and glossary entries an essay uses', () => {
		const { sourceKeys, termIds } = referencesIn(sample);
		expect([...sourceKeys].sort()).toEqual(['narf-ipi-home', 'worcester-v-georgia']);
		expect([...termIds]).toEqual(['tribal-court']);
	});
});
