import { describe, expect, it } from 'vitest';
import {
	calendarFile,
	cleanFact,
	lastDayOf,
	needingAttention,
	nevadaToday,
	nextYear,
	occurrencesFor,
	setupDoneByFact,
	stageOf,
	type Completion
} from '../src/lib/nonprofit.ts';
import { addTask, finishTask, readCompletions, readFacts, readTasks, recordCompletion, saveFacts, undoCompletion } from '../src/lib/server/nonprofit.ts';
import { testDatabase } from './database.ts';

const done = (obligation: string, period: string, doneOn: string): Completion => ({
	obligation,
	period,
	doneOn,
	reference: null,
	note: null,
	recordedByName: 'Lead'
});

describe('dates', () => {
	it('finds the last day of a month, carrying past December', () => {
		expect(lastDayOf(2027, 2)).toBe('2027-02-28');
		expect(lastDayOf(2028, 2)).toBe('2028-02-29');
		expect(lastDayOf(2027, 1 + 27)).toBe('2029-04-30');
	});

	it('moves a day on a year, February 29 to February 28', () => {
		expect(nextYear('2028-02-29')).toBe('2029-02-28');
		expect(nextYear('2027-06-15')).toBe('2028-06-15');
	});

	it('gives today in Nevada, not in UTC', () => {
		expect(nevadaToday(new Date('2026-11-23T04:16:00Z'))).toBe('2026-11-22');
	});

	it('cleans facts and refuses ones that are not valid', () => {
		expect(cleanFact('incorporatedOn', '2027-02-30')).toBeUndefined();
		expect(cleanFact('incorporatedOn', '2027-01-15')).toBe('2027-01-15');
		expect(cleanFact('employerIdentificationNumber', '123456789')).toBe('12-3456789');
		expect(cleanFact('employerIdentificationNumber', '1234')).toBeUndefined();
		expect(cleanFact('fiscalYearEndMonth', '13')).toBeUndefined();
		expect(cleanFact('legalName', '  ')).toBe('');
	});
});

describe('what is due', () => {
	it('has nothing due before incorporation', () => {
		expect(occurrencesFor({}, [], '2026-11-22')).toEqual([]);
		expect(stageOf({})).toBe('planning');
	});

	it('works out the first year after incorporating on January 15, 2027', () => {
		const items = occurrencesFor({ incorporatedOn: '2027-01-15' }, [], '2027-02-01');
		const byObligation = Object.fromEntries(items.map((item) => [item.obligation, item]));
		// Annual list: the last day of the anniversary month (Nev. Rev. Stat. § 78.150, via § 82.193).
		expect(byObligation['nevada-annual-list'].due).toBe('2028-01-31');
		// Form 990-N for the year ending Dec. 31, 2027: May 15, 2028.
		expect(byObligation['form-990-n'].due).toBe('2028-05-15');
		expect(byObligation['form-990-n'].periodLabel).toBe('Fiscal year ending December 31, 2027');
		// Form 1023-EZ: 27 months after the end of January 2027.
		expect(byObligation['form-1023-ez'].due).toBe('2029-04-30');
		expect(byObligation['conflict-statements'].due).toBe('2027-12-31');
		expect(items.every((item) => item.state === 'upcoming')).toBe(true);
		expect(stageOf({ incorporatedOn: '2027-01-15' })).toBe('incorporated');
	});

	it('uses the fiscal year the bylaws choose', () => {
		const items = occurrencesFor({ incorporatedOn: '2027-01-15', fiscalYearEndMonth: '6' }, [], '2027-02-01');
		const postcard = items.find((item) => item.obligation === 'form-990-n');
		expect(postcard?.period).toBe('2027-06-30');
		expect(postcard?.due).toBe('2027-11-15');
	});

	it('shows a missed filing as overdue and keeps showing the next one', () => {
		const items = occurrencesFor({ incorporatedOn: '2027-01-15' }, [], '2028-02-10');
		const lists = items.filter((item) => item.obligation === 'nevada-annual-list');
		expect(lists.map((item) => [item.due, item.state])).toEqual([
			['2028-01-31', 'overdue'],
			['2029-01-31', 'upcoming']
		]);
	});

	it('counts a recorded completion, keeps the latest one done, and marks the next as due soon', () => {
		const items = occurrencesFor({ incorporatedOn: '2027-01-15' }, [done('nevada-annual-list', '2028-01-31', '2028-01-20')], '2028-12-15');
		const lists = items.filter((item) => item.obligation === 'nevada-annual-list');
		expect(lists.map((item) => [item.due, item.state])).toEqual([
			['2028-01-31', 'done'],
			['2029-01-31', 'due-soon']
		]);
	});

	it('takes the Form 1023-EZ as done once its filing date is entered', () => {
		const facts = { incorporatedOn: '2027-01-15', applicationFiledOn: '2027-03-01' };
		const application = occurrencesFor(facts, [], '2027-04-01').find((item) => item.obligation === 'form-1023-ez');
		expect(application?.state).toBe('done');
		expect(application?.completion?.doneOn).toBe('2027-03-01');
		expect(stageOf(facts)).toBe('applied');
		expect(setupDoneByFact(facts)).toEqual({ 'setup-articles': '2027-01-15', 'setup-application': '2027-03-01' });
	});

	it('lists what needs attention, overdue first', () => {
		const items = occurrencesFor({ incorporatedOn: '2027-01-15' }, [], '2028-02-10');
		const attention = needingAttention(
			items,
			[{ identifier: 't', title: 'Renew the registered agent', notes: null, dueOn: '2028-03-01', repeatsYearly: true, doneOn: null }],
			'2028-02-10'
		);
		expect(attention.map((item) => item.state)).toEqual(['overdue', 'overdue', 'due-soon']);
		expect(attention.at(-1)?.title).toBe('Renew the registered agent');
	});
});

