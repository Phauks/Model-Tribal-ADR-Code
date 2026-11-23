/**
 * Auto-sort rules for the project inbox (site/MAIL.md, "Folders, tags and
 * rules"). Each rule is a set of conditions on an arriving message and the
 * actions to take when they hold: move the conversation to a folder, add
 * tags, assign it, or mark it read. Rules run in order on every message that
 * arrives, except Spam and delivery reports; a rule can stop the later ones.
 * The matching itself is in src/lib/mail.ts (ruleMatches), so the page can
 * describe a rule with the same words the server uses.
 */
import {
	folders,
	ruleActionKinds,
	ruleFields,
	ruleMatches,
	ruleOperators,
	type RuleAction,
	type RuleCondition,
	type RuleFacts
} from '#lib/mail.ts';
import { actionStatement, currentTime, type MailContext } from './context.ts';

export interface MailRule {
	identifier: string;
	name: string;
	position: number;
	enabled: boolean;
	matchAll: boolean;
	conditions: RuleCondition[];
	actions: RuleAction[];
	stopAfter: boolean;
	matchCount: number;
	lastMatchedAt: string | null;
}

export interface RuleInput {
	name: string;
	enabled: boolean;
	matchAll: boolean;
	conditions: RuleCondition[];
	actions: RuleAction[];
	stopAfter: boolean;
}

export class RuleError extends Error {}

/** Where a rule may move mail: Archive, Spam, Deleted, or a made folder. Never back to the inbox, where it already is. */
const ruleBuiltInPlaces: readonly string[] = folders.filter((folder) => folder !== 'inbox');

const conditionLimit = 10;
const actionLimit = 10;

interface RuleRow {
	identifier: string;
	name: string;
	position: number;
	enabled: number;
	match_all: number;
	conditions: string;
	actions: string;
	stop_after: number;
	match_count: number;
	last_matched_at: string | null;
}

function parseJson<T>(value: string): T[] {
	try {
		const parsed = JSON.parse(value) as unknown;
		return Array.isArray(parsed) ? (parsed as T[]) : [];
	} catch {
		return [];
	}
}

function fromRow(row: RuleRow): MailRule {
	return {
		identifier: row.identifier,
		name: row.name,
		position: row.position,
		enabled: row.enabled === 1,
		matchAll: row.match_all === 1,
		conditions: parseJson<RuleCondition>(row.conditions),
		actions: parseJson<RuleAction>(row.actions),
		stopAfter: row.stop_after === 1,
		matchCount: row.match_count,
		lastMatchedAt: row.last_matched_at
	};
}

export async function listRules(context: MailContext): Promise<MailRule[]> {
	const { results } = await context.database.prepare('SELECT * FROM mail_rules ORDER BY position, created_at').all<RuleRow>();
	return results.map(fromRow);
}

export async function getRule(context: MailContext, identifier: string): Promise<MailRule | null> {
	const row = await context.database.prepare('SELECT * FROM mail_rules WHERE identifier = ?').bind(identifier).first<RuleRow>();
	return row ? fromRow(row) : null;
}

/**
 * Checks a rule as typed into the form and returns it cleaned: known fields
 * and operators only, words trimmed, empty rows dropped, and at most one
 * move and one assignment. Throws RuleError with words for the page.
 */
