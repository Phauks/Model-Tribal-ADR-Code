import { expect, it } from 'vitest';
import { citationOnly, splitCaseName } from '../src/lib/essays/case-headings.ts';
it('shows a case or law box\'s citation without the links after it, with the case name apart', () => {
	const t = citationOnly('Worcester v. Georgia, 31 U.S. 515 (1832). www.law.cornell.edu Read it at Library of Congress, CourtListener.');
	expect(t).toBe('Worcester v. Georgia, 31 U.S. 515 (1832).');
	expect(splitCaseName(t)).toEqual(['Worcester v. Georgia', ', 31 U.S. 515 (1832).']);
	expect(citationOnly('Indian Civil Rights Act of 1968, 25 U.S.C. §§ 1301–1304.')).toBe('Indian Civil Rights Act of 1968, 25 U.S.C. §§ 1301–1304.');
});