describe('calendar file', () => {
	it('has one all-day event per open due date with reminders, and lines no longer than 75 octets', () => {
		const items = occurrencesFor({ incorporatedOn: '2027-01-15' }, [], '2027-02-01');
		const file = calendarFile(items, [], new Date('2027-02-01T00:00:00Z'), 'https://example.org');
		expect(file.match(/BEGIN:VEVENT/g)).toHaveLength(4);
		expect(file).toContain('DTSTART;VALUE=DATE:20280131');
		expect(file).toContain('TRIGGER:-P30D');
		for (const line of file.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
	});
});

describe('stored record', () => {
	async function withLead() {
		const database = testDatabase();
		await database
			.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES ('lead', 'l@example.org', 'Lead', 'lead-author', 'active', '2026-11-22T00:00:00Z')`)
			.run();
		return database;
	}

	it('saves valid facts, refuses the whole form when one is not valid, and clears an emptied one', async () => {
		const database = await withLead();
		expect(await saveFacts(database, { legalName: 'Example Project', incorporatedOn: 'soon' }, 'lead')).toEqual({ ok: false, invalid: ['incorporatedOn'] });
		expect(await readFacts(database)).toEqual({});
		expect(await saveFacts(database, { legalName: 'Example Project', incorporatedOn: '2027-01-15' }, 'lead')).toEqual({ ok: true, changed: 2 });
		expect(await saveFacts(database, { legalName: '' }, 'lead')).toEqual({ ok: true, changed: 1 });
		expect(await readFacts(database)).toEqual({ incorporatedOn: '2027-01-15' });
	});

	it('records and undoes a completion', async () => {
		const database = await withLead();
		expect(await recordCompletion(database, { obligation: 'nevada-annual-list', period: '2028-01-31', doneOn: '2028-01-20', reference: 'NV-123', note: null }, 'lead')).toEqual({ ok: true });
		expect(await readCompletions(database)).toEqual([
			{ obligation: 'nevada-annual-list', period: '2028-01-31', doneOn: '2028-01-20', reference: 'NV-123', note: null, recordedByName: 'Lead' }
		]);
		expect((await recordCompletion(database, { obligation: 'x', period: 'sometime', doneOn: '2028-01-20', reference: null, note: null }, 'lead')).ok).toBe(false);
		await undoCompletion(database, 'nevada-annual-list', '2028-01-31');
		expect(await readCompletions(database)).toEqual([]);
	});

	it('moves a yearly to-do on a year when it is done, and closes a one-time to-do', async () => {
		const database = await withLead();
		expect((await addTask(database, { title: 'Renew agent', notes: null, dueOn: null, repeatsYearly: true }, 'lead')).ok).toBe(false);
		await addTask(database, { title: 'Renew agent', notes: null, dueOn: '2028-03-01', repeatsYearly: true }, 'lead');
		await addTask(database, { title: 'Order checks', notes: 'Two signers', dueOn: null, repeatsYearly: false }, 'lead');
		const [agent, checks] = await readTasks(database);
		await finishTask(database, agent.identifier, '2028-02-20', 'lead');
		await finishTask(database, checks.identifier, '2028-02-20', 'lead');
		const after = await readTasks(database);
		expect(after.find((task) => task.title === 'Renew agent')).toMatchObject({ dueOn: '2029-03-01', doneOn: null });
		expect(after.find((task) => task.title === 'Order checks')).toMatchObject({ doneOn: '2028-02-20' });
		expect((await readCompletions(database)).map((entry) => [entry.obligation, entry.period])).toEqual([[`task:${agent.identifier}`, '2028-03-01']]);
	});
});
