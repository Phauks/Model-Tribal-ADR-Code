import { describe, expect, it } from 'vitest';
import {
	asksToStop,
	fillTemplate,
	missingFields,
	normalizeSubject,
	parseAddressList,
	quoteForReply,
	replySubject,
	snippetOf,
	textToHtml,
	unknownFields,
	zonedTimeToUtc
} from '#lib/mail.ts';
import { cloudflareCarrier, smtpCarrier, type EmailSendBinding } from '#lib/server/mail/carriers.ts';
import { htmlToText } from '#lib/server/mail/inbound.ts';
import { buildRawMessage, encodeHeaderText } from '#lib/server/mail/mime.ts';
import { mailSettings } from '#lib/server/mail/settings.ts';
import { dotStuff, sendOverSmtp, SmtpError, type SmtpSocket } from '#lib/server/mail/smtp.ts';
import { makeToken, readToken, unsubscribeAddressToken } from '#lib/server/mail/tokens.ts';
import { testSettings } from './mail-fixtures.ts';

describe('the inbox’s small helpers', () => {
	it('threads subjects without Re:, Fwd: and list tags', () => {
		expect(normalizeSubject('Re: RE: Fwd: [Council] Our code  question')).toBe('our code question');
		expect(normalizeSubject('AW: Sv: Antw: Hello')).toBe('hello');
		expect(replySubject('Re: Hello')).toBe('Re: Hello');
		expect(replySubject('Hello')).toBe('Re: Hello');
	});

	it('reads typed address lists and reports what is not an address', () => {
		const { addresses, invalid } = parseAddressList('Office <Office@Example.org>; second@example.org,\nnot an address, office@example.org');
		expect(addresses).toEqual([
			{ email: 'office@example.org', name: 'Office' },
			{ email: 'second@example.org', name: null }
		]);
		expect(invalid).toEqual(['not an address']);
	});

	it('flags a reply whose own first line asks to stop, not one that quotes the word', () => {
		expect(asksToStop('STOP')).toBe(true);
		expect(asksToStop('\nPlease remove me.\n\n> earlier message')).toBe(true);
		expect(asksToStop('Do not email us again!')).toBe(true);
		expect(asksToStop('We will stop by the office next week.')).toBe(false);
		expect(asksToStop('Thanks\n> reply stop to unsubscribe')).toBe(false);
	});

	it('fills merge fields and names missing and unknown ones', () => {
		const template = 'Dear {{ contact.greeting }}, about {{nation.name}} and {{nation.motto}}.';
		expect(unknownFields(template)).toEqual(['nation.motto']);
		expect(missingFields(template, { 'contact.greeting': 'Chairman Begay' })).toEqual(['nation.name', 'nation.motto']);
		expect(fillTemplate(template, { 'contact.greeting': 'Chairman Begay', 'nation.name': 'Example Nation' })).toBe(
			'Dear Chairman Begay, about Example Nation and .'
		);
	});

	it('makes HTML that says no more than the text, with links and nothing unescaped', () => {
		const html = textToHtml('Hello <b>there</b>\nSee https://example.org/page.\n\nBye');
		expect(html).toContain('<p>Hello &#60;b&#62;there&#60;/b&#62;<br>See <a href="https://example.org/page">https://example.org/page</a>.</p>');
		expect(html).toContain('<p>Bye</p>');
	});

	it('leaves quoted lines out of the preview, and quotes a reply', () => {
		expect(snippetOf('Thanks!\n> old text\nMore')).toBe('Thanks! More');
		expect(quoteForReply('One\nTwo', 'Office', '2026-11-23T15:00:00Z')).toBe('\n\nOn Nov 23, 2026, 3:00 PM UTC, Office wrote:\n> One\n> Two\n');
	});

	it('reads a message sent only as HTML as plain text', () => {
		expect(htmlToText('<style>p{}</style><p>Hello, could you tell us about <b>peacemaking</b>?</p><p>Tom &amp; Ann<br>Office</p>')).toBe(
			'Hello, could you tell us about peacemaking?\nTom & Ann\nOffice'
		);
	});

	it('reads a typed time in the person’s own time zone', () => {
		expect(zonedTimeToUtc('2026-11-24T09:30', 'America/Denver')).toBe('2026-11-24T16:30:00.000Z');
		expect(zonedTimeToUtc('2026-07-01T09:00', 'America/Denver')).toBe('2026-07-01T15:00:00.000Z');
		expect(zonedTimeToUtc('2026-11-24T09:30', 'America/Phoenix')).toBe('2026-11-24T16:30:00.000Z');
		expect(zonedTimeToUtc('tomorrow', 'America/Denver')).toBeNull();
	});
});

