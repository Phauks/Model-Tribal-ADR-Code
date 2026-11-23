// Folders, tags and auto-sort rules in the project inbox (site/MAIL.md,
// "Folders, tags and rules").
import { describe, expect, it } from 'vitest';
import { conditionHolds, describeCondition, ruleMatches, type RuleFacts } from '#lib/mail.ts';
import { receiveMail } from '#lib/server/mail/inbound.ts';
import { applyRuleToInbox, cleanRule, listRules, moveRule, previewRule, RuleError, saveRule, setRuleEnabled, type RuleInput } from '#lib/server/mail/rules.ts';
import {
	changeMany,
	createFolder,
	createTag,
	deleteFolder,
	deleteTag,
	getThread,
	listFolders,
	listThreads,
	listTags,
	moveToFolder,
	OrganizeError,
	renameFolder,
	setTag,
	updateTag
} from '#lib/server/mail/store.ts';
import { rawMessage, testContext } from './mail-fixtures.ts';

const clock = { now: new Date('2026-11-24T17:00:00Z') };
const encoder = new TextEncoder();

function letter(from: string, subject: string, body = 'Hello', to = 'contact@example.org') {
	return { from, to, raw: encoder.encode(rawMessage({ From: from, To: to, Subject: subject }, body)) };
}

async function filed(context: Awaited<ReturnType<typeof testContext>>, from: string, subject: string, body = 'Hello') {
	const result = await receiveMail(context, letter(from, subject, body));
	if (result.outcome !== 'filed') throw new Error('not filed');
	return result;
}

const facts: RuleFacts = {
	from: 'Tribal Office <office@navajo-nsn.gov>',
	to: ['contact@example.org'],
	subject: 'Correction to our page',
	body: 'Please remove the old chairman’s name.',
	attachment: false,
	nation: true,
	automatic: false
};

function rule(overrides: Partial<RuleInput> = {}): RuleInput {
	return {
		name: 'Navajo Nation mail',
		enabled: true,
		matchAll: true,
		conditions: [{ field: 'from', operator: 'ends-with', value: '@navajo-nsn.gov>' }],
		actions: [{ action: 'tag', value: 'tag-correction' }],
		stopAfter: false,
		...overrides
	};
}

describe('rule conditions', () => {
	it('match words without regard to capital letters', () => {
		expect(conditionHolds({ field: 'from', operator: 'contains', value: 'NAVAJO-NSN.GOV' }, facts)).toBe(true);
		expect(conditionHolds({ field: 'subject', operator: 'starts-with', value: 'correction' }, facts)).toBe(true);
		expect(conditionHolds({ field: 'subject', operator: 'is', value: 'correction' }, facts)).toBe(false);
		expect(conditionHolds({ field: 'body', operator: 'not-contains', value: 'remove' }, facts)).toBe(false);
		expect(conditionHolds({ field: 'anywhere', operator: 'contains', value: 'chairman' }, facts)).toBe(true);
		expect(conditionHolds({ field: 'to', operator: 'contains', value: 'requests@' }, facts)).toBe(false);
	});

	it('read yes-or-no fields', () => {
		expect(conditionHolds({ field: 'nation', operator: 'is', value: 'yes' }, facts)).toBe(true);
		expect(conditionHolds({ field: 'attachment', operator: 'is', value: 'yes' }, facts)).toBe(false);
		expect(conditionHolds({ field: 'automatic', operator: 'is', value: 'no' }, facts)).toBe(true);
	});

	it('need all or any, and never match with no conditions', () => {
		const both = [
			{ field: 'from', operator: 'contains', value: 'navajo' },
			{ field: 'subject', operator: 'contains', value: 'invoice' }
		] as const;
		expect(ruleMatches({ matchAll: true, conditions: [...both] }, facts)).toBe(false);
		expect(ruleMatches({ matchAll: false, conditions: [...both] }, facts)).toBe(true);
		expect(ruleMatches({ matchAll: true, conditions: [] }, facts)).toBe(false);
	});

	it('read as words on the rules page', () => {
		expect(describeCondition({ field: 'from', operator: 'ends-with', value: '@navajo-nsn.gov' })).toBe('Sender ends with “@navajo-nsn.gov”');
		expect(describeCondition({ field: 'attachment', operator: 'is', value: 'yes' })).toBe('Has an attachment');
	});
});

