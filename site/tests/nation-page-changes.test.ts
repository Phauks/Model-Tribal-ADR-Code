import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { approvalProblem, changeProblem, liveAt, pictureKey, readContent } from '#lib/nation-page-changes.ts';
import { termEnd } from '#lib/nation-teams.ts';
import { checkSeals, sealNewEntries } from '#lib/server/activity-seals.ts';
import {
	approveEarly,
	discardChange,
	draftsOf,
	historyOf,
	liveChanges,
	publishChange,
	publishDraft,
	saveDraft,
	savePicture,
	waitingChanges
} from '#lib/server/nation-page-changes.ts';
import { fileScan } from '#lib/server/file-scans.ts';
import { escapeHtml, pageOverlay } from '#lib/server/nation-page-overlay.ts';
import { answersFor, teamReportState } from '#lib/nation-team-reports.ts';
import { answerReport, reportsForTeam, teamAnswersFor } from '#lib/server/nation-team-reports.ts';
import { addPlace, claimOf, claimedNations } from '#lib/server/nation-teams.ts';
import { matchSignIn, type SignedInPerson } from '#lib/server/people.ts';
import { wrappedConfig, entrySource, workerFirstPaths } from '../tools/add-nation-page-changes.mjs';
import { withNationPageChanges } from '../tools/nation-page-changes-worker.js';
import { testDatabase } from './database.ts';

const navajo = 'navajo-nation';
const time = new Date('2026-11-23T12:00:00Z');

describe('who may change a nation’s page', () => {
	const editor = { isAdministrator: false, level: 'editor', parts: null } as const;
	const drafter = { isAdministrator: false, level: 'drafter', parts: null } as const;
	const reviewer = { isAdministrator: false, level: 'reviewer', parts: null } as const;

	it('lets drafters write drafts and editors publish', () => {
		expect(changeProblem(drafter, 'about', 'draft')).toBeUndefined();
		expect(changeProblem(drafter, 'about', 'publish')).toMatch(/editor/);
		expect(changeProblem(editor, 'about', 'publish')).toBeUndefined();
		expect(changeProblem(reviewer, 'about', 'draft')).toMatch(/drafter/);
		expect(changeProblem({ isAdministrator: false }, 'about', 'draft')).toMatch(/team/);
		expect(changeProblem({ isAdministrator: true }, 'contacts', 'publish')).toBeUndefined();
	});

	it('keeps a place limited to some parts to those parts, but lets any editor hide', () => {
		const contactsOnly = { isAdministrator: false, level: 'editor', parts: ['contacts'] } as const;
		expect(changeProblem(contactsOnly, 'contacts', 'publish')).toBeUndefined();
		expect(changeProblem(contactsOnly, 'about', 'publish')).toMatch(/part/);
		expect(changeProblem(contactsOnly, 'pictures', 'draft')).toMatch(/part/);
		expect(changeProblem(contactsOnly, 'hidden', 'publish')).toBeUndefined();
		expect(changeProblem(drafter, 'hidden', 'publish')).toMatch(/editor/);
	});

	it('holds contacts for three days and publishes everything else at once', () => {
		expect(liveAt('about', time)).toBe(time.toISOString());
		expect(liveAt('hidden', time)).toBe(time.toISOString());
		expect(liveAt('contacts', time)).toBe('2026-11-26T12:00:00.000Z');
	});

	it('needs a second editor to approve contacts early', () => {
		const change = { writtenBy: 'a', publishedBy: 'a' };
		expect(approvalProblem({ ...editor, personIdentifier: 'a' }, change)).toMatch(/second/);
		expect(approvalProblem({ ...editor, personIdentifier: 'b' }, change)).toBeUndefined();
		expect(approvalProblem({ ...drafter, personIdentifier: 'b' }, change)).toMatch(/editor/);
		expect(approvalProblem({ isAdministrator: true, personIdentifier: 'a' }, change)).toMatch(/second/);
	});
});

