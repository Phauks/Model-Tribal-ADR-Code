/**
 * The route guard (security report, item S4). Every route that changes data
 * must check who is asking before it does anything. This test reads every
 * route file with the TypeScript parser and finds each handler that can
 * change data:
 *
 * 1. every POST, PUT, PATCH, DELETE or fallback handler exported from a
 *    +server.ts file; and
 * 2. every form action exported from a +page.server.ts file.
 *
 * Each one must call one of the guard helpers listed below, or check
 * `locals.account` or `locals.person` itself, either in the handler or in a
 * function of the same file that the handler calls. A route that is public on
 * purpose is listed in publicHandlers with what protects it instead. Anything
 * new that has neither fails the test, so a new way to change data is looked
 * at before it ships.
 *
 * The test sees whether a guard is called, not whether every path through the
 * handler reaches it. That still catches the mistake it is for: a new route
 * or action written without any check at all.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { beforeAll, describe, expect, it } from 'vitest';

const site = path.resolve(import.meta.dirname, '..');
const routesFolder = path.join(site, 'src', 'routes');

/**
 * The checks routes use today, by function name, with the module that exports
 * it and what it checks. A call to any of these counts as a guard.
 */
const guardHelpers: Record<string, { module: string; checks: string }> = {
	// The workspace checks (src/lib/server/workspace.ts).
	requirePerson: {
		module: 'src/lib/server/workspace.ts',
		checks: 'A signed-in person with workspace access, who has two-step sign-in if their role needs it.'
	},
	requirePersonForData: {
		module: 'src/lib/server/workspace.ts',
		checks: 'The same as requirePerson, answering 401 or 403 instead of a redirect, for addresses the editor calls with fetch.'
	},
	requireAccount: {
		module: 'src/lib/server/workspace.ts',
		checks: 'Any signed-in account, such as a contributor or a reader.'
	},
	requirePermission: {
		module: 'src/lib/server/workspace.ts',
		checks: 'A signed-in person who holds the named permission.'
	},
	refuse: {
		module: 'src/lib/server/workspace.ts',
		checks: 'Refuses with 403 Forbidden and records why, after a check the route makes itself.'
	},

	// Levels on one document (decision record 0023).
	essayAccess: {
		module: 'src/lib/server/essay-workspace.ts',
		checks: 'A signed-in person with at least the given level on the essay named in the address.'
	},
	requireDocumentLevel: {
		module: 'src/lib/server/access.ts',
		checks: 'A signed-in person with at least the given level on a document, read fresh from the database.'
	},

	// The project inbox (site/MAIL.md, "Inboxes").
	requireMail: {
		module: 'src/lib/server/mail/inbox-access.ts',
		checks: 'A signed-in person who is on at least one inbox or manages the inboxes.'
	},
	requireThread: {
		module: 'src/lib/server/mail/inbox-access.ts',
		checks: 'A signed-in person who is on the conversation’s inbox.'
	},
	requireMessage: {
		module: 'src/lib/server/mail/inbox-access.ts',
		checks: 'A signed-in person who is on the inbox of the message’s conversation.'
	},

	// A nation's team (decision record 0041).
	nationAndGranter: {
		module: 'src/lib/server/nation-team-access.ts',
		checks: 'A signed-in person with a place on the team of the nation named in the address, or an administrator.'
	},

	// Sending files (docs/uploads.md).
	senderOf: {
		module: 'src/lib/server/upload-requests.ts',
		checks: 'Any signed-in account, answering 401 instead of a redirect.'
	},
	senderUpload: {
		module: 'src/lib/server/upload-requests.ts',
		checks: 'A signed-in account that owns the upload named in the address.'
	},

	// Calls the Worker makes to itself, with a token only that copy of the Worker holds.
	isMailRun: {
		module: 'src/lib/server/mail/internal-run.ts',
		checks: 'The Worker’s own email, queue and scheduled handlers passing mail work to /mail/internal/.'
	},
	isScheduledRun: {
		module: 'src/lib/server/scheduled-run.ts',
		checks: 'The Worker’s own scheduled handler passing a timed run to a /scheduled address.'
	},

	// Calls from payment and printing services, signed with a shared secret.
	isStripeWebhook: {
		module: 'src/lib/server/stripe.ts',
		checks: 'A Stripe webhook whose signature matches the endpoint’s signing secret.'
	},
	isLuluWebhook: {
		module: 'src/lib/server/lulu.ts',
		checks: 'A Lulu webhook whose signature matches the Lulu API secret.'
	}
};

/**
 * A sign-in check written in the route itself, such as
 * `if (!locals.account) error(401, ...)`: a `!` in front of one of these.
 */