export function cleanRule(input: RuleInput): RuleInput {
	const name = input.name.trim().slice(0, 80);
	if (!name) throw new RuleError('Give the rule a name, such as “Navajo Nation mail”.');
	const conditions: RuleCondition[] = [];
	for (const condition of input.conditions) {
		const field = ruleFields.find((item) => item.key === condition.field);
		if (!field) continue;
		if (field.kind === 'yes-no') {
			conditions.push({ field: field.key, operator: 'is', value: condition.value === 'no' ? 'no' : 'yes' });
			continue;
		}
		const value = (condition.value ?? '').trim().slice(0, 200);
		if (!value) continue;
		const operator = ruleOperators.find((item) => item.key === condition.operator)?.key ?? 'contains';
		conditions.push({ field: field.key, operator, value });
	}
	if (conditions.length === 0) throw new RuleError('Add at least one condition, such as “Sender contains @navajo-nsn.gov”.');
	if (conditions.length > conditionLimit) throw new RuleError(`A rule can have at most ${conditionLimit} conditions.`);
	const actions: RuleAction[] = [];
	for (const action of input.actions) {
		const kind = ruleActionKinds.find((item) => item.key === action.action)?.key;
		if (!kind) continue;
		const value = kind === 'read' ? '' : (action.value ?? '').trim();
		if (kind !== 'read' && !value) continue;
		if ((kind === 'move' || kind === 'assign' || kind === 'read') && actions.some((item) => item.action === kind)) {
			throw new RuleError(kind === 'move' ? 'A rule can move mail to one place only.' : kind === 'assign' ? 'A rule can assign mail to one person only.' : 'Mark as read is there twice.');
		}
		if (kind === 'tag' && actions.some((item) => item.action === 'tag' && item.value === value)) continue;
		actions.push({ action: kind, value });
	}
	if (actions.length === 0) throw new RuleError('Choose at least one thing the rule does, such as moving the mail to a folder.');
	if (actions.length > actionLimit) throw new RuleError(`A rule can do at most ${actionLimit} things.`);
	return { name, enabled: input.enabled, matchAll: input.matchAll, conditions, actions, stopAfter: input.stopAfter };
}

/** Checks that the folders, tags and people a rule names exist, so a typo cannot hide mail. */
async function checkTargets(context: MailContext, rule: RuleInput): Promise<void> {
	for (const action of rule.actions) {
		if (action.action === 'move' && !ruleBuiltInPlaces.includes(action.value)) {
			const found = await context.database.prepare('SELECT 1 AS found FROM mail_folders WHERE identifier = ?').bind(action.value).first();
			if (!found) throw new RuleError('The folder this rule moves mail to is gone. Choose another.');
		}
		if (action.action === 'tag') {
			const found = await context.database.prepare('SELECT 1 AS found FROM mail_tags WHERE identifier = ?').bind(action.value).first();
			if (!found) throw new RuleError('A tag this rule adds is gone. Choose another.');
		}
		if (action.action === 'assign') {
			const found = await context.database
				.prepare(`SELECT 1 AS found FROM people WHERE identifier = ? AND status = 'active'`)
				.bind(action.value)
				.first();
			if (!found) throw new RuleError('The person this rule assigns mail to cannot be found.');
		}
	}
}

/** Saves a new rule (last in order) or changes one. Returns its identifier. */
export async function saveRule(context: MailContext, personIdentifier: string, input: RuleInput, identifier: string | null): Promise<string> {
	const rule = cleanRule(input);
	await checkTargets(context, rule);
	const at = currentTime(context).toISOString();
	const values = [rule.name, rule.enabled ? 1 : 0, rule.matchAll ? 1 : 0, JSON.stringify(rule.conditions), JSON.stringify(rule.actions), rule.stopAfter ? 1 : 0];
	if (identifier) {
		const result = await context.database
			.prepare(
				`UPDATE mail_rules SET name = ?, enabled = ?, match_all = ?, conditions = ?, actions = ?, stop_after = ?, updated_at = ?
				 WHERE identifier = ?`
			)
			.bind(...values, at, identifier)
			.run();
		if (!result.meta.changes) throw new RuleError('That rule is gone.');
		await actionStatement(context, { personIdentifier, action: 'Changed a rule', note: rule.name }).run();
		return identifier;
	}
	const fresh = crypto.randomUUID();
	await context.database.batch([
		context.database
			.prepare(
				`INSERT INTO mail_rules (identifier, name, enabled, match_all, conditions, actions, stop_after, position, created_by, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM mail_rules), ?, ?, ?)`
			)
			.bind(fresh, ...values, personIdentifier, at, at),
		actionStatement(context, { personIdentifier, action: 'Made a rule', note: rule.name })
	]);
	return fresh;
}

export async function deleteRule(context: MailContext, personIdentifier: string, identifier: string): Promise<void> {
	const rule = await getRule(context, identifier);
	if (!rule) return;
	await context.database.batch([
		context.database.prepare('DELETE FROM mail_rules WHERE identifier = ?').bind(identifier),
		actionStatement(context, { personIdentifier, action: 'Deleted a rule', note: rule.name })
	]);
}