describe('what a change may hold', () => {
	it('refuses links that are not https and contacts that are not what they say', () => {
		const read = (value: string, kind = 'website') => readContent('contacts', { contacts: [{ office: 'Court', kind, value }] }).problem;
		expect(read('https://courts.navajo-nsn.gov/')).toBeUndefined();
		expect(read('javascript:alert(1)')).toMatch(/https/);
		expect(read('http://example.org')).toMatch(/https/);
		expect(read('clerk@example.org', 'email')).toBeUndefined();
		expect(read('not an address', 'email')).toMatch(/email/);
		expect(read('(928) 871-6000', 'phone')).toBeUndefined();
	});

	it('needs a description of every picture, and keeps only known sections', () => {
		const picture = { identifier: '0b6c1f9e-6d3a-4a43-9a3c-2f1d5f6a7b8c', type: 'image/png', alt: '' };
		expect(readContent('pictures', { pictures: [picture] }).problem).toMatch(/Describe/);
		expect(readContent('pictures', { pictures: [{ ...picture, type: 'image/svg+xml', alt: 'x' }] }).content.pictures).toEqual([]);
		expect(readContent('hidden', { sections: ['law', 'everything', 'map'] }).content.sections).toEqual(['law', 'map']);
	});
});

describe('a nation’s pictures', () => {
	it('are held for the virus check from the moment they are stored', async () => {
		const database = testDatabase();
		const stored = new Map<string, unknown>();
		const bucket = { put: async (key: string, bytes: unknown) => void stored.set(key, bytes), delete: async () => undefined } as never;
		const identifier = await savePicture(database, bucket, 'navajo-nation', {
			name: 'council.jpg',
			type: 'image/jpeg',
			bytes: new Uint8Array([0xff, 0xd8, 0xff])
		});
		const key = pictureKey('navajo-nation', identifier);
		expect(stored.has(key)).toBe(true);
		expect(await fileScan(database, key)).toMatchObject({ status: 'waiting', purpose: 'nation-picture', subject: 'navajo-nation' });
	});
});

