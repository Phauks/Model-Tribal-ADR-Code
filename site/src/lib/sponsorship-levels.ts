// The sponsorship levels and what each gives (docs/sponsorship.md, "Levels"),
// as Trevor approved them on Nov. 23, 2026 (project files,
// design/sponsorship-levels/). Shared by the Sponsorship levels page and the
// workspace Sponsors page, where the lead author sets each level's amount.

export const levels = ['friend', 'supporter', 'patron', 'benefactor'] as const;
export type Level = (typeof levels)[number];

export const levelNames: Record<Level, string> = {
	friend: 'Friend',
	supporter: 'Supporter',
	patron: 'Patron',
	benefactor: 'Benefactor'
};

/** Each level's amount a month, in cents, until the lead author sets another. */
export const defaultMonthlyCents: Record<Level, number> = {
	friend: 500,
	supporter: 2500,
	patron: 10000,
	benefactor: 50000
};

export type LevelAmounts = Record<Level, number>;

/** A year given at once costs ten months (Trevor, Nov. 23, 2026). */
export const monthsInAYear = 10;

export function yearlyCents(monthlyCents: number): number {
	return monthlyCents * monthsInAYear;
}

/**
 * The highest level a gift reaches: a monthly gift by its amount, a yearly
 * one by its amount over ten months. Below the first level, none.
 */
export function levelFor(amounts: LevelAmounts, cents: number, frequency: 'monthly' | 'yearly'): Level | null {
	const monthly = frequency === 'yearly' ? cents / monthsInAYear : cents;
	let reached: Level | null = null;
	for (const level of levels) if (monthly >= amounts[level]) reached = level;
	return reached;
}

/** Why a set of amounts cannot be saved, or null: each level must cost more than the one before it. */
export function levelAmountsProblem(amounts: LevelAmounts): string | null {
	for (let index = 1; index < levels.length; index++) {
		const level = levels[index];
		const before = levels[index - 1];
		if (amounts[level] <= amounts[before]) return `${levelNames[level]} must cost more a month than ${levelNames[before]}.`;
	}
	return null;
}

/** A column of the table: free for everyone, then each level. */
export type Column = 'free' | Level;
export const columns: readonly Column[] = ['free', ...levels];

export interface Benefit {
	text: string;
	/** The first column that has it; every column after has it too. */
	from: Column;
	/** Promised once it exists, such as CLE programs. */
	later?: true;
}

/** What everyone gets, sponsor or not. */
export const freeBenefits: Benefit[] = [
	{ text: 'Read every page, source and case', from: 'free' },
	{ text: 'Data sets as .csv and .xlsx', from: 'free' },
	{ text: 'Forms as .docx and PDF', from: 'free' },
	{ text: 'Save pages to read offline', from: 'free' },
	{ text: 'Star and follow pages', from: 'free' },
	{ text: 'Events and video meetings', from: 'free' }
];

/** What sponsors get. None gives a say in what the site or the code says. */
export const sponsorBenefits: Benefit[] = [
	{ text: 'Listed among sponsors, as you choose', from: 'friend' },
	{ text: 'Sponsor mark on your profile', from: 'friend' },
	{ text: 'Discount on CLE programs', from: 'friend', later: true },
	{ text: 'Your name in the next printed edition', from: 'supporter' },
	{ text: 'A paperback of each new edition', from: 'patron' },
	{ text: 'Listed first on the Sponsorship page', from: 'patron' },
	{ text: 'Your logo in the next printed edition', from: 'benefactor' },
	{ text: 'Your logo and one line about you, first on the Sponsorship page', from: 'benefactor' },
	{ text: 'Five hardcovers of each new edition', from: 'benefactor' },
	{ text: 'CLE programs free for five of your staff', from: 'benefactor', later: true },
	{ text: '10 paperbacks a year, sent to nations, courts or libraries you choose', from: 'benefactor' }
];

/** Whether a column has a benefit. */
export function includes(benefit: Benefit, column: Column): boolean {
	return columns.indexOf(column) >= columns.indexOf(benefit.from);
}