describe('checking a rule before it is saved', () => {
	it('drops empty rows and refuses a rule that does nothing', () => {
		const cleaned = cleanRule(
			rule({
				conditions: [
					{ field: 'subject', operator: 'contains', value: '  ' },
					{ field: 'from', operator: 'contains', value: ' @nation.example ' }
				],
				actions: [
					{ action: 'tag', value: '' },
					{ action: 'read', value: 'ignored' }
				]
			})
		);
		expect(cleaned.conditions).toEqual([{ field: 'from', operator: 'contains', value: '@nation.example' }]);
		expect(cleaned.actions).toEqual([{ action: 'read', value: '' }]);
		expect(() => cleanRule(rule({ conditions: [] }))).toThrow(RuleError);
		expect(() => cleanRule(rule({ actions: [] }))).toThrow(RuleError);
		expect(() => cleanRule(rule({ name: ' ' }))).toThrow(RuleError);
		expect(() =>
			cleanRule(
				rule({
					actions: [
						{ action: 'move', value: 'archive' },
						{ action: 'move', value: 'trash' }
					]
				})
			)
		).toThrow(/one place/);
	});

	it('refuses a folder or tag that does not exist', async () => {
		const context = await testContext(clock);
		await expect(saveRule(context, 'lead', rule({ actions: [{ action: 'move', value: 'no-such-folder' }] }), null)).rejects.toThrow(/folder/);
		await expect(saveRule(context, 'lead', rule({ actions: [{ action: 'tag', value: 'no-such-tag' }] }), null)).rejects.toThrow(/tag/);
	});
});