describe('changes in the database', () => {
	let database: D1Database;
	let lead: SignedInPerson;
	let editor: SignedInPerson;
	let second: SignedInPerson;

	async function signIn(subject: string, email: string): Promise<SignedInPerson> {
		const result = await matchSignIn(database, { subject, email, emailVerified: true, name: email }, 'lead@example.org');
		if (result.outcome !== 'signed-in') throw new Error(result.outcome);
		return result.person;
	}

	async function teamMember(subject: string, email: string): Promise<SignedInPerson> {
		await database
			.prepare(`INSERT INTO accounts (identifier, email, email_verified_at, created_at) VALUES (?, ?, ?, ?)`)
			.bind(subject, email, time.toISOString(), time.toISOString())
			.run();
		await addPlace(
			database,
			{ nationIdentifier: navajo, email, displayName: email.split('@')[0], level: 'editor', parts: null, office: null, expiresAt: termEnd(365), basis: null, addedByProject: false },
			lead
		);
		return signIn(subject, email);
	}

	const about = (text: string) => ({ nationIdentifier: navajo, kind: 'about' as const, content: { text }, credit: 'Navajo Nation Judicial Branch' });

	beforeEach(async () => {
		database = testDatabase();
		lead = await signIn('account-lead', 'lead@example.org');
		editor = await teamMember('account-e', 'e@navajo.example');
		second = await teamMember('account-f', 'f@navajo.example');
	});

	it('calls a page claimed only once the project confirmed someone with the nation’s office', async () => {
		// The editors in beforeEach were added by the lead author, not confirmed with the office.
		expect(await claimOf(database, navajo)).toBeUndefined();
		await addPlace(
			database,
			{ nationIdentifier: navajo, email: 'office@navajo.example', displayName: 'Office', level: 'steward', parts: null, office: 'Office of the President', expiresAt: termEnd(365), basis: 'Letter', addedByProject: true },
			lead
		);
		expect(await claimOf(database, navajo)).toMatchObject({ claimedSince: expect.any(String), offices: ['Office of the President'] });
		expect(await claimedNations(database)).toEqual(new Set([navajo]));
		const overlay = pageOverlay(navajo, {}, await claimOf(database, navajo))!;
		expect(overlay.slots.status).toContain('Claimed by the nation');
		expect(overlay.slots.status).toContain('[data-build-status]{display:none!important}');
		expect(overlay.slots.status).toContain(
			'<a href="#request=question&amp;record=tribes/navajo-nation&amp;to=team">Write to the team</a>'
		);
	});

	it('shows the team reports about its page without who sent them, and records its answer', async () => {
		const insert = (identifier: string, kind: string) =>
			database
				.prepare(
					`INSERT INTO requests (identifier, reference, kind, material, nation_identifier, requester_name, contact, details, received_at)
					 VALUES (?, ?, ?, 'tribes/navajo-nation', ?, 'Private Person', 'private@example.org', 'The court moved.', ?)`
				)
				.bind(identifier, `20261123-${identifier.toUpperCase()}`, kind, navajo, time.toISOString())
				.run();
		await insert('aaaaaa', 'correct');
		await insert('bbbbbb', 'remove');
		const reports = await reportsForTeam(database, navajo);
		expect(reports.map((report) => report.kind)).toEqual(['correct']);
		expect(JSON.stringify(reports)).not.toMatch(/Private Person|private@example/);
		await answerReport(database, { identifier: 'aaaaaa', nationIdentifier: navajo }, 'fixed', 'Updated the address.', editor);
		expect((await reportsForTeam(database, navajo))[0]).toMatchObject({ outcome: 'fixed', answeredByName: 'e' });
		const answers = await teamAnswersFor(database, ['aaaaaa', 'bbbbbb']);
		expect(teamReportState(answers.get('aaaaaa'), time.toISOString())).toBe('Team: fixed on the page');
		expect(teamReportState(undefined, '2026-11-01T00:00:00Z', time)).toBe('Team: no answer in 7 days');
		expect(teamReportState(undefined, time.toISOString(), time)).toBe('With the nation’s team');
	});

	it('shows the team who wrote only when the sender shared it, and lets it answer that it wrote back', async () => {
		await database
			.prepare(
				`INSERT INTO requests (identifier, reference, kind, material, nation_identifier, requester_name, contact, details, received_at, shared_with_team)
				 VALUES ('cccccc', '20261123-CCCCCC', 'question', 'tribes/navajo-nation', ?, 'Sample Name', 'sample@example.org', 'Who runs the peacemaking program?', ?, 1)`
			)
			.bind(navajo, time.toISOString())
			.run();
		const [message] = await reportsForTeam(database, navajo);
		expect(message.sender).toEqual({ name: 'Sample Name', contact: 'sample@example.org' });
		expect(answersFor(true)).toContain('wrote-back');
		expect(answersFor(false)).not.toContain('wrote-back');
		await answerReport(database, { identifier: 'cccccc', nationIdentifier: navajo }, 'wrote-back', null, editor);
		const answers = await teamAnswersFor(database, ['cccccc']);
		expect(teamReportState(answers.get('cccccc'), time.toISOString())).toBe('Team: wrote back to the sender');
	});

	it('starts with nothing, so pages have no pictures until a nation adds them', async () => {
		expect(await liveChanges(database, navajo)).toEqual({});
		expect(pageOverlay(navajo, await liveChanges(database, navajo))).toBeUndefined();
	});

	it('shows the newest published version and keeps the earlier ones', async () => {
		await publishChange(database, about('First words.'), editor, new Date('2026-11-23T10:00:00Z'));
		await publishChange(database, about('Second words.'), editor, new Date('2026-11-23T11:00:00Z'));
		const live = await liveChanges(database, navajo, time.toISOString());
		expect(live.about?.content.text).toBe('Second words.');
		expect((await historyOf(database, navajo)).map((change) => change.content)).toEqual([{ text: 'Second words.' }, { text: 'First words.' }]);
	});

	it('holds new contacts until a second editor approves them', async () => {
		const contacts = { nationIdentifier: navajo, kind: 'contacts' as const, content: { contacts: [{ office: 'Court', kind: 'email' as const, value: 'clerk@navajo.example' }] }, credit: 'Navajo Nation' };
		await publishChange(database, contacts, editor);
		expect((await liveChanges(database, navajo)).contacts).toBeUndefined();
		const [waiting] = await waitingChanges(database, navajo);
		expect(waiting.kind).toBe('contacts');
		// After three days it is live without anyone's approval.
		expect((await liveChanges(database, navajo, '2026-12-31T00:00:00.000Z')).contacts).toBeDefined();
		await approveEarly(database, waiting, second);
		expect((await liveChanges(database, navajo)).contacts?.approvedByName).toBe('f');
	});

	it('lets a waiting change be cancelled', async () => {
		await publishChange(database, { nationIdentifier: navajo, kind: 'contacts', content: { contacts: [] }, credit: 'Navajo Nation' }, editor);
		const [waiting] = await waitingChanges(database, navajo);
		await discardChange(database, waiting, second);
		expect(await waitingChanges(database, navajo)).toEqual([]);
		expect((await historyOf(database, navajo))[0].status).toBe('discarded');
	});

	it('keeps one draft per person and part, and publishes it under its writer’s name', async () => {
		await saveDraft(database, about('Draft one.'), editor);
		await saveDraft(database, about('Draft two.'), editor);
		await saveDraft(database, about('Another person’s draft.'), second);
		const drafts = await draftsOf(database, navajo);
		expect(drafts.map((draft) => draft.content)).toEqual(expect.arrayContaining([{ text: 'Draft two.' }, { text: 'Another person’s draft.' }]));
		expect(drafts).toHaveLength(2);
		const mine = drafts.find((draft) => draft.writtenBy === editor.identifier)!;
		await publishDraft(database, mine, second);
		const live = (await liveChanges(database, navajo)).about!;
		expect(live).toMatchObject({ writtenByName: 'e', publishedByName: 'f', content: { text: 'Draft two.' } });
		await sealNewEntries(database);
		expect((await checkSeals(database)).intact).toBe(true);
	});
});

