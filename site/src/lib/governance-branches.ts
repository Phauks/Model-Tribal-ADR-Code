/**
 * The branches of a nation's government, one line each, from the few words
 * a governing document's reading records, such as "Legislative, executive
 * and judicial" or "Tribal Council (executive and legislative), Tribal
 * Judiciary (judicial)" (Trevor, Nov. 27, 2026: "we should delineate
 * better than that"). Each line names a branch or the body that holds it;
 * the powers a body holds, when the words give them, go under it. Words
 * that are not a plain list, such as "Judicial branch, separate from the
 * Council and Chairman", stay as one line.
 */
export interface BranchLine {
	/** The branch or body, such as "Legislative" or "Tribal Council". */
	text: string;
	/** The powers the body holds, such as "Executive and legislative". */
	powers?: string;
}

const powerWords = /^(legislative|executive|judicial|judiciary)$/i;

/** Words that make the value a sentence rather than a list of branches. */
const notAList = /separate|holds|others|;|\d/i;

function capitalize(text: string): string {
	return text.charAt(0).toLocaleUpperCase('en-US') + text.slice(1);
}

/** The parts of a list: "A, B and C", "A/B and C". */
function listParts(value: string): string[] {
	return value
		.split(/\s*,\s*|\s+and\s+|\s*\/\s*/)
		.map((part) => part.trim())
		.filter(Boolean);
}

export function branchLines(value: string): BranchLine[] {
	const whole = [{ text: value }];
	if (notAList.test(value)) return whole;
	if (value.includes('(')) {
		// "Body (powers), Body (powers)" or "power (Body), power (Body)".
		const parts = value.split(/\)\s*,\s*/).map((part) => part.replace(/\)\s*$/, ''));
		const lines: BranchLine[] = [];
		for (const part of parts) {
			const match = /^([^()]+?)\s*\(([^()]+)$/.exec(part.trim());
			if (!match) return whole;
			const [, outside, inside] = match;
			const [body, powers] = powerWords.test(outside.trim()) ? [inside, outside] : [outside, inside];
			lines.push({ text: capitalize(body.trim()), powers: capitalize(powers.trim().toLocaleLowerCase('en-US')) });
		}
		return lines.length > 1 ? lines : whole;
	}
	const parts = listParts(value).map((part) => part.replace(/\s+(branches|departments)$/i, ''));
	return parts.length > 1 ? parts.map((part) => ({ text: capitalize(part) })) : whole;
}
