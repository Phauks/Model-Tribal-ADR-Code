/**
 * A small SMTP client for sending one message through a mailbox provider's
 * submission server (RFC 5321, AUTH PLAIN from RFC 4616), over a TCP socket
 * from the Worker (Cloudflare, "TCP sockets",
 * developers.cloudflare.com/workers/runtime-apis/tcp-sockets/). Workers may
 * not use port 25, so this is for authenticated submission on port 465 (TLS
 * from the start) or 587 (STARTTLS).
 *
 * The socket is passed in, so tests can play the server's part.
 */

export interface SmtpSocket {
	readable: ReadableStream<Uint8Array>;
	writable: WritableStream<Uint8Array>;
	close(): Promise<void>;
	/** Upgrades the connection to TLS after STARTTLS. */
	startTls?(): SmtpSocket;
}

export interface SmtpConnection {
	host: string;
	port: number;
	security: 'tls' | 'starttls';
	username: string;
	password: string;
	/** The name this side gives in EHLO. */
	clientName: string;
}

export type SocketOpener = (host: string, port: number, security: 'tls' | 'starttls') => SmtpSocket | Promise<SmtpSocket>;

export class SmtpError extends Error {
	constructor(
		message: string,
		readonly code: number,
		/** A 5xx reply is permanent; anything else may work if tried later. */
		readonly permanent: boolean
	) {
		super(message);
	}
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

class Conversation {
	private reader: ReadableStreamDefaultReader<Uint8Array>;
	private writer: WritableStreamDefaultWriter<Uint8Array>;
	private buffer = '';

	constructor(private socket: SmtpSocket) {
		this.reader = socket.readable.getReader();
		this.writer = socket.writable.getWriter();
	}

	/** Reads one reply, which may run over several lines ("250-..." then "250 ..."). */
	async reply(): Promise<{ code: number; text: string }> {
		const lines: string[] = [];
		for (;;) {
			const end = this.buffer.indexOf('\r\n');
			if (end === -1) {
				const { value, done } = await this.reader.read();
				if (done) throw new SmtpError('The mail server closed the connection.', 0, false);
				this.buffer += decoder.decode(value, { stream: true });
				continue;
			}
			const line = this.buffer.slice(0, end);
			this.buffer = this.buffer.slice(end + 2);
			lines.push(line);
			if (/^\d{3} /.test(line) || /^\d{3}$/.test(line)) {
				return { code: Number(line.slice(0, 3)), text: lines.map((item) => item.slice(4)).join('\n') };
			}
		}
	}

	async send(line: string): Promise<void> {
		await this.writer.write(encoder.encode(`${line}\r\n`));
	}

	async expect(codes: number[], step: string): Promise<{ code: number; text: string }> {
		const answer = await this.reply();
		if (!codes.includes(answer.code)) {
			throw new SmtpError(`${step}: ${answer.code} ${answer.text}`, answer.code, answer.code >= 500);
		}
		return answer;
	}

	async command(line: string, codes: number[], step: string): Promise<{ code: number; text: string }> {
		await this.send(line);
		return this.expect(codes, step);
	}

	/** Switches to a TLS connection after STARTTLS, keeping the conversation. */
	upgrade(): void {
		if (!this.socket.startTls) throw new SmtpError('This connection cannot start TLS.', 0, true);
		this.reader.releaseLock();
		this.writer.releaseLock();
		this.socket = this.socket.startTls();
		this.reader = this.socket.readable.getReader();
		this.writer = this.socket.writable.getWriter();
		this.buffer = '';
	}

	async close(): Promise<void> {
		try {
			this.reader.releaseLock();
			this.writer.releaseLock();
		} catch {
			// expected: already released.
		}
		await this.socket.close().catch(() => /* expected: the connection is ending either way */ undefined);
	}
}

/** The message body with each line that starts with a dot doubled (RFC 5321, section 4.5.2). */
export function dotStuff(raw: string): string {
	return raw
		.replace(/\r?\n/g, '\r\n')
		.split('\r\n')
		.map((line) => (line.startsWith('.') ? `.${line}` : line))
		.join('\r\n');
}

function plainAuth(username: string, password: string): string {
	const bytes = encoder.encode(`\0${username}\0${password}`);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

/**
 * Sends one raw message. The envelope sender is the From address; the
 * recipients are every To, Cc and Bcc address.
 */
export async function sendOverSmtp(
	open: SocketOpener,
	connection: SmtpConnection,
	envelope: { from: string; recipients: string[] },
	raw: string
): Promise<void> {
	const conversation = new Conversation(await open(connection.host, connection.port, connection.security));
	try {
		await conversation.expect([220], 'Greeting');
		await conversation.command(`EHLO ${connection.clientName}`, [250], 'EHLO');
		if (connection.security === 'starttls') {
			await conversation.command('STARTTLS', [220], 'STARTTLS');
			conversation.upgrade();
			await conversation.command(`EHLO ${connection.clientName}`, [250], 'EHLO after STARTTLS');
		}
		await conversation.command(`AUTH PLAIN ${plainAuth(connection.username, connection.password)}`, [235], 'Sign-in');
		await conversation.command(`MAIL FROM:<${envelope.from}>`, [250], 'Sender');
		for (const recipient of envelope.recipients) {
			await conversation.command(`RCPT TO:<${recipient}>`, [250, 251], `Recipient ${recipient}`);
		}
		await conversation.command('DATA', [354], 'DATA');
		const body = dotStuff(raw);
		await conversation.send(`${body.endsWith('\r\n') ? body.slice(0, -2) : body}\r\n.`);
		await conversation.expect([250], 'Message');
		await conversation.send('QUIT').catch(() => /* expected: the message was accepted; quitting politely is a courtesy */ undefined);
	} finally {
		await conversation.close();
	}
}
