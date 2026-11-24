import { describe, expect, it } from 'vitest';
import { attributionSource, locateQuotation, paragraphsOf, quotationPieces, quotationsIn, quoteContext } from '../src/lib/quote-context.ts';
import { caseMentions, citationKey, parseCitation, type CasePreviewList } from '../src/lib/case-links.ts';
import { renderEssay } from '../src/lib/essays/render.ts';

const webPage = [
	{
		page: null,
		label: null,
		method: 'html',
		text: 'Where Congress seeks to promote dual objectives in a single statute, courts must be more than usually hesitant.\n\n23\n\nMoreover, contrary to the reasoning of the court below, implication of a federal remedy is not plainly required.20 Tribal courts have repeatedly been recognized as appropriate forums for the exclusive adjudication of disputes affecting important personal and property interests of both Indians and non-Indians.21 See, e. g., Fisher v. District Court, 424 U.S. 382, 96 S.Ct. 943 (1976); Williams v. Lee, 358 U.S. 217 (1959). See also Ex parte Crow Dog, 109 U.S. 556 (1883).\n\nB\n\nOur reluctance is strongly reinforced by the specific legislative history underlying 25 U.S.C. § 1303.'
	}
];

describe('paragraphs of a document', () => {
	it('splits a web page at blank lines, without paragraph or footnote numbers', () => {
		const paragraphs = paragraphsOf(webPage);
		expect(paragraphs.map((paragraph) => paragraph.text.slice(0, 20))).toEqual([
			'Where Congress seeks',
			'Moreover, contrary t',
			'B',
			'Our reluctance is st'
		]);
		expect(paragraphs[1].text).toContain('plainly required. Tribal courts');
		expect(paragraphs[1].text).toContain('non-Indians. See,');
		expect(paragraphs[3].text).toContain('§ 1303.');
		expect(paragraphs[2].heading).toBe(true);
	});

	it('keeps numbers that belong to a citation', () => {
		const [paragraph] = paragraphsOf([{ page: null, label: null, method: 'html', text: 'required by Wis. Stat. § 806.245 to give full faith and credit.' }]);
		expect(paragraph.text).toBe('required by Wis. Stat. § 806.245 to give full faith and credit.');
	});

	it('joins a sentence a web page breaks with a blank line', () => {
		const paragraphs = paragraphsOf([{ page: null, label: null, method: 'html', text: '¶2 I would hold that the circuit court was required by\n\nWis. Stat. § 806.245 to give full faith.\n\n¶3 Teague commenced this action.' }]);
		expect(paragraphs.map((paragraph) => paragraph.text)).toEqual([
			'¶2 I would hold that the circuit court was required by Wis. Stat. § 806.245 to give full faith.',
			'¶3 Teague commenced this action.'
		]);
	});

	it('finds paragraphs in a PDF page by short last lines, joins broken words and drops the running head', () => {
		const pdfPage = {
			page: 9,
			label: null,
			method: 'text-layer',
			text: [
				'UNITED STATES v. KAGAMA.',
				'Opinion of the Court.',
				'of an Indian of some tribe, of a criminal character, committed within the limits of the',
				'reservation.',
				'It seems to us that this is within the competency of Con-',
				'gress. These Indian tribes are the wards of the nation. They',
				'are communities dependent on the United States.'
			].join('\n')
		};
		const paragraphs = paragraphsOf([pdfPage]);
		expect(paragraphs.map((paragraph) => paragraph.text)).toEqual([
			'of an Indian of some tribe, of a criminal character, committed within the limits of the reservation.',
			'It seems to us that this is within the competency of Congress. These Indian tribes are the wards of the nation. They are communities dependent on the United States.'
		]);
		expect(paragraphs[1].page).toBe(9);
	});

	it('sets apart a quotation the court introduces, even when its last line is full (Lone Wolf, 187 U.S. at 566)', () => {
		const pdfPage = {
			page: 14,
			label: null,
			method: 'text-layer',
			text: [
				'OCTOBER TERM, 1902.',
				'Opinron of the Court.',
				'availed of from considerations of governmental policy, par-',
				'ticularly if consistent with perfect good faith towards the In-',
				'dians. In United States v Eagama, (1885) 118 U. S. 375,',
				'speaking of the Indians, the court said (p. 382)',
				'"After an experience of a hundred years of the treaty-mak-',
				'ing system of government, Congress has determined upon a',
				'tion or tribe prior to March third, eighteen hundred and sev-',
				"enty-one, shall be hereby invalidated or impaired.'\"",
				'In upholding the validity of an act of Congress which con-',
				'ferred jurisdiction upon the courts of the United States for',
				'certain crimes committed on an Indian reservation within a',
				'State, the court said (p. 383)'
			].join('\n')
		};
		expect(paragraphsOf([pdfPage]).map((paragraph) => paragraph.text.slice(0, 30))).toEqual([
			'availed of from considerations',
			'"After an experience of a hund',
			'In upholding the validity of a'
		]);
	});
});

