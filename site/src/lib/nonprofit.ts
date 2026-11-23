/**
 * The nonprofit corporation's record and what it owes, worked out from the
 * facts the lead author enters (migrations/20261123T0440_add_nonprofit_records.sql). Trevor chose a
 * Nevada nonprofit corporation (Nev. Rev. Stat. ch. 82) applying for 501(c)(3)
 * status on Form 1023-EZ on Nov. 23, 2026, and asked for its renewal dates and
 * to-dos in the workspace.
 *
 * Dates are calendar days written YYYY-MM-DD and compared as text. Every rule
 * below cites the source it was read from on Nov. 23, 2026.
 */

export const factNames = [
	'legalName',
	'nevadaBusinessNumber',
	'employerIdentificationNumber',
	'incorporatedOn',
	'fiscalYearEndMonth',
	'registeredAgent',
	'mailingAddress',
	'directors',
	'applicationFiledOn',
	'determinationLetterOn',
	'exemptionEffectiveOn',
	'notes'
] as const;
export type FactName = (typeof factNames)[number];
export type Facts = Partial<Record<FactName, string>>;

export interface FactField {
	name: FactName;
	label: string;
	kind: 'text' | 'date' | 'month' | 'lines';
	hint?: string;
}

export const factFields: readonly FactField[] = [
	{ name: 'legalName', label: 'Legal name', kind: 'text', hint: 'Exactly as in the articles of incorporation.' },
	{ name: 'nevadaBusinessNumber', label: 'Nevada business number', kind: 'text', hint: 'The NV number the Secretary of State gives the corporation.' },
	{ name: 'employerIdentificationNumber', label: 'Employer Identification Number (EIN)', kind: 'text', hint: 'Nine digits, such as 12-3456789.' },
	{ name: 'incorporatedOn', label: 'Date of incorporation', kind: 'date', hint: 'The filing date of the articles. Due dates are worked out from it.' },
	{ name: 'fiscalYearEndMonth', label: 'Last month of the fiscal year', kind: 'month', hint: 'December unless the bylaws say otherwise.' },
	{ name: 'registeredAgent', label: 'Registered agent', kind: 'text', hint: 'Name and Nevada street address.' },
	{ name: 'mailingAddress', label: 'Mailing address', kind: 'text' },
	{ name: 'directors', label: 'Directors and officers', kind: 'lines', hint: 'One per line, such as "Name, president". Note the date each consent to serve was signed.' },
	{ name: 'applicationFiledOn', label: 'Form 1023-EZ filed on', kind: 'date' },
	{ name: 'determinationLetterOn', label: 'Determination letter dated', kind: 'date' },
	{ name: 'exemptionEffectiveOn', label: 'Exemption effective from', kind: 'date', hint: 'Usually the date of incorporation, if the form was filed within 27 months.' },
	{ name: 'notes', label: 'Notes', kind: 'lines' }
];

export const monthNames = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
] as const;

const isoDay = /^\d{4}-\d{2}-\d{2}$/;