describe('settings', () => {
	it('keeps email off until the domain is set, and outreach off until its service is', () => {
		expect(mailSettings({ MAIL_DOMAIN: '' } as WorkerEnvironment).domain).toBeNull();
		const settings = mailSettings({
			MAIL_DOMAIN: 'Example.org',
			OUTREACH_CARRIER: 'smtp',
			OUTREACH_FROM: 'outreach@outreach.example.org',
			OUTREACH_SMTP_HOST: 'smtppro.zoho.com',
			OUTREACH_SMTP_PORT: '587'
		} as WorkerEnvironment);
		expect(settings.domain).toBe('example.org');
		expect(settings.outreach).toBeNull();
		const withPassword = mailSettings({
			MAIL_DOMAIN: 'example.org',
			OUTREACH_CARRIER: 'smtp',
			OUTREACH_FROM: 'outreach@outreach.example.org',
			OUTREACH_SMTP_HOST: 'smtppro.zoho.com',
			OUTREACH_SMTP_PORT: '587',
			OUTREACH_SMTP_PASSWORD: 'app-password'
		} as WorkerEnvironment);
		expect(withPassword.outreach).toMatchObject({ port: 587, security: 'starttls', username: 'outreach@outreach.example.org' });
	});
});

describe('signed tokens', () => {
	const key = 'a-signing-key';
	const identifier = '3f2b8c4e-1d2a-4b5c-9e8f-0a1b2c3d4e5f';

	it('name a row, and only with the right key and kind', async () => {
		const token = await makeToken(key, 'unsubscribe', identifier);
		expect(token).toMatch(/^[a-z2-7]+$/);
		expect(await readToken(key, 'unsubscribe', token)).toBe(identifier);
		expect(await readToken(key, 'unsubscribe', token.toUpperCase())).toBe(identifier);
		expect(await readToken('another-key', 'unsubscribe', token)).toBeNull();
		expect(await readToken(key, 'acknowledge', token)).toBeNull();
		const changed = token.slice(0, 5) + (token[5] === 'a' ? 'b' : 'a') + token.slice(6);
		expect(await readToken(key, 'unsubscribe', changed)).toBeNull();
	});

	it('fit in an address’s local part', async () => {
		const token = await makeToken(key, 'unsubscribe', identifier);
		const address = `unsubscribe+${token}@example.org`;
		expect(address.split('@')[0].length).toBeLessThanOrEqual(64);
		expect(unsubscribeAddressToken(address)).toBe(token);
		expect(unsubscribeAddressToken('contact@example.org')).toBeNull();
	});
});

describe('raw messages', () => {
	it('never write Bcc, and encode names and subjects outside ASCII', () => {
		const raw = buildRawMessage({
			from: { email: 'contact@example.org', name: 'Model Tribal ADR Code' },
			to: [{ email: 'office@nation.example', name: 'Diné Office' }],
			bcc: [{ email: 'hidden@example.org' }],
			subject: 'Yá’át’ééh and welcome',
			text: 'Line one\n.Line with a dot',
			html: '<p>Line one</p>',
			headers: { 'In-Reply-To': '<a@b>', Bcc: 'sneaky@example.org', 'Bad Header': 'x' },
			attachments: [{ filename: 'notes.txt', mediaType: 'text/plain', content: new TextEncoder().encode('hello') }],
			messageId: 'id-1@example.org',
			date: new Date('2026-11-23T12:00:00Z')
		});
		expect(raw).not.toMatch(/hidden@example\.org|sneaky/);
		expect(raw).not.toContain('Bad Header');
		expect(raw).toContain('In-Reply-To: <a@b>');
		expect(raw).toContain('Subject: =?UTF-8?B?');
		expect(raw).toContain('To: =?UTF-8?B?');
		expect(raw).toContain('multipart/mixed');
		expect(raw).toContain('multipart/alternative');
		expect(raw).toContain('Content-Disposition: attachment; filename="notes.txt"');
		expect(raw).toContain('Message-ID: <id-1@example.org>');
		expect(raw.split('\r\n').every((line) => line.length <= 998)).toBe(true);
	});

	it('splits long encoded words', () => {
		const encoded = encodeHeaderText('ā'.repeat(60));
		expect(encoded.split('\r\n ').every((word) => word.length <= 75)).toBe(true);
	});
});

/** A pretend SMTP server: answers each command from a script and records what it was sent. */
function fakeServer(answers: (command: string) => string | null, greeting = '220 smtp.example.net ready') {
	const received: string[] = [];
	let push: (text: string) => void = () => {};
	const readable = new ReadableStream<Uint8Array>({
		start(controller) {
			push = (text) => controller.enqueue(new TextEncoder().encode(text));
			push(`${greeting}\r\n`);
		}
	});
	let pending = '';
	let inData = false;
	const writable = new WritableStream<Uint8Array>({
		write(chunk) {
			pending += new TextDecoder().decode(chunk);
			for (;;) {
				if (inData) {
					const end = pending.indexOf('\r\n.\r\n');
					if (end === -1) return;
					received.push(`DATA:${pending.slice(0, end)}`);
					pending = pending.slice(end + 5);
					inData = false;
					push('250 2.0.0 Ok: queued\r\n');
					continue;
				}
				const end = pending.indexOf('\r\n');
				if (end === -1) return;
				const line = pending.slice(0, end);
				pending = pending.slice(end + 2);
				received.push(line);
				const answer = answers(line);
				if (answer === '354') inData = true;
				if (answer) push(`${answer === '354' ? '354 End data with <CR><LF>.<CR><LF>' : answer}\r\n`);
			}
		}
	});
	const socket: SmtpSocket = { readable, writable, close: async () => {} };
	return { socket, received };
}

