import { describe, expect, it } from 'vitest';
import { documentFile, pageSpan, pinpointCitation, publisherName, readingPath, trustOf } from '#lib/document-text.ts';

describe('pinpointCitation', () => {
	it('puts the pinpoint after a reporter’s first page', () => {
		expect(pinpointCitation('Tracy v. Superior Court, 168 Ariz. 23 (1991)', '30', '31')).toBe('Tracy v. Superior Court, 168 Ariz. 23, 30–31 (1991).');
	});

	it('cites a page "at" for a document without a reporter', () => {
		expect(pinpointCitation('Exec. Order No. 13175 (2000)', '2')).toBe('Exec. Order No. 13175, at 2 (2000).');
	});
});

describe('pageSpan', () => {
	it('drops repeated digits, as the Indigo Book does', () => {
		expect(pageSpan('132', '133')).toBe('132–33');
		expect(pageSpan('99', '101')).toBe('99–101');
		expect(pageSpan('7', '7')).toBe('7');
	});
});

describe('trustOf', () => {
	it('labels where a copy came from', () => {
		expect(trustOf({ mediaType: 'text/html', links: ['https://static.case.law/x'] }).kind).toBe('ocr');
		expect(trustOf({ mediaType: 'application/pdf', links: ['https://www.govinfo.gov/x.pdf'] })).toMatchObject({ kind: 'official', verified: true });
		expect(trustOf({ mediaType: 'application/pdf', links: ['https://narf.org/x.pdf'] }).kind).toBe('publisher');
		expect(trustOf({ mediaType: 'text/html', links: ['https://treaties.okstate.edu/x'] }).kind).toBe('transcription');
	});

	it('never calls a text taken from a government scan official', () => {
		expect(trustOf({ mediaType: 'text/plain', links: ['https://www.govinfo.gov/link/statute/9/842'], derivedFrom: 'treaties/a.pdf' })).toMatchObject({ kind: 'ocr', verified: false, label: 'Text from the scan, unchecked' });
	});
});

describe('documentFile', () => {
	it('shows a PDF in the viewer with no reading version', () => {
		const file = documentFile({ key: 'govinfo/a.pdf', mediaType: 'application/pdf', sha256: 'ab', bytes: 2048, links: ['https://www.govinfo.gov/a.pdf'] }, { title: 'T' });
		expect(file).toMatchObject({ shown: 'pdf', extension: '.pdf', size: '2 KB', verify: '/verify?sha256=ab&name=a.pdf', title: 'T' });
		expect(file.reading).toBeUndefined();
	});

	it('gives a text a reading version', () => {
		const file = documentFile({ key: 'okstate/b.txt', mediaType: 'text/plain', sha256: 'ab', bytes: 10, links: ['https://treaties.okstate.edu/b'] }, { title: 'T' });
		expect(file.reading).toEqual({ path: readingPath('okstate/b.txt'), name: 'b' });
	});

	it('names a publisher, not its address', () => {
		expect(publisherName('https://www.govinfo.gov/x')).toBe('GovInfo');
	});
});