/** Whether the text is a real calendar day written YYYY-MM-DD. */
export function isDay(value: string | undefined | null): value is string {
	if (!value || !isoDay.test(value)) return false;
	const [year, month, day] = value.split('-').map(Number);
	return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/** Cleans a submitted fact; undefined means it is not valid. An empty value clears the fact. */
export function cleanFact(name: FactName, value: string): string | undefined {
	const text = value.trim();
	if (text === '') return '';
	const field = factFields.find((item) => item.name === name);
	if (!field) return undefined;
	if (field.kind === 'date') return isDay(text) ? text : undefined;
	if (field.kind === 'month') {
		const month = Number(text);
		return Number.isInteger(month) && month >= 1 && month <= 12 ? String(month) : undefined;
	}
	if (name === 'employerIdentificationNumber') {
		const digits = text.replace(/\D/g, '');
		return digits.length === 9 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : undefined;
	}
	return text.length <= 4000 ? text : undefined;
}

function daysInMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad(value: number): string {
	return String(value).padStart(2, '0');
}

/** The last day of a month; month may run past 12, which carries into later years. */
export function lastDayOf(year: number, month: number): string {
	const carriedYear = year + Math.floor((month - 1) / 12);
	const carriedMonth = ((month - 1) % 12) + 1;
	return `${carriedYear}-${pad(carriedMonth)}-${pad(daysInMonth(carriedYear, carriedMonth))}`;
}

/** The same calendar day a number of days later (or earlier, when negative). */
export function addDays(day: string, days: number): string {
	const date = new Date(`${day}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

/** The same day one year later; February 29 becomes February 28. */
export function nextYear(day: string): string {
	const [year, month, date] = day.split('-').map(Number);
	return `${year + 1}-${pad(month)}-${pad(Math.min(date, daysInMonth(year + 1, month)))}`;
}

/** Whole days from one day to another. */
export function daysBetween(from: string, to: string): number {
	return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function longDay(day: string): string {
	const [year, month, date] = day.split('-').map(Number);
	return `${monthNames[month - 1]} ${date}, ${year}`;
}

export type Stage = 'planning' | 'incorporated' | 'applied' | 'recognized';

export const stageLabels: Record<Stage, string> = {
	planning: 'Planning: not incorporated yet',
	incorporated: 'Incorporated in Nevada; 501(c)(3) application not filed',
	applied: 'Form 1023-EZ filed; waiting for the IRS',
	recognized: 'Recognized as a 501(c)(3) public charity'
};

export function stageOf(facts: Facts): Stage {
	if (isDay(facts.determinationLetterOn)) return 'recognized';
	if (isDay(facts.applicationFiledOn)) return 'applied';
	if (isDay(facts.incorporatedOn)) return 'incorporated';
	return 'planning';
}

export interface Authority {
	label: string;
	link?: string;
}

export interface Completion {
	obligation: string;
	period: string;
	doneOn: string;
	reference: string | null;
	note: string | null;
	recordedByName: string | null;
}

export type DueState = 'done' | 'overdue' | 'due-soon' | 'upcoming';

export const dueStateLabels: Record<DueState, string> = {
	done: 'Done',
	overdue: 'Overdue',
	'due-soon': 'Due soon',
	upcoming: 'Upcoming'
};

/** Due within this many days counts as due soon, here and on the workspace overview. */
export const dueSoonDays = 60;

export interface Occurrence {
	obligation: string;
	title: string;
	/** What this one covers, such as "Fiscal year ending December 31, 2027". */
	periodLabel: string;
	period: string;
	due: string;
	fee: string;
	what: string;
	authority: Authority[];
	state: DueState;
	completion: Completion | null;
}

const nevadaStatutes = 'https://www.leg.state.nv.us/NRS/NRS-082.html';
const nevadaCharityStatutes = 'https://www.leg.state.nv.us/nrs/NRS-082A.html';
const corporationStatutes = 'https://www.leg.state.nv.us/NRS/NRS-078.html';
const ezInstructions = 'https://www.irs.gov/pub/irs-pdf/i1023ez.pdf';
const postcardPage =
	'https://www.irs.gov/charities-non-profits/annual-electronic-filing-requirement-for-small-exempt-organizations-form-990-n-e-postcard';
const fullInstructions = 'https://www.irs.gov/pub/irs-pdf/i1023.pdf';
const userFees = 'https://www.irs.gov/irb/2026-01_IRB';

interface Rule {
	obligation: string;
	title: string;
	fee: string;
	what: string;
	authority: Authority[];
	/** Every occurrence from incorporation on, oldest first, up to the first one due on or after `until`. */
	occurrences(facts: Facts, incorporatedOn: string, until: string): { period: string; periodLabel: string; due: string }[];
	/** Counts as done without a completion, from the facts. */
	doneByFact?(facts: Facts): string | undefined;
}

function fiscalYearEnds(facts: Facts, incorporatedOn: string, until: string): string[] {
	const endMonth = Number(facts.fiscalYearEndMonth) || 12;
	const [year, month] = incorporatedOn.split('-').map(Number);
	let endYear = month <= endMonth ? year : year + 1;
	const ends: string[] = [];
	for (;;) {
		const end = lastDayOf(endYear, endMonth);
		ends.push(end);
		if (end >= until || ends.length > 200) return ends;
		endYear += 1;
	}
}

export const rules: readonly Rule[] = [
	{
		obligation: 'nevada-annual-list',
		title: 'Nevada annual list and charitable registration',
		fee: '$50',
		what:
			'File the annual list of officers and directors with the Nevada Secretary of State by the last day of the month in which the corporation was formed, with the charitable solicitation registration and financial report, and claim the state business license exclusion. Late: $50 penalty; default can end in revocation and a $100 reinstatement fee.',
		authority: [
			{ label: 'Nev. Rev. Stat. § 82.193(3)', link: nevadaStatutes },
			{ label: 'Nev. Rev. Stat. § 78.150', link: corporationStatutes },
			{ label: 'Nev. Rev. Stat. § 82A.100(3)(a)', link: nevadaCharityStatutes }
		],
		occurrences(_facts, incorporatedOn, until) {
			const [year, month] = incorporatedOn.split('-').map(Number);
			const list = [];
			for (let next = year + 1; list.length < 200; next += 1) {
				const due = lastDayOf(next, month);
				list.push({ period: due, periodLabel: `Year ending ${longDay(due)}`, due });
				if (due >= until) break;
			}
			return list;
		}
	},
	{
		obligation: 'form-990-n',
		title: 'IRS Form 990-N (e-Postcard)',
		fee: 'No fee',
		what:
			'File the e-Postcard online by the 15th day of the 5th month after the fiscal year ends, while gross receipts are normally $50,000 or less (otherwise Form 990-EZ or 990). It cannot be filed before the year ends. Three years in a row without it ends the exemption automatically.',
		authority: [
			{ label: 'IRS, Form 990-N page', link: postcardPage },
			{ label: 'Instructions for Form 1023-EZ 2', link: ezInstructions }
		],
		occurrences(facts, incorporatedOn, until) {
			const endMonth = Number(facts.fiscalYearEndMonth) || 12;
			// The due date is about four and a half months after the year ends, so
			// years ending a little after `until` can still be due before it.
			return fiscalYearEnds(facts, incorporatedOn, addDays(until, 200))
				.map((end) => {
					const [year] = end.split('-').map(Number);
					const dueMonth = endMonth + 5;
					const due = `${year + Math.floor((dueMonth - 1) / 12)}-${pad(((dueMonth - 1) % 12) + 1)}-15`;
					return { period: end, periodLabel: `Fiscal year ending ${longDay(end)}`, due };
				})
				.filter((item, index, all) => index === 0 || all[index - 1].due < until);
		}
	},
	{
		obligation: 'form-1023-ez',
		title: 'File Form 1023-EZ (27-month deadline)',
		fee: '$275 user fee, paid on Pay.gov',
		what:
			'Filed within 27 months after the end of the month of incorporation, an approved exemption runs from the date of incorporation; filed later, only from the filing date. Keep the eligibility worksheet with the records.',
		authority: [
			{ label: 'Instructions for Form 1023-EZ 2', link: ezInstructions },
			{ label: 'Rev. Proc. 2026-5, 2026-1 I.R.B. 258, app. A', link: userFees }
		],
		occurrences(_facts, incorporatedOn) {
			const [year, month] = incorporatedOn.split('-').map(Number);
			const due = lastDayOf(year, month + 27);
			return [{ period: 'once', periodLabel: 'Once', due }];
		},
		doneByFact: (facts) => (isDay(facts.applicationFiledOn) ? facts.applicationFiledOn : undefined)
	},
	{
		obligation: 'conflict-statements',
		title: 'Directors’ yearly conflict-of-interest statements',
		fee: 'No fee',
		what:
			'Each director signs the yearly statement under the conflict-of-interest policy (the IRS sample policy, article VI), and the secretary files them with the minutes. Due here at the end of each fiscal year.',
		authority: [{ label: 'Instructions for Form 1023 app. A', link: fullInstructions }],
		occurrences(facts, incorporatedOn, until) {
			return fiscalYearEnds(facts, incorporatedOn, until).map((end) => ({
				period: end,
				periodLabel: `Fiscal year ending ${longDay(end)}`,
				due: end
			}));
		}
	}
];

function stateOf(due: string, done: boolean, today: string): DueState {
	if (done) return 'done';
	if (due < today) return 'overdue';
	return daysBetween(today, due) <= dueSoonDays ? 'due-soon' : 'upcoming';
}

/**
 * What the corporation owes, worked out from its facts: for each obligation,
 * every past occurrence not yet done, the latest one done, and the next one
 * coming. Empty until the date of incorporation is entered.
 */
export function occurrencesFor(facts: Facts, completions: readonly Completion[], today: string): Occurrence[] {
	const incorporatedOn = facts.incorporatedOn;
	if (!isDay(incorporatedOn)) return [];
	const found: Occurrence[] = [];
	for (const rule of rules) {
		const all = rule.occurrences(facts, incorporatedOn, today).map((item) => {
			const completion =
				completions.find((entry) => entry.obligation === rule.obligation && entry.period === item.period) ?? null;
			const byFact = rule.doneByFact?.(facts);
			const filled: Completion | null =
				completion ??
				(byFact
					? { obligation: rule.obligation, period: item.period, doneOn: byFact, reference: null, note: 'From the facts above.', recordedByName: null }
					: null);
			return {
				obligation: rule.obligation,
				title: rule.title,
				periodLabel: item.periodLabel,
				period: item.period,
				due: item.due,
				fee: rule.fee,
				what: rule.what,
				authority: rule.authority,
				completion: filled,
				state: stateOf(item.due, filled !== null, today)
			};
		});
		const latestDone = all.filter((item) => item.state === 'done').at(-1);
		const next = all.find((item) => item.state !== 'done' && item.due >= today);
		for (const item of all) {
			if (item.state === 'overdue' || item === latestDone || item === next) found.push(item);
		}
	}
	return found.sort((first, second) => first.due.localeCompare(second.due));
}

export interface SetupStep {
	key: string;
	title: string;
	what: string;
	fee?: string;
	authority: Authority[];
}

/** The one-time steps, in order, from the brief "Becoming a 501(c)(3) with Form 1023-EZ" (Nov. 23, 2026). */
export const setupSteps: readonly SetupStep[] = [
	{
		key: 'setup-board-consents',
		title: 'Signed consent to serve from each director',
		what: 'The initial list names every director, so each must agree before filing.',
		authority: [{ label: 'Nev. Rev. Stat. § 78.150(1)(c)', link: corporationStatutes }]
	},
	{
		key: 'setup-ownership',
		title: 'Decide who owns the book, code and data',
		what: 'Assignment, exclusive license or non-exclusive license to the corporation, approved by the directors other than the author.',
		authority: []
	},
	{
		key: 'setup-documents',
		title: 'Draft articles, bylaws and conflict-of-interest policy',
		what: 'Articles limit purposes to 501(c)(3) purposes and name a 501(c)(3) for assets on dissolution; have a Nevada attorney review them.',
		authority: [
			{ label: '26 C.F.R. § 1.501(c)(3)-1(b)' },
			{ label: 'Instructions for Form 1023 app. A', link: fullInstructions }
		]
	},
	{
		key: 'setup-articles',
		title: 'File articles and the initial list with the Nevada Secretary of State',
		what: 'Articles of incorporation for a nonprofit corporation, with the initial list of officers and directors at the same time, the registered agent, and the charitable solicitation information.',
		fee: '$50 + $50',
		authority: [
			{ label: 'Nev. Rev. Stat. §§ 82.531(1), 82.193(3)', link: nevadaStatutes },
			{ label: 'Nev. Rev. Stat. § 78.150(1)', link: corporationStatutes }
		]
	},
	{
		key: 'setup-employer-number',
		title: 'Get the Employer Identification Number (EIN)',
		what: 'Free from the IRS online; issued at once.',
		fee: 'No fee',
		authority: [{ label: 'IRS, Get an EIN', link: 'https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number' }]
	},
	{
		key: 'setup-organizing-meeting',
		title: 'Hold the organizing board meeting',
		what: 'Adopt the bylaws and policies, elect officers, approve the bank account and any transfer of rights, and record minutes.',
		authority: []
	},
	{
		key: 'setup-bank',
		title: 'Open the bank and Stripe accounts in the corporation’s name',
		what: 'Never in a personal name. Name two signers, or have the treasurer review payments.',
		authority: []
	},
	{
		key: 'setup-application',
		title: 'Complete the eligibility worksheet and file Form 1023-EZ',
		what: 'Projected gross receipts $50,000 or less in each of the next three years and assets $250,000 or less; keep the worksheet.',
		fee: '$275',
		authority: [
			{ label: 'Instructions for Form 1023-EZ 13–16', link: ezInstructions },
			{ label: 'Rev. Proc. 2026-5 app. A', link: userFees }
		]
	},
	{
		key: 'setup-donations',
		title: 'Turn on donations with the Nevada disclosure',
		what: 'Legal name, address or website, purpose, and whether gifts may be deductible, on every request for money; say exemption is pending until the letter arrives.',
		authority: [{ label: 'Nev. Rev. Stat. § 82A.200(1)', link: nevadaCharityStatutes }]
	},
	{
		key: 'setup-determination',
		title: 'Receive and keep the determination letter',
		what: 'Post it, update the Donate page, and ask Stripe for its nonprofit rate.',
		authority: []
	}
];

/** Setup steps that count as done from the facts alone. */
export function setupDoneByFact(facts: Facts): Partial<Record<string, string>> {
	return {
		...(isDay(facts.incorporatedOn) ? { 'setup-articles': facts.incorporatedOn } : {}),
		...(facts.employerIdentificationNumber ? { 'setup-employer-number': 'entered' } : {}),
		...(isDay(facts.applicationFiledOn) ? { 'setup-application': facts.applicationFiledOn } : {}),
		...(isDay(facts.determinationLetterOn) ? { 'setup-determination': facts.determinationLetterOn } : {})
	};
}

export interface Task {
	identifier: string;
	title: string;
	notes: string | null;
	dueOn: string | null;
	repeatsYearly: boolean;
	doneOn: string | null;
}

export function taskState(task: Task, today: string): DueState | 'no-date' {
	if (task.doneOn) return 'done';
	if (!task.dueOn) return 'no-date';
	return stateOf(task.dueOn, false, today);
}

/** What needs attention on the workspace overview: overdue, then due within dueSoonDays. */
export function needingAttention(
	occurrences: readonly Occurrence[],
	tasks: readonly Task[],
	today: string
): { title: string; due: string; state: 'overdue' | 'due-soon' }[] {
	const items = [
		...occurrences.map((item) => ({ title: `${item.title} (${item.periodLabel.toLocaleLowerCase('en-US')})`, due: item.due, state: item.state })),
		...tasks.flatMap((task) => (task.dueOn ? [{ title: task.title, due: task.dueOn, state: taskState(task, today) }] : []))
	];
	return items
		.filter((item): item is { title: string; due: string; state: 'overdue' | 'due-soon' } => item.state === 'overdue' || item.state === 'due-soon')
		.sort((first, second) => first.due.localeCompare(second.due));
}

function calendarText(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Folds a line at 75 octets, as calendar files require (RFC 5545, section 3.1). */
function fold(line: string): string {
	const bytes = new TextEncoder().encode(line);
	if (bytes.length <= 75) return line;
	const parts: string[] = [];
	let current = '';
	for (const character of line) {
		if (new TextEncoder().encode(current + character).length > (parts.length === 0 ? 75 : 74)) {
			parts.push(current);
			current = character;
		} else {
			current += character;
		}
	}
	parts.push(current);
	return parts.join('\r\n ');
}

/**
 * A calendar file (RFC 5545) with each open due date as an all-day event and
 * reminders 30 and 7 days before, so the dates can live in a phone's calendar.
 */
export function calendarFile(
	occurrences: readonly Occurrence[],
	tasks: readonly Task[],
	stampedAt: Date,
	siteAddress: string
): string {
	const stamp = stampedAt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
	const host = new URL(siteAddress).host;
	const events = [
		...occurrences
			.filter((item) => item.state !== 'done')
			.map((item) => ({
				uid: `${item.obligation}-${item.period}@${host}`,
				due: item.due,
				summary: item.title,
				description: `${item.periodLabel}. ${item.what} Fee: ${item.fee}. Sources: ${item.authority.map((entry) => entry.label).join('; ')}.`
			})),
		...tasks
			.filter((task) => !task.doneOn && task.dueOn)
			.map((task) => ({
				uid: `task-${task.identifier}-${task.dueOn}@${host}`,
				due: task.dueOn as string,
				summary: task.title,
				description: task.notes ?? ''
			}))
	];
	const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Model Tribal ADR Code//Nonprofit due dates//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Nonprofit due dates'];
	for (const event of events) {
		const start = event.due.replace(/-/g, '');
		const end = addDays(event.due, 1).replace(/-/g, '');
		lines.push(
			'BEGIN:VEVENT',
			`UID:${event.uid}`,
			`DTSTAMP:${stamp}`,
			`DTSTART;VALUE=DATE:${start}`,
			`DTEND;VALUE=DATE:${end}`,
			`SUMMARY:${calendarText(`Due: ${event.summary}`)}`,
			`DESCRIPTION:${calendarText(event.description)}`,
			`URL:${siteAddress.replace(/\/$/, '')}/workspace/nonprofit`,
			'BEGIN:VALARM',
			'ACTION:DISPLAY',
			`DESCRIPTION:${calendarText(`${event.summary} is due in 30 days`)}`,
			'TRIGGER:-P30D',
			'END:VALARM',
			'BEGIN:VALARM',
			'ACTION:DISPLAY',
			`DESCRIPTION:${calendarText(`${event.summary} is due in 7 days`)}`,
			'TRIGGER:-P7D',
			'END:VALARM',
			'END:VEVENT'
		);
	}
	lines.push('END:VCALENDAR');
	return `${lines.map(fold).join('\r\n')}\r\n`;
}

/** Today's date in Nevada (Pacific time), where the corporation's deadlines fall. */
export function nevadaToday(now: Date = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