describe('folders and tags', () => {
	it('nest folders three deep and refuse a fourth level and a clashing name', async () => {
		const context = await testContext(clock);
		const nations = await createFolder(context, 'lead', 'Nations', null);
		const southwest = await createFolder(context, 'lead', 'Southwest', nations);
		const navajo = await createFolder(context, 'lead', 'Navajo Nation', southwest);
		await expect(createFolder(context, 'lead', 'Too deep', navajo)).rejects.toThrow(OrganizeError);
		await expect(createFolder(context, 'lead', 'nations', null)).rejects.toThrow(/already/);
		await createFolder(context, 'lead', 'Advisors', null);
		const tree = await listFolders(context);
		expect(tree.map((folder) => [folder.path, folder.depth])).toEqual([
			['Advisors', 0],
			['Nations', 0],
			['Nations / Southwest', 1],
			['Nations / Southwest / Navajo Nation', 2]
		]);
		await renameFolder(context, 'lead', navajo, 'Diné');
		expect((await listFolders(context)).at(-1)!.path).toBe('Nations / Southwest / Diné');
	});

	it('file a conversation in a folder, list it there, and send it back to the inbox when the folder is deleted', async () => {
		const context = await testContext(clock);
		const nations = await createFolder(context, 'lead', 'Nations', null);
		const navajo = await createFolder(context, 'lead', 'Navajo Nation', nations);
		const mail = await filed(context, 'office@navajo-nsn.gov', 'Hello');
		expect(await moveToFolder(context, 'lead', mail.threadIdentifier, navajo)).toBe(true);
		expect(await moveToFolder(context, 'lead', mail.threadIdentifier, 'not-a-folder')).toBe(false);
		expect((await listThreads(context, { view: 'inbox', personIdentifier: 'lead' })).threads).toHaveLength(0);
		const inFolder = await listThreads(context, { view: 'inbox', personIdentifier: 'lead', folder: navajo });
		expect(inFolder.threads.map((thread) => thread.folderIdentifier)).toEqual([navajo]);
		expect((await listFolders(context)).find((folder) => folder.identifier === navajo)!.unread).toBe(1);
		// Deleting the outer folder deletes the inner one too, and the mail goes back to the inbox.
		expect(await deleteFolder(context, 'lead', nations)).toBe(1);
		expect(await listFolders(context)).toEqual([]);
		expect((await getThread(context, mail.threadIdentifier, 'lead'))!).toMatchObject({ folder: 'inbox', folderIdentifier: null });
	});

	it('tag conversations, list a tag’s conversations, and rename or delete tags', async () => {
		const context = await testContext(clock);
		const tag = await createTag(context, 'lead', 'Navajo Nation', 'teal');
		await expect(createTag(context, 'lead', 'navajo nation', 'gold')).rejects.toThrow(/already/);
		const first = await filed(context, 'a@nation.example', 'First');
		const second = await filed(context, 'b@nation.example', 'Second');
		await setTag(context, 'lead', first.threadIdentifier, tag, true);
		await moveToFolder(context, 'lead', first.threadIdentifier, 'archive');
		const tagged = await listThreads(context, { view: 'inbox', personIdentifier: 'lead', tag });
		expect(tagged.threads.map((thread) => thread.identifier)).toEqual([first.threadIdentifier]);
		await updateTag(context, 'lead', tag, 'Diné', 'gold');
		expect((await listTags(context)).find((item) => item.identifier === tag)).toMatchObject({ name: 'Diné', color: 'gold' });
		await deleteTag(context, 'lead', tag);
		expect((await getThread(context, first.threadIdentifier, 'lead'))!.tags).toEqual([]);
		expect(second.threadIdentifier).not.toBe(first.threadIdentifier);
	});

	it('change several conversations at once', async () => {
		const context = await testContext(clock);
		const folder = await createFolder(context, 'lead', 'Advisors', null);
		const one = await filed(context, 'a@nation.example', 'One');
		const two = await filed(context, 'b@nation.example', 'Two');
		const threads = [one.threadIdentifier, two.threadIdentifier];
		expect(await changeMany(context, 'lead', threads, { kind: 'tag', tag: 'tag-advisors', on: true })).toBe(2);
		expect(await changeMany(context, 'lead', threads, { kind: 'read', read: true })).toBe(2);
		expect(await changeMany(context, 'lead', [...threads, 'missing'], { kind: 'move', place: folder })).toBe(2);
		const listed = await listThreads(context, { view: 'inbox', personIdentifier: 'lead', folder });
		expect(listed.threads.map((thread) => [thread.unread, thread.tags.map((tag) => tag.name)])).toEqual([
			[false, ['Advisors']],
			[false, ['Advisors']]
		]);
	});
});