describe('what the page shows', () => {
	const change = (kind: string, content: unknown) =>
		({ identifier: `${kind}-1`, kind, content, credit: 'Navajo Nation', liveAt: '2026-11-23T12:00:00.000Z', publishedAt: '2026-11-23T12:00:00.000Z', writtenAt: '2026-11-23T12:00:00.000Z' }) as never;

	it('escapes everything the nation typed and says who wrote it', () => {
		const overlay = pageOverlay(navajo, { about: change('about', { text: 'Hello <script>alert(1)</script>\n\nSecond "paragraph".' }) })!;
		expect(overlay.slots.top).toContain('Written by the Navajo Nation · Updated Nov. 23, 2026');
		expect(overlay.slots.top).toContain('&lt;script&gt;');
		expect(overlay.slots.top).not.toContain('<script>');
		expect(overlay.slots.top).toContain('<p>Second &quot;paragraph&quot;.</p>');
		expect(escapeHtml(`'&`)).toBe('&#39;&amp;');
	});

	it('puts statements beside the government records they answer', () => {
		const overlay = pageOverlay(navajo, { statements: change('statements', { statements: { law: 'Our compact was renewed.', recognition: 'We are a nation.' } }) })!;
		expect(overlay.slots.law).toContain('Our compact was renewed.');
		expect(overlay.slots.glance).toContain('We are a nation.');
		expect(overlay.slots.jurisdiction).toBeUndefined();
	});

	it('hides parts at once with a note, and links contacts safely', () => {
		const overlay = pageOverlay(navajo, {
			hidden: change('hidden', { sections: ['law', 'seal'] }),
			contacts: change('contacts', { contacts: [{ office: 'Court', kind: 'website', value: 'https://courts.example/' }, { office: 'Court', kind: 'email', value: 'clerk@navajo.example' }] })
		})!;
		expect(overlay.slots.top).toContain('details[data-section="law-heading"],.nation-image{display:none!important}');
		expect(overlay.slots.top).toContain('Laws and agreements, The seal or emblem');
		expect(overlay.slots.contacts).toContain('<a href="https://courts.example/" rel="noopener">');
		expect(overlay.slots.contacts).toContain('href="mailto:clerk@navajo.example"');
	});

	it('changes its stamp when a different version goes live', () => {
		const first = pageOverlay(navajo, { about: change('about', { text: 'a' }) })!;
		const second = pageOverlay(navajo, { about: { ...(change('about', { text: 'a' }) as object), identifier: 'about-2' } as never })!;
		expect(first.stamp).not.toBe(second.stamp);
	});
});

