import { describe, expect, it } from 'vitest';
import { oldRequestTarget, pageOfRecord, presetFromFragment, requestLink } from '#lib/report-request.ts';

const site = 'https://triballawproject.org';

describe('Request a Change links', () => {
	it('opens the dialog from a fragment on the page that holds the link', () => {
		const link = requestLink({ kind: 'remove', record: 'copies/caselaw-access-project/us/72/0737-01.html' });
		expect(link).toBe('#request=remove&record=copies/caselaw-access-project/us/72/0737-01.html');
		expect(presetFromFragment(link)).toEqual({ kind: 'remove', record: 'copies/caselaw-access-project/us/72/0737-01.html' });
	});

	it('reads a bare #request and leaves other fragments alone', () => {
		expect(presetFromFragment('#request')).toEqual({});
		expect(presetFromFragment('#request&record=tribes/karuk-tribe')).toEqual({ record: 'tribes/karuk-tribe' });
		expect(presetFromFragment('#requests-heading')).toBeUndefined();
		expect(presetFromFragment('#history')).toBeUndefined();
		expect(presetFromFragment('#request=nonsense')).toEqual({});
	});

	it('writes to a nation’s team only for a question about a nation', () => {
		expect(presetFromFragment(requestLink({ kind: 'question', record: 'tribes/navajo-nation', toTeam: true }))).toEqual({ kind: 'question', record: 'tribes/navajo-nation', toTeam: true });
		expect(presetFromFragment('#request=remove&record=tribes/navajo-nation&to=team')?.toTeam).toBeUndefined();
	});

	it('finds the page a record is shown on', () => {
		expect(pageOfRecord('tribes/karuk-tribe')).toBe('/nations/karuk-tribe');
		expect(pageOfRecord('copies/constitutions/sample/abc.pdf')).toBe('/copies/view/constitutions/sample/abc.pdf');
		expect(pageOfRecord('cases/worcester-v-georgia')).toBe('/cases/worcester-v-georgia');
		expect(pageOfRecord('uploads/U-20261123-7KQ2MD')).toBeUndefined();
		expect(pageOfRecord('tribes/../../evil')).toBeUndefined();
	});
});

describe('old /requests addresses', () => {
	it('send a copy’s removal link to the copy’s page with the dialog filled in', () => {
		const url = new URL(`${site}/requests?kind=remove&record=copies/caselaw-access-project/us/72/0737-01.html`);
		expect(oldRequestTarget(url)).toBe('/copies/view/caselaw-access-project/us/72/0737-01.html#request=remove&record=copies/caselaw-access-project/us/72/0737-01.html');
	});

	it('send an error page’s report to the broken page, and anything else to the home page', () => {
		const report = new URL(`${site}/requests?kind=broken-page&address=${encodeURIComponent(`${site}/nations/missing`)}`);
		expect(oldRequestTarget(report)).toBe(`/nations/missing#request=broken-page&address=${site.replace('://', '%3A//')}/nations/missing`);
		expect(oldRequestTarget(new URL(`${site}/requests?address=https://elsewhere.example/x`))).toBe('/#request=&address=https%3A//elsewhere.example/x');
		expect(oldRequestTarget(new URL(`${site}/requests`))).toBe('/#request=');
		expect(oldRequestTarget(new URL(`${site}/requests?kind=contribute`))).toBe('/#request=contribute');
	});
});