export async function setRuleEnabled(context: MailContext, personIdentifier: string, identifier: string, enabled: boolean): Promise<void> {
	const rule = await getRule(context, identifier);
	if (!rule) return;
	await context.database.batch([
		context.database.prepare('UPDATE mail_rules SET enabled = ? WHERE identifier = ?').bind(enabled ? 1 : 0, identifier),
		actionStatement(context, { personIdentifier, action: enabled ? 'Turned a rule on' : 'Turned a rule off', note: rule.name })
	]);
}

/** Moves a rule one place earlier or later in the order the rules run. */
export async function moveRule(context: MailContext, identifier: string, direction: 'up' | 'down'): Promise<void> {
	const rules = await listRules(context);
	const index = rules.findIndex((rule) => rule.identifier === identifier);
	const other = direction === 'up' ? index - 1 : index + 1;
	if (index < 0 || other < 0 || other >= rules.length) return;
	[rules[index], rules[other]] = [rules[other], rules[index]];
	await context.database.batch(
		rules.map((rule, position) => context.database.prepare('UPDATE mail_rules SET position = ? WHERE identifier = ?').bind(position + 1, rule.identifier))
	);
}

/**
 * The statements that carry out a rule's actions on one conversation. A
 * folder, tag or person that has since been deleted is skipped.
 */
async function actionStatements(context: MailContext, rule: MailRule, threadIdentifier: string, at: string) {
	const database = context.database;
	const statements = [];
	for (const action of rule.actions) {
		if (action.action === 'move') {
			if (ruleBuiltInPlaces.includes(action.value)) {
				statements.push(
					database
						.prepare('UPDATE mail_threads SET folder = ?, folder_identifier = NULL, updated_at = ? WHERE identifier = ?')
						.bind(action.value, at, threadIdentifier)
				);
			} else {
				statements.push(
					database
						.prepare(
							`UPDATE mail_threads SET folder = 'folder', folder_identifier = ?1, updated_at = ?2
							 WHERE identifier = ?3 AND EXISTS (SELECT 1 FROM mail_folders WHERE identifier = ?1)`
						)
						.bind(action.value, at, threadIdentifier)
				);
			}
		} else if (action.action === 'tag') {
			statements.push(
				database
					.prepare(
						`INSERT OR IGNORE INTO mail_thread_tags (thread_identifier, tag_identifier)
						 SELECT ?1, ?2 WHERE EXISTS (SELECT 1 FROM mail_tags WHERE identifier = ?2)`
					)
					.bind(threadIdentifier, action.value)
			);
		} else if (action.action === 'assign') {
			statements.push(
				database
					.prepare(
						`UPDATE mail_threads SET assignee_identifier = ?1, updated_at = ?2
						 WHERE identifier = ?3 AND EXISTS (SELECT 1 FROM people WHERE identifier = ?1 AND status = 'active')`
					)
					.bind(action.value, at, threadIdentifier)
			);
		} else if (action.action === 'read') {
			statements.push(database.prepare('UPDATE mail_threads SET unread = 0, updated_at = ? WHERE identifier = ?').bind(at, threadIdentifier));
		}
	}
	return statements;
}

/**
 * Runs the rules that are on, in order, for one arriving message. Returns
 * the names of the rules that matched. Called by receiveMail
 * (src/lib/server/mail/inbound.ts) after the message is filed.
 */
export async function runRules(context: MailContext, threadIdentifier: string, facts: RuleFacts): Promise<string[]> {
	const rules = (await listRules(context)).filter((rule) => rule.enabled);
	const at = currentTime(context).toISOString();
	const matched: string[] = [];
	for (const rule of rules) {
		if (!ruleMatches(rule, facts)) continue;
		matched.push(rule.name);
		await context.database.batch([
			...(await actionStatements(context, rule, threadIdentifier, at)),
			context.database
				.prepare('UPDATE mail_rules SET match_count = match_count + 1, last_matched_at = ? WHERE identifier = ?')
				.bind(at, rule.identifier),
			actionStatement(context, { personIdentifier: null, action: 'Sorted by a rule', threadIdentifier, note: rule.name })
		]);
		if (rule.stopAfter) break;
	}
	return matched;
}

interface ExistingMessage {
	thread: string;
	subject: string;
	thread_subject: string;
	counterpart_name: string | null;
	counterpart_address: string | null;
	from_address: string;
	from_name: string | null;
	to_list: string;
	cc_list: string;
	project_address: string | null;
	text_body: string;
	automatic: number;
	nation_identifier: string | null;
	attachment: number;
}