describe('the Worker that adds the changes to the page', () => {
	type SlotHandler = { element: (element: { getAttribute: (name: string) => string | null; setInnerContent: (content: string, options: { html: boolean }) => void }) => void };
	class FakeRewriter {
		handlers: { selector: string; handler: SlotHandler }[] = [];
		on(selector: string, handler: SlotHandler) {
			this.handlers.push({ selector, handler });
			return this;
		}
		async transform(response: Response): Promise<Response> {
			let html = await response.text();
			html = html.replace(/<div data-nation-slot="(\w+)"><\/div>/g, (whole, slot: string) => {
				let inner = '';
				this.handlers[0].handler.element({ getAttribute: () => slot, setInnerContent: (value: string) => (inner = value) });
				return `<div data-nation-slot="${slot}">${inner}</div>`;
			});
			return new Response(html, response);
		}
	}

	function fakeWorker(overlay: unknown) {
		const seen: string[] = [];
		return {
			seen,
			worker: {
				scheduled: () => 'kept',
				async fetch(request: Request) {
					const url = new URL(request.url);
					seen.push(`${url.pathname}${request.headers.get('if-none-match') ? ' (conditional)' : ''}`);
					if (url.pathname.endsWith('/changes.json')) return Response.json(overlay);
					if (request.headers.get('if-none-match') === '"built"') return new Response(null, { status: 304 });
					return new Response('<main><div data-nation-slot="top"></div></main>', { headers: { 'content-type': 'text/html', etag: '"built"' } });
				}
			}
		};
	}

	it('leaves other pages alone, and sends nation pages with no changes on as built unless something on them is restricted', async () => {
		const { worker, seen } = fakeWorker({ stamp: null, slots: {} });
		const wrapped = withNationPageChanges(worker, FakeRewriter);
		expect((wrapped.scheduled as () => string)()).toBe('kept');
		await wrapped.fetch(new Request('https://site.example/stories'), {}, {});
		const response = await wrapped.fetch(new Request('https://site.example/nations/navajo-nation', { headers: { 'if-none-match': '"built"' } }), {}, {});
		expect(response.status).toBe(304);
		expect(seen).toEqual(['/stories', '/nations/navajo-nation/changes.json', '/restricted-pages/nations/navajo-nation (conditional)']);
	});

	it('fills the slots and gives the page an ETag that changes with the nation’s changes', async () => {
		const { worker } = fakeWorker({ stamp: 'abc', slots: { top: '<section>Ours</section>' } });
		const wrapped = withNationPageChanges(worker, FakeRewriter);
		const response = await wrapped.fetch(new Request('https://site.example/nations/navajo-nation', { headers: { 'if-none-match': '"built"' } }), {}, {});
		expect(response.status).toBe(200);
		expect(await response.text()).toBe('<main><div data-nation-slot="top"><section>Ours</section></div></main>');
		expect(response.headers.get('etag')).toBe('W/"nation-abc-built"');
		const again = await wrapped.fetch(new Request('https://site.example/nations/navajo-nation', { headers: { 'if-none-match': 'W/"nation-abc-built"' } }), {}, {});
		expect(again.status).toBe(304);
	});

	it('runs the Worker first for nation pages and wraps whatever entry the build made', () => {
		expect(wrappedConfig({ main: 'scheduled-entry.js', assets: { binding: 'ASSETS', directory: '../client' } })).toEqual({
			main: 'nation-pages-entry.js',
			assets: { binding: 'ASSETS', directory: '../client', run_worker_first: workerFirstPaths }
		});
		expect(workerFirstPaths).toContain('/search/records.json');
		expect(entrySource('scheduled-entry.js')).toContain(`import worker from './scheduled-entry.js';`);
	});
});