const signedInCheck = /(^|\.)locals\.(account|person)$/;

/**
 * Handlers that change data without a signed-in person on purpose, by route
 * file, with what protects them instead. A handler named here must still
 * change data and still have no guard; otherwise the test asks for it to be
 * taken off the list.
 */
const publicHandlers: Record<string, { handlers: string[]; reason: string }> = {
	// Problems from readers' browsers (site/ERRORS.md).
	'src/routes/problems/+server.ts': {
		handlers: ['POST'],
		reason:
			'Any reader’s browser reports problems here, signed in or not. Each network address may send 30 a minute (problemReportLimit), a report is at most 8 KB, its fields are checked and cut short, and all it changes is a count in the problems table.'
	},
	// Signing in and out.
	'src/routes/sign-in/+page.server.ts': {
		handlers: ['actions.send', 'actions.resend', 'actions.create', 'actions.code', 'actions.password'],
		reason:
			'Signing in has to work signed out; each step is limited per address and connection, codes and passwords are checked against the database, and the answer is the same whether or not the address has an account.'
	},
	'src/routes/sign-in/link/+page.server.ts': {
		handlers: ['actions.default'],
		reason: 'The sign-in link signs in only with the single-use token from the email, checked by useLink, and changes nothing when merely opened.'
	},
	'src/routes/sign-in/two-step/+page.server.ts': {
		handlers: ['actions.confirm', 'actions.cancel'],
		reason:
			'The second step needs the waiting session that the first step set in this browser (locals.waitingSession), limits tries per account, and cancel only ends the session named by this browser’s own cookie.'
	},
	'src/routes/sign-in/passkey/+server.ts': {
		handlers: ['POST'],
		reason:
			'Signing in with a passkey has to work signed out; it is limited per connection, the answer counts only for the single-use challenge this browser was given, and only a signature from a passkey kept for an account signs in.'
	},
	'src/routes/sign-out/+server.ts': {
		handlers: ['POST'],
		reason: 'Signing out ends only the session named by this browser’s own cookie and clears it, so there is nothing to protect.'
	},

	// Forms anyone may send.
	'src/routes/requests/+page.server.ts': {
		handlers: ['actions.default'],
		reason:
			'The public request form, meant for anyone; it is limited per connection, checks size and spam, and only adds a new request for the team to review.'
	},
	'src/routes/forms/[form]/+page.server.ts': {
		handlers: ['actions.send', 'actions.upload'],
		reason:
			'Public forms anyone may fill in; only templates marked sendable accept answers, sending is limited per connection and checked for spam, and it only adds a new request for the team to review.'
	},

	// Links in emails that carry their own token.
	'src/routes/mail/unsubscribe/[token]/+page.server.ts': {
		handlers: ['actions.default'],
		reason: 'The outreach unsubscribe link: unsubscribeWithToken acts only on a token signed with the mail signing key, and only adds the address to the do-not-email list.'
	},
	'src/routes/mail/unsubscribe/[token]/one-click/+server.ts': {
		handlers: ['POST'],
		reason: 'A mail program’s one-click unsubscribe (RFC 8058): the same signed token as the unsubscribe page, and only the one-click content type the Worker’s entry passes on.'
	},
	'src/routes/mail/got-it/[token]/+page.server.ts': {
		handlers: ['actions.default'],
		reason: 'The “let us know you got this” link: readToken accepts only a token signed with the mail signing key, and it only marks that one message as received.'
	},
	'src/routes/following/email-off/+page.server.ts': {
		handlers: ['actions.default'],
		reason: 'The “Stop these emails” link: turnOffEmailByToken acts only on the account’s own random email-off token, and only turns its summary emails off.'
	},

	// Printed copies of the book (docs/book-orders.md, docs/store.md).
	'src/routes/book/quote/+server.ts': {
		handlers: ['POST'],
		reason: 'Asks Lulu for a price and stores nothing; it is limited per connection.'
	},
	'src/routes/book/order/+server.ts': {
		handlers: ['POST'],
		reason:
			'Anyone may order a printed copy without an account; it is limited per connection, priced again by Lulu, and nothing is printed until the Stripe webhook confirms the payment.'
	},
	'src/routes/store/checkout/+server.ts': {
		handlers: ['POST'],
		reason:
			'The Store’s one-step purchase, open to anyone like /book/order; it is limited per connection and nothing is printed until the Stripe webhook confirms the payment.'
	},
	'src/routes/orders/[identifier]/+page.server.ts': {
		handlers: ['actions.problem'],
		reason:
			'Reporting a problem with a paid order needs the order’s long random identifier, which only the buyer is given; it is limited per connection and only adds a report for the team.'
	},

	// Downloading several search results at once (src/lib/search-selection.ts).
	'src/routes/search/download/+server.ts': {
		handlers: ['POST'],
		reason:
			'Changes nothing: it is a POST only because the list of results is long. It puts together a .zip of files any reader may already download one at a time, taken only from the build’s records and list of copies and following nations’ choices, at most 500 results a time, as the nations’ .zip downloads do.'
	},

	// The video room.
	'src/routes/rooms/[room]/invite/[secret]/+page.server.ts': {
		handlers: ['actions.join'],
		reason:
			'Joining a room with an invite link needs no account: findInvite answers 404 unless the secret in the address matches an invite to that room, and standaloneRoomAccess refuses a revoked invite or a closed room.'
	}
};

