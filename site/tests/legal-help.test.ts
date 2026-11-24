import { describe, expect, it } from 'vitest';
import { legalHelpCitation, legalHelpFor, legalHelpSourceKey } from '#lib/server/legal-help.ts';
import { SourceUses } from '#lib/server/source-uses.ts';

// Legal help on nation pages (research/legal-help; Trevor chose its own
// section, grouped as Legal aid, Self-help and Legal information, Nov. 24, 2026).
describe('legal help for a nation', () => {
	it('puts the nation’s own legal aid first, then providers by group, each cited', () => {
		const sources = new SourceUses((key) => key);
		const own = { text: 'Legal Services (Pueblo of Pojoaque Legal Aid Office)' };
		const groups = legalHelpFor('pueblo-of-pojoaque', sources, [own]);
		expect(groups.map((group) => group.label)).toEqual(['Legal aid', 'Legal information']);
		const [legalAid, information] = groups;
		expect(legalAid.items[0]).toBe(own);
		expect(legalAid.items[1]).toMatchObject({
			text: 'Native American Program, New Mexico Legal Aid',
			detail: 'Native legal aid',
			note: 'Serves this nation (Legal Services Corporation area NNM-4)'
		});
		expect(information.items[0]).toMatchObject({ detail: 'Legal information', note: 'For anyone in New Mexico' });
		expect(sources.list.map((entry) => entry.key)).toContain(
			legalHelpSourceKey('new-mexico-legal-aid-native-american-program', 'lsc-service-area-nnm-4')
		);
		for (const group of groups) for (const item of group.items.slice(group === legalAid ? 1 : 0)) expect(item).toHaveProperty('link');
	});

	it('says when a center is not open yet or is suspended', () => {
		const navajo = legalHelpFor('navajo-nation', new SourceUses((key) => key));
		expect(navajo.find((group) => group.label === 'Self-help')?.items[0]).toMatchObject({
			detail: 'Self-help center · Opening soon',
			note: 'Serves this nation'
		});
		const wilton = legalHelpFor('wilton-rancheria', new SourceUses((key) => key));
		expect(wilton.find((group) => group.label === 'Self-help')?.items[0]).toMatchObject({
			detail: 'Self-help center · Suspended',
			note: 'For members of the nation'
		});
	});

	it('leaves out records that wait to be classified', () => {
		const groups = legalHelpFor('poarch-band-of-creek-indians', new SourceUses((key) => key));
		const names = groups.flatMap((group) => group.items.map((item) => item.text));
		expect(names.some((name) => /Poarch Band/.test(name))).toBe(false);
	});

	it('cites a provider record’s source with its publisher, title and link', () => {
		const html = legalHelpCitation(legalHelpSourceKey('new-mexico-legal-aid-native-american-program', 'lsc-service-area-nnm-4'));
		expect(html).toContain('Legal Services Corporation, <cite>Service area NNM-4</cite>');
		expect(html).toContain('class="source-original" href="https://www.lsc.gov/');
		expect(legalHelpCitation('some-other-source')).toBeUndefined();
	});
});
