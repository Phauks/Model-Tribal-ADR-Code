/**
 * The page as a Markdown file (site/DESIGN.md, section 6, "Download"), written from the blocks
 * src/lib/page-document.ts reads, with a short header saying where it came from.
 */
import type { Block, PageDocument, Run } from './page-document.ts';

/** Escapes the characters Markdown would read as formatting inside running text. */
function escapeText(text: string): string {
	return text.replace(/([\\`*_[\]])/g, '\\$1');
}

function wrap(text: string, mark: string): string {
	const trimmed = text.trim();
	if (!trimmed) return text;
	const before = /^\s/.test(text) ? ' ' : '';
	const after = /\s$/.test(text) ? ' ' : '';
	return `${before}${mark}${trimmed}${mark}${after}`;
}

function styled(run: Run): string {
	if (run.lineBreak) return '  \n';
	if (run.code) {
		const fence = run.text.includes('`') ? '``' : '`';
		return `${fence}${run.text}${fence}`;
	}
	let text = escapeText(run.text);
	if (run.italic) text = wrap(text, '*');
	if (run.bold) text = wrap(text, '**');
	return text;
}

export function markdownRuns(runs: Run[]): string {
	let out = '';
	for (let index = 0; index < runs.length; ) {
		const link = runs[index].link;
		if (!link) {
			out += styled(runs[index]);
			index += 1;
			continue;
		}
		let text = '';
		for (; index < runs.length && runs[index].link === link; index += 1) text += styled(runs[index]);
		out += `[${text.trim()}](${link.replaceAll(' ', '%20').replaceAll('(', '%28').replaceAll(')', '%29')})`;
	}
	return out;
}

function indent(text: string, by: string): string {
	return text
		.split('\n')
		.map((line, index) => (index === 0 || line === '' ? line : `${by}${line}`))
		.join('\n');
}

export function markdownBlocks(blocks: Block[]): string {
	return blocks
		.map((block): string => {
			switch (block.type) {
				case 'heading':
					return `${'#'.repeat(block.level)} ${markdownRuns(block.runs)}`;
				case 'paragraph':
					return markdownRuns(block.runs);
				case 'rule':
					return '---';
				case 'code':
					return `\`\`\`\n${block.text}\n\`\`\``;
				case 'quote':
					return markdownBlocks(block.blocks)
						.split('\n')
						.map((line) => (line ? `> ${line}` : '>'))
						.join('\n');
				case 'list':
					return block.items
						.map((item) => {
							const marker = block.ordered ? `${item.number ?? 1}. ` : '- ';
							return `${marker}${indent(markdownBlocks(item.blocks), ' '.repeat(marker.length))}`;
						})
						.join('\n');
				case 'table': {
					const cell = (runs: Run[]) => markdownRuns(runs).replace(/\s*\n\s*/g, ' ').replaceAll('|', '\\|');
					const [head, ...body] = block.rows;
					const lines = [
						`| ${head.map(cell).join(' | ')} |`,
						`| ${head.map(() => '---').join(' | ')} |`,
						...body.map((row) => `| ${row.map(cell).join(' | ')} |`)
					];
					return block.caption ? `${lines.join('\n')}\n\n*${markdownRuns(block.caption)}*` : lines.join('\n');
				}
			}
		})
		.filter((text) => text.trim() !== '')
		.join('\n\n');
}

function quoteYaml(text: string): string {
	return `"${text.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

/** The page as Markdown, with a front-matter header giving its title, address, version and date. */
export function pageMarkdown(document: PageDocument): string {
	const header = [
		'---',
		`title: ${quoteYaml(document.title)}`,
		`source: ${document.address}`,
		`site: ${quoteYaml(document.siteName)}`,
		...(document.contentVersion ? [`content_version: ${document.contentVersion}`] : []),
		`saved: ${document.made.toISOString().slice(0, 10)}`,
		'---'
	].join('\n');
	return `${header}\n\n${markdownBlocks(document.blocks).replace(/\n{3,}/g, '\n\n').trim()}\n`;
}