/** The handler names in a +server.ts file that can change data. A fallback answers every method the file does not name, POST among them. */
const changingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE', 'fallback']);

interface Handler {
	/** The route file, from the site folder, such as src/routes/sign-out/+server.ts. */
	file: string;
	/** POST, PUT, PATCH, DELETE or fallback, or actions.<name> for a form action. */
	handler: string;
	line: number;
	/** The guards the handler calls, by name; `locals.account` or `locals.person` for a check written in the route. */
	guards: string[];
}

let handlersFound: Handler[] = [];
/** Exports the test cannot read, which it would otherwise pass over. */
let unreadable: string[] = [];

function routeFiles(folder: string): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(folder, { withFileTypes: true })) {
		const full = path.join(folder, entry.name);
		if (entry.isDirectory()) found.push(...routeFiles(full));
		else if (/^\+(server|page\.server)\.(ts|js)$/.test(entry.name)) found.push(full);
	}
	return found;
}

/** Strips `satisfies`, `as` and parentheses from an expression. */
function unwrap(expression: ts.Expression): ts.Expression {
	let current = expression;
	while (ts.isSatisfiesExpression(current) || ts.isAsExpression(current) || ts.isParenthesizedExpression(current)) {
		current = current.expression;
	}
	return current;
}

function isExported(statement: ts.Statement): boolean {
	return ts.canHaveModifiers(statement) && (ts.getModifiers(statement) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
}

function readRouteFile(file: string) {
	const relative = path.relative(site, file).split(path.sep).join('/');
	const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const lineOf = (node: ts.Node) => source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
	const isServerFile = /\+server\.(ts|js)$/.test(file);

	// Functions defined at the top of the file, which a handler may call to do its check.
	const localFunctions = new Map<string, ts.Node>();
	for (const statement of source.statements) {
		if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
			localFunctions.set(statement.name.text, statement);
		}
		if (ts.isVariableStatement(statement)) {
			for (const declaration of statement.declarationList.declarations) {
				const initializer = declaration.initializer && unwrap(declaration.initializer);
				if (ts.isIdentifier(declaration.name) && initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
					localFunctions.set(declaration.name.text, initializer);
				}
			}
		}
	}

	/** The guards a piece of code calls, following calls to functions of the same file. */
	const guardsIn = (start: ts.Node): string[] => {
		const guards = new Set<string>();
		const followed = new Set<string>();
		const visit = (node: ts.Node) => {
			if (ts.isCallExpression(node)) {
				const callee = node.expression;
				const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : undefined;
				if (name && Object.hasOwn(guardHelpers, name)) guards.add(name);
				if (ts.isIdentifier(callee) && localFunctions.has(callee.text) && !followed.has(callee.text)) {
					followed.add(callee.text);
					visit(localFunctions.get(callee.text)!);
				}
			}
			if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
				const operand = unwrap(node.operand as ts.Expression).getText().replace(/\s+/g, '');
				const match = signedInCheck.exec(operand);
				if (match) guards.add(`locals.${match[2]}`);
			}
			ts.forEachChild(node, visit);
		};
		visit(start);
		return [...guards];
	};

	const record = (handler: string, node: ts.Node) => {
		handlersFound.push({ file: relative, handler, line: lineOf(node), guards: guardsIn(node) });
	};

	/** The code of a form action, given the value it is set to. */
	const actionCode = (value: ts.Expression): ts.Node | undefined => {
		const inner = unwrap(value);
		if (ts.isArrowFunction(inner) || ts.isFunctionExpression(inner)) return inner;
		if (ts.isIdentifier(inner)) return localFunctions.get(inner.text);
		return undefined;
	};

	for (const statement of source.statements) {
		// export { handler as POST } and the like hide the handler from this test.
		if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
			for (const element of statement.exportClause.elements) {
				if (changingMethods.has(element.name.text) || element.name.text === 'actions') {
					unreadable.push(`${relative}:${lineOf(element)}  export { ... as ${element.name.text} } (define it in the file as export const ${element.name.text})`);
				}
			}
		}
		if (!isExported(statement)) continue;

		if (isServerFile && ts.isFunctionDeclaration(statement) && statement.name && changingMethods.has(statement.name.text)) {
			record(statement.name.text, statement);
		}
		if (!ts.isVariableStatement(statement)) continue;
		for (const declaration of statement.declarationList.declarations) {
			if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
			const name = declaration.name.text;
			if (isServerFile && changingMethods.has(name)) {
				record(name, declaration.initializer);
			}
			if (!isServerFile && name === 'actions') {
				const actions = unwrap(declaration.initializer);
				if (!ts.isObjectLiteralExpression(actions)) {
					unreadable.push(`${relative}:${lineOf(declaration)}  actions (write it as an object of actions)`);
					continue;
				}
				for (const property of actions.properties) {
					const key = property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) ? property.name.text : property.name?.getText();
					const handler = `actions.${key ?? '(unnamed)'}`;
					let code: ts.Node | undefined;
					if (ts.isMethodDeclaration(property)) code = property;
					else if (ts.isPropertyAssignment(property)) code = actionCode(property.initializer);
					else if (ts.isShorthandPropertyAssignment(property)) code = localFunctions.get(property.name.text);
					if (code) record(handler, code);
					else unreadable.push(`${relative}:${lineOf(property)}  ${handler} (define the action in the file, or in a function of the same file)`);
				}
			}
		}
	}
}