/** An address the way rules look at it: the address, and the name and "Name <address>" when there is a name. */
export function ruleAddressForms(address: { email: string; name?: string | null }): string[] {
	return address.name ? [address.email, address.name, `${address.name} <${address.email}>`] : [address.email];
}

function addressesOf(value: string): string[] {
	return parseJson<{ email: string; name?: string | null }>(value).flatMap(ruleAddressForms);
}

/** The facts for a message, in the same shape receiveMail builds for an arriving one. */
export function factsFor(message: {
	fromAddress: string;
	fromName: string | null;
	to: string[];
	subject: string;
	body: string;
	attachment: boolean;
	nation: boolean;
	automatic: boolean;
}): RuleFacts {
	return {
		from: ruleAddressForms({ email: message.fromAddress, name: message.fromName }),
		to: message.to,
		subject: message.subject,
		body: message.body,
		attachment: message.attachment,
		nation: message.nation,
		automatic: message.automatic
	};
}

/** How far back "test" and "apply to the inbox" look: the latest received messages in the inbox. */
const existingLimit = 1000;

/** Conversations now in the inbox whose received messages a rule would match, newest first. */
async function matchingInInbox(context: MailContext, rule: { matchAll: boolean; conditions: RuleCondition[] }) {
	const { results } = await context.database
		.prepare(
			`SELECT m.thread_identifier AS thread, m.subject, t.subject AS thread_subject, t.counterpart_name, t.counterpart_address,
			 m.from_address, m.from_name, m.to_list, m.cc_list, t.project_address, m.text_body, m.automatic, t.nation_identifier,
			 EXISTS (SELECT 1 FROM mail_attachments a WHERE a.message_identifier = m.identifier AND a.inline = 0) AS attachment
			 FROM mail_messages m JOIN mail_threads t ON t.identifier = m.thread_identifier
			 WHERE m.direction = 'in' AND t.folder = 'inbox' AND m.spam_reason IS NULL
			 ORDER BY m.created_at DESC LIMIT ${existingLimit}`
		)
		.all<ExistingMessage>();
	const found = new Map<string, { identifier: string; subject: string; counterpart: string }>();
	for (const row of results) {
		if (found.has(row.thread)) continue;
		const facts = factsFor({
			fromAddress: row.from_address,
			fromName: row.from_name,
			to: [...addressesOf(row.to_list), ...addressesOf(row.cc_list), ...(row.project_address ? [row.project_address] : [])],
			subject: row.subject,
			body: row.text_body,
			attachment: row.attachment === 1,
			nation: row.nation_identifier !== null,
			automatic: row.automatic === 1
		});
		if (ruleMatches(rule, facts)) {
			found.set(row.thread, {
				identifier: row.thread,
				subject: row.thread_subject,
				counterpart: row.counterpart_name ?? row.counterpart_address ?? 'Unknown sender'
			});
		}
	}
	return [...found.values()];
}

/** What a rule would catch in the inbox now: how many conversations, and the first few. Changes nothing. */
export async function previewRule(context: MailContext, input: RuleInput) {
	const rule = cleanRule(input);
	const matches = await matchingInInbox(context, rule);
	return { count: matches.length, examples: matches.slice(0, 8) };
}

/** Runs a saved rule's actions on the conversations it matches in the inbox now. Returns how many it sorted. */
export async function applyRuleToInbox(context: MailContext, personIdentifier: string, identifier: string): Promise<number> {
	const rule = await getRule(context, identifier);
	if (!rule) throw new RuleError('That rule is gone.');
	const matches = await matchingInInbox(context, rule);
	const at = currentTime(context).toISOString();
	for (const match of matches) {
		await context.database.batch([
			...(await actionStatements(context, rule, match.identifier, at)),
			actionStatement(context, { personIdentifier, action: 'Sorted by a rule', threadIdentifier: match.identifier, note: rule.name })
		]);
	}
	if (matches.length) {
		await context.database
			.prepare('UPDATE mail_rules SET match_count = match_count + ?, last_matched_at = ? WHERE identifier = ?')
			.bind(matches.length, at, identifier)
			.run();
	}
	return matches.length;
}