describe('SMTP submission for outreach', () => {
	const connection = { host: 'smtp.example.net', port: 465, security: 'tls' as const, username: 'user@example.org', password: 'secret', clientName: 'example.org' };

	it('signs in, names the envelope, and sends the message with dots doubled', async () => {
		const server = fakeServer((line) => {
			if (line.startsWith('EHLO')) return '250-smtp.example.net\r\n250 AUTH PLAIN LOGIN';
			if (line.startsWith('AUTH PLAIN')) return '235 2.7.0 Authentication successful';
			if (line.startsWith('MAIL FROM') || line.startsWith('RCPT TO')) return '250 Ok';
			if (line === 'DATA') return '354';
			if (line === 'QUIT') return '221 Bye';
			return '500 What?';
		});
		await sendOverSmtp(() => server.socket, connection, { from: 'user@example.org', recipients: ['a@nation.example', 'b@nation.example'] }, 'Subject: Hi\r\n\r\n.hidden dot\r\nEnd\r\n');
		expect(server.received[0]).toBe('EHLO example.org');
		expect(server.received[1]).toBe(`AUTH PLAIN ${btoa('\0user@example.org\0secret')}`);
		expect(server.received).toContain('RCPT TO:<b@nation.example>');
		expect(server.received.find((line) => line.startsWith('DATA:'))).toBe('DATA:Subject: Hi\r\n\r\n..hidden dot\r\nEnd');
	});

	it('reports a refused sign-in as permanent', async () => {
		const server = fakeServer((line) => (line.startsWith('EHLO') ? '250 smtp.example.net' : line.startsWith('AUTH') ? '535 5.7.8 Authentication failed' : null));
		const attempt = sendOverSmtp(() => server.socket, connection, { from: 'user@example.org', recipients: ['a@nation.example'] }, 'x');
		await expect(attempt).rejects.toBeInstanceOf(SmtpError);
		await expect(attempt).rejects.toMatchObject({ code: 535, permanent: true });
	});

	it('doubles leading dots on every line', () => {
		expect(dotStuff('.a\n..b\nc.')).toBe('..a\r\n...b\r\nc.');
	});
});

describe('carriers', () => {
	it('send through Cloudflare with only the headers Cloudflare allows', async () => {
		const calls: Parameters<EmailSendBinding['send']>[0][] = [];
		const carrier = cloudflareCarrier({
			async send(message) {
				calls.push(message);
				return { messageId: '<abc@cloudflare.example>' };
			}
		});
		const sent = await carrier.send({
			from: { email: 'contact@example.org', name: 'Project' },
			to: [{ email: 'office@nation.example' }],
			subject: 'Re: Hello',
			text: 'Thanks',
			headers: { 'In-Reply-To': '<x@y>', 'X-Project-Inbox-Notice': 'yes', Sender: 'not allowed' },
			messageId: 'ours@example.org'
		});
		expect(sent).toEqual({ messageId: 'abc@cloudflare.example', providerMessageId: 'abc@cloudflare.example' });
		expect(calls[0].headers).toEqual({ 'In-Reply-To': '<x@y>', 'X-Project-Inbox-Notice': 'yes' });
		expect(calls[0].from).toEqual({ email: 'contact@example.org', name: 'Project' });
	});

	it('send outreach over SMTP with every recipient in the envelope', async () => {
		const server = fakeServer((line) => {
			if (line.startsWith('EHLO')) return '250 ok';
			if (line.startsWith('AUTH')) return '235 ok';
			if (line.startsWith('MAIL') || line.startsWith('RCPT')) return '250 ok';
			if (line === 'DATA') return '354';
			return '221 bye';
		});
		const opened: string[] = [];
		const carrier = smtpCarrier(testSettings().outreach!, (host, port, security) => {
			opened.push(`${host}:${port}:${security}`);
			return server.socket;
		}, 'example.org');
		const sent = await carrier.send({
			from: { email: 'outreach@outreach.example.org' },
			to: [{ email: 'office@nation.example' }],
			bcc: [{ email: 'copy@example.org' }],
			subject: 'Hello',
			text: 'Body',
			messageId: 'm1@outreach.example.org'
		});
		expect(opened).toEqual(['smtp.example.net:465:tls']);
		expect(server.received).toContain('RCPT TO:<copy@example.org>');
		expect(sent).toEqual({ messageId: 'm1@outreach.example.org', providerMessageId: null });
	});
});