describe('finding a quotation', () => {
	const paragraphs = paragraphsOf(webPage);

	it('matches word for word, ignoring the ellipsis and punctuation, and marks the words', () => {
		const location = locateQuotation(paragraphs, 'Tribal courts have repeatedly been recognized as appropriate forums for the exclusive adjudication of disputes affecting important personal and property interests of both Indians and non-Indians ...');
		expect(location?.match).toBe('exact');
		expect(location?.first).toBe(1);
		const [[start, end]] = location!.highlights[1];
		expect(paragraphs[1].text.slice(start, end)).toBe('Tribal courts have repeatedly been recognized as appropriate forums for the exclusive adjudication of disputes affecting important personal and property interests of both Indians and non-Indians');
	});

	it('says which words differ', () => {
		const location = locateQuotation(
			paragraphsOf([{ page: null, label: null, method: 'html', text: 'In other words, the treaty was not a grant of rights to the Indians, but a grant of right from them,—a reservation of those not granted.' }]),
			'... the treaty was not a grant of rights to the Indians, but a grant of rights from them ...'
		);
		expect(location?.match).toBe('close');
		expect(location?.differences).toEqual([{ source: 'right', quoted: 'rights' }]);
	});

	it('matches the pieces of a quotation around a bracketed change', () => {
		// Pieces of one or two words would match anywhere, so they are left out when a longer one is there.
		expect(quotationPieces('[W]e hold that Alaska Native tribes ... retain their ... of')).toEqual([['we', 'hold', 'that', 'alaska', 'native', 'tribes']]);
		expect(quotationPieces('[W]e hold that ... retain their own jurisdiction')).toEqual([
			['we', 'hold', 'that'],
			['retain', 'their', 'own', 'jurisdiction']
		]);
	});

	it('finds nothing for words the document does not hold', () => {
		expect(locateQuotation(paragraphs, 'Even when the Constitution vests in Congress complete lawmaking authority')).toBeUndefined();
	});

	it('gives the paragraph before and after, with a section letter between', () => {
		const location = locateQuotation(paragraphs, 'Tribal courts have repeatedly been recognized as appropriate forums')!;
		const context = quoteContext(paragraphs, location);
		expect(context.before.map((paragraph) => paragraph.text.slice(0, 5))).toEqual(['Where']);
		expect(context.after.map((paragraph) => paragraph.text.slice(0, 5))).toEqual(['B', 'Our r']);
	});
});

describe('quotations in an essay', () => {
	it('reads each quotation and the source its attribution cites', () => {
		const markdown = [
			'::: quotes',
			'> Tribal courts have repeatedly been recognized ...',
			'',
			'[@santa-clara-pueblo-v-martinez, p. 65]',
			':::',
			'',
			'::: quote',
			'The power to tax is an essential attribute.',
			'',
			'[@merrion-v-jicarilla-apache-tribe, p. 137] (Marshall, J.)',
			':::',
			'',
			'> Not attributed.',
			'',
			'Plain text.'
		].join('\n');
		expect(quotationsIn(markdown)).toEqual([
			{ text: 'Tribal courts have repeatedly been recognized ...', source: 'santa-clara-pueblo-v-martinez', pinpoint: 'p. 65', line: 2 },
			{ text: 'The power to tax is an essential attribute.', source: 'merrion-v-jicarilla-apache-tribe', pinpoint: 'p. 137', line: 7 }
		]);
		expect(attributionSource('[@a-key; @b-key]')).toBeUndefined();
	});

	it('names the source on the attribution of the rendered page', () => {
		const library = { citation: () => 'A citation', term: () => undefined };
		const { html } = renderEssay('# Title\n\n> Tribal courts have repeatedly been recognized.\n\n[@santa-clara-pueblo-v-martinez, p. 65]\n', library);
		expect(html).toContain('data-quote-source="santa-clara-pueblo-v-martinez"');
		expect(html).toContain('data-quote-pinpoint="p. 65"');
	});
});

describe('cases cited in a paragraph', () => {
	const list: CasePreviewList = {
		cases: [
			{ id: 'fisher-v-district-court', name: 'Fisher v. District Court', citation: '424 U.S. 382 (1976)', court: '', decided: '', link: '/essays/x#case-fisher-v-district-court' },
			{ id: 'williams-v-lee', name: 'Williams v. Lee', citation: '358 U.S. 217 (1959)', court: '', decided: '', link: '/copies/w' },
			{ id: 'ex-parte-crow-dog', name: 'Ex parte Crow Dog', citation: '109 U.S. 556 (1883)', court: '', decided: '', link: '/c' }
		],
		citations: { [citationKey('424', 'U.S.', '382')]: 'fisher-v-district-court', [citationKey('109', 'U. S.', '556')]: 'ex-parte-crow-dog' }
	};

	it('links the case name with its citation, and a name written out in full', () => {
		const text = paragraphsOf(webPage)[1].text;
		const shown = caseMentions(text, list).map((mention) => [mention.id, text.slice(mention.start, mention.end)]);
		expect(shown).toEqual([
			['fisher-v-district-court', 'Fisher v. District Court, 424 U.S. 382'],
			['williams-v-lee', 'Williams v. Lee'],
			['ex-parte-crow-dog', 'Ex parte Crow Dog, 109 U.S. 556']
		]);
	});

	it('reads a citation written with spaces', () => {
		expect(parseCitation('236 Wis. 2d 384')).toEqual({ volume: '236', reporter: 'Wis. 2d', page: '384' });
		expect(citationKey('5', 'L. Ed.', '681')).toBe(citationKey('5', 'L.Ed.', '681'));
	});
});