beforeAll(() => {
	handlersFound = [];
	unreadable = [];
	for (const file of routeFiles(routesFolder).sort()) readRouteFile(file);
});

const nameOf = (found: Handler) => `${found.file} ${found.handler}`;
const isPublic = (found: Handler) => Object.hasOwn(publicHandlers, found.file) && publicHandlers[found.file].handlers.includes(found.handler);

describe('the route guard', () => {
	it('finds the handlers it knows are there', () => {
		const names = handlersFound.map(nameOf);
		expect(names).toContain('src/routes/workspace/essays/[id]/save/+server.ts POST');
		expect(names).toContain('src/routes/account/settings/+server.ts DELETE');
		expect(names).toContain('src/routes/sign-in/+page.server.ts actions.code');
		expect(names).toContain('src/routes/workspace/uploads/[reference]/+page.server.ts actions.check-again');
		expect(handlersFound.length).toBeGreaterThan(200);
	});

	it('can read every handler that changes data', () => {
		expect(unreadable, 'The route guard cannot see the code of these handlers, so it cannot tell whether they check who is asking').toEqual([]);
	});

	it('checks who is asking in every handler that changes data', () => {
		const unguarded = handlersFound
			.filter((found) => found.guards.length === 0 && !isPublic(found))
			.map((found) => `${found.file}:${found.line}  ${found.handler}`);
		expect(
			unguarded,
			'These handlers change data without checking who is asking. Call a guard from src/lib/server/workspace.ts (requirePerson, requireAccount, requirePermission and so on) or another helper listed in guardHelpers in tests/route-guards.test.ts. If the route is public on purpose, add it to publicHandlers there with what protects it instead'
		).toEqual([]);
	});

	it('lists no public handler that is gone or no longer changes data', () => {
		const names = new Set(handlersFound.map(nameOf));
		const stale: string[] = [];
		for (const [file, entry] of Object.entries(publicHandlers)) {
			if (!existsSync(path.join(site, file))) {
				stale.push(`${file}  (the file is gone)`);
				continue;
			}
			for (const handler of entry.handlers) {
				if (!names.has(`${file} ${handler}`)) stale.push(`${file} ${handler}  (no longer changes data)`);
			}
		}
		expect(stale, 'Take these off publicHandlers in tests/route-guards.test.ts').toEqual([]);
	});

	it('lists no public handler that now has a guard', () => {
		const guarded = handlersFound.filter((found) => isPublic(found) && found.guards.length > 0).map((found) => `${nameOf(found)}  (calls ${found.guards.join(', ')})`);
		expect(guarded, 'These handlers check who is asking now. Take them off publicHandlers in tests/route-guards.test.ts').toEqual([]);
	});

	it('names only guard helpers that still exist', () => {
		const missing = Object.entries(guardHelpers)
			.filter(([name, helper]) => {
				const file = path.join(site, helper.module);
				if (!existsSync(file)) return true;
				return !new RegExp(`export\\s+(async\\s+)?function\\s+${name}\\b`).test(readFileSync(file, 'utf8'));
			})
			.map(([name, helper]) => `${name} in ${helper.module}`);
		expect(missing, 'Update guardHelpers in tests/route-guards.test.ts').toEqual([]);
	});
});