describe('auto-sort rules', () => {
	it('file, tag, assign and mark read mail as it arrives, and leave other mail alone', async () => {
		const context = await testContext(clock);
		const folder = await createFolder(context, 'lead', 'Navajo Nation', null);
		await saveRule(
			context,
			'lead',
			rule({
				conditions: [{ field: 'from', operator: 'contains', value: '@navajo-nsn.gov' }],
				actions: [
					{ action: 'move', value: folder },
					{ action: 'tag', value: 'tag-correction' },
					{ action: 'assign', value: 'lead' },
					{ action: 'read', value: '' }
				]
			}),
			null
		);
		const sorted = await filed(context, 'office@navajo-nsn.gov', 'Our page');
		expect(sorted.sortedBy).toEqual(['Navajo Nation mail']);
		// Marked read and filed away, so no "new mail" notice.
		expect(sorted.notify).toBe(false);
		expect(await getThread(context, sorted.threadIdentifier, 'lead')).toMatchObject({
			folder: 'folder',
			folderIdentifier: folder,
			unread: false,
			assigneeIdentifier: 'lead',
			tags: [{ name: 'Correction or removal' }]
		});
		const other = await filed(context, 'someone@else.example', 'Unrelated');
		expect(other.sortedBy).toEqual([]);
		expect((await getThread(context, other.threadIdentifier, 'lead'))!.folder).toBe('inbox');
		expect((await listRules(context))[0]).toMatchObject({ matchCount: 1 });
	});

	it('run in order, stop when a rule says so, and skip rules that are off', async () => {
		const context = await testContext(clock);
		const first = await saveRule(context, 'lead', rule({ name: 'First', conditions: [{ field: 'subject', operator: 'contains', value: 'hello' }], stopAfter: true }), null);
		await saveRule(context, 'lead', rule({ name: 'Second', conditions: [{ field: 'subject', operator: 'contains', value: 'hello' }], actions: [{ action: 'move', value: 'archive' }] }), null);
		expect((await filed(context, 'a@nation.example', 'Hello there')).sortedBy).toEqual(['First']);
		await setRuleEnabled(context, 'lead', first, false);
		expect((await filed(context, 'b@nation.example', 'Hello again')).sortedBy).toEqual(['Second']);
		await setRuleEnabled(context, 'lead', first, true);
		await moveRule(context, first, 'down');
		expect((await listRules(context)).map((item) => item.name)).toEqual(['Second', 'First']);
		expect((await filed(context, 'c@nation.example', 'Hello once more')).sortedBy).toEqual(['Second', 'First']);
	});

	it('do not run on Spam', async () => {
		const context = await testContext(clock);
		await saveRule(context, 'lead', rule({ conditions: [{ field: 'subject', operator: 'contains', value: 'urgent' }], actions: [{ action: 'move', value: 'archive' }] }), null);
		const result = await receiveMail(context, {
			from: 'ceo@bank.example',
			to: 'contact@example.org',
			raw: encoder.encode(
				rawMessage({ From: 'ceo@bank.example', To: 'contact@example.org', Subject: 'Urgent', 'Authentication-Results': 'mx.cloudflare.net; dmarc=fail header.from=bank.example' }, 'Pay')
			)
		});
		expect(result).toMatchObject({ outcome: 'filed', spam: true, sortedBy: [] });
	});

	it('can be tested on the inbox and then run on it', async () => {
		const context = await testContext(clock);
		await filed(context, 'office@navajo-nsn.gov', 'Before the rule');
		await filed(context, 'someone@else.example', 'Not this one');
		const input = rule({ conditions: [{ field: 'from', operator: 'contains', value: 'navajo-nsn.gov' }], actions: [{ action: 'move', value: 'archive' }] });
		const preview = await previewRule(context, input);
		expect(preview).toMatchObject({ count: 1, examples: [{ subject: 'Before the rule' }] });
		// Testing changes nothing.
		expect((await listThreads(context, { view: 'inbox', personIdentifier: 'lead' })).threads).toHaveLength(2);
		const saved = await saveRule(context, 'lead', input, null);
		expect(await applyRuleToInbox(context, 'lead', saved)).toBe(1);
		expect((await listThreads(context, { view: 'inbox', personIdentifier: 'lead' })).threads.map((thread) => thread.subject)).toEqual(['Not this one']);
		expect((await listThreads(context, { view: 'archive', personIdentifier: 'lead' })).threads.map((thread) => thread.subject)).toEqual(['Before the rule']);
	});

	it('skip a folder that was deleted after the rule was made', async () => {
		const context = await testContext(clock);
		const folder = await createFolder(context, 'lead', 'Gone soon', null);
		await saveRule(context, 'lead', rule({ conditions: [{ field: 'subject', operator: 'contains', value: 'hello' }], actions: [{ action: 'move', value: folder }] }), null);
		await deleteFolder(context, 'lead', folder);
		const mail = await filed(context, 'a@nation.example', 'Hello');
		expect(mail.sortedBy).toEqual(['Navajo Nation mail']);
		expect((await getThread(context, mail.threadIdentifier, 'lead'))!.folder).toBe('inbox');
	});
});
