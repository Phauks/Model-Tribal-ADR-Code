import { describe, expect, it } from 'vitest';
import { cleanOpinionHtml, opinionTexts } from '#lib/opinion-text.ts';

const copy = `<!doctype html><html><head><title>A v. B</title></head><body><header><h1>A v. B</h1></header>
<main>
<section class="casebody"><section class="head-matter"><h4 class="parties">A v. B</h4></section>
<article class="opinion" data-type="majority">
<p class="author" id="b54-8"><a id="p536" href="#p536" data-label="536" data-citation-index="1" class="page-label">*536</a>MR. JUSTICE HASWELL</p>
<p id="b54-9">The State <em>may not</em> tax it. See <a href="/cases/worcester-v-georgia" target="_top">31 U.S. 515</a> and <a class="external" href="https://case.law/caselaw/?reporter=f2d&amp;volume=248" target="_blank" rel="noopener" title="Opens on case.law">248 F.2d 292</a>.<a class="footnotemark" href="#footnote_1_1" id="ref_footnote_1_1">1</a></p>
<aside data-label="1" class="footnote" id="footnote_1_1"><a href="#ref_footnote_1_1">1</a><p id="b1">A note.</p></aside>
</article>
<article class="opinion" data-type="dissent">
<p class="author">MR. JUSTICE CASTLES, dissenting.</p>
<p onclick="steal()">I dissent.<script>alert(1)</script> <a href="javascript:alert(1)">here</a> <img src="https://tracker.example/x.png"><img src="data:image/png;base64,iVBOR=" width="40" height="20" onerror="x()"></p>
</article>
</section>
</main></body></html>`;

describe('the opinions in a served copy', () => {
	const opinions = opinionTexts(copy);

	it('finds each opinion in order, with its type', () => {
		expect(opinions.map((opinion) => opinion.type)).toEqual(['majority', 'dissent']);
	});

	it('shows a page number as a marker without its link or star', () => {
		expect(opinions[0].html).toContain('<p class="opinion-author"><span class="page-mark" aria-label="page 536">536</span>MR. JUSTICE HASWELL</p>');
		expect(opinions[0].html).not.toContain('*536');
	});

	it('keeps the citations’ links, on this site and on case.law in a new tab', () => {
		expect(opinions[0].html).toContain('<a href="/cases/worcester-v-georgia">31 U.S. 515</a>');
		expect(opinions[0].html).toContain('<a href="https://case.law/caselaw/?reporter=f2d&amp;volume=248" target="_blank" rel="noopener noreferrer" class="external" title="Opens on case.law">248 F.2d 292</a>');
	});

	it('gives each opinion’s footnotes addresses of their own', () => {
		expect(opinions[0].html).toContain('<a href="#opinion-1-footnote_1_1" id="opinion-1-ref_footnote_1_1" class="footnotemark">1</a>');
		expect(opinions[0].html).toContain('<aside class="footnote" id="opinion-1-footnote_1_1"><a href="#opinion-1-ref_footnote_1_1">1</a><p>A note.</p></aside>');
	});

	it('leaves out scripts, handlers, script addresses and pictures from elsewhere', () => {
		const dissent = opinions[1].html;
		expect(dissent).not.toMatch(/script|onclick|onerror|alert|tracker/);
		expect(dissent).toContain('<a>here</a>');
		expect(dissent).toContain('<img src="data:image/png;base64,iVBOR=" alt="" width="40" height="20">');
	});

	it('reads the writer’s line and the words that finish it as one line', () => {
		const [opinion] = opinionTexts('<main><article class="opinion" data-type="majority"><p class="author">Mr Chief Justice Marshall</p><p>delivered the opinion of the Court.</p><p>This cause.</p></article></main>');
		expect(opinion.html).toBe('<p><span class="opinion-author">Mr Chief Justice Marshall</span> delivered the opinion of the Court.</p><p>This cause.</p>');
	});

	it('leaves out the head matter', () => {
		expect(opinions.map((opinion) => opinion.html).join('')).not.toContain('parties');
	});
});

describe('cleaning an opinion', () => {
	it('keeps the text of elements it does not keep', () => {
		expect(cleanOpinionHtml('<div class="x"><span style="color:red">Plain</span> words</div>', 'opinion-1-')).toBe('Plain words');
	});

	it('drops a style element with its contents', () => {
		expect(cleanOpinionHtml('<style>p{display:none}</style><p>Shown</p>', 'opinion-1-')).toBe('<p>Shown</p>');
	});

	it('refuses addresses that leave the site without https or http', () => {
		expect(cleanOpinionHtml('<a href="//evil.example/">a</a><a href="data:text/html,x">b</a>', 'opinion-1-')).toBe('<a>a</a><a>b</a>');
	});
});
