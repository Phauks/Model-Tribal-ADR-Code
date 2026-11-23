/**
 * Builds a raw email message (RFC 5322 with MIME, RFC 2045 to 2047) from
 * the parts the inbox writes: plain text, the matching HTML, attachments
 * and headers. Used for mail sent over SMTP, and for the copy of every sent
 * message kept in the bucket.
 */
import { formatAddress, type MailAddress } from '#lib/mail.ts';

export interface OutgoingAttachment {
	filename: string;
	mediaType: string;
	content: Uint8Array;
	/** Set for a picture shown inside the HTML part. */
	contentId?: string;
}

export interface OutgoingMail {
	from: MailAddress;
	to: MailAddress[];
	cc?: MailAddress[];
	bcc?: MailAddress[];
	replyTo?: MailAddress | null;
	subject: string;
	text: string;
	html?: string | null;
	/** Extra headers, such as In-Reply-To, References and List-Unsubscribe. */
	headers?: Record<string, string>;
	attachments?: OutgoingAttachment[];
	/** The Message-ID to use, without angle brackets. */
	messageId: string;
	date?: Date;
}

const encoder = new TextEncoder();

function base64(bytes: Uint8Array): string {
	let binary = '';
	for (let index = 0; index < bytes.length; index += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
	}
	return btoa(binary);
}

/** Base64 in lines of 76 characters, as MIME requires. */
function base64Lines(bytes: Uint8Array): string {
	return (base64(bytes).match(/.{1,76}/g) ?? ['']).join('\r\n');
}

/** A header value that is safe as it is, or an RFC 2047 encoded word when it has other characters. */
export function encodeHeaderText(value: string): string {
	const clean = value.replace(/[\r\n]+/g, ' ');
	if (/^[\x20-\x7e]*$/.test(clean)) return clean;
	// Encoded words may be at most 75 characters; split the UTF-8 bytes on character boundaries.
	const words: string[] = [];
	let chunk = '';
	for (const character of clean) {
		if (encoder.encode(chunk + character).length > 45) {
			words.push(`=?UTF-8?B?${base64(encoder.encode(chunk))}?=`);
			chunk = '';
		}
		chunk += character;
	}
	if (chunk) words.push(`=?UTF-8?B?${base64(encoder.encode(chunk))}?=`);
	return words.join('\r\n ');
}

function encodeAddress(address: MailAddress): string {
	if (!address.name) return address.email;
	const name = /^[\x20-\x7e]*$/.test(address.name)
		? `"${address.name.replace(/["\\]/g, '\\$&')}"`
		: encodeHeaderText(address.name);
	return `${name} <${address.email}>`;
}

function addressList(addresses: MailAddress[]): string {
	return addresses.map(encodeAddress).join(',\r\n ');
}

function boundary(label: string): string {
	return `----=_${label}_${crypto.randomUUID().replaceAll('-', '')}`;
}

function textPart(mediaType: string, body: string): string {
	return [
		`Content-Type: ${mediaType}; charset=utf-8`,
		'Content-Transfer-Encoding: base64',
		'',
		base64Lines(encoder.encode(body.replace(/\r?\n/g, '\r\n')))
	].join('\r\n');
}

function attachmentPart(attachment: OutgoingAttachment): string {
	const filename = encodeHeaderText(attachment.filename).replace(/"/g, '');
	return [
		`Content-Type: ${attachment.mediaType}; name="${filename}"`,
		'Content-Transfer-Encoding: base64',
		attachment.contentId
			? `Content-Disposition: inline; filename="${filename}"\r\nContent-ID: <${attachment.contentId}>`
			: `Content-Disposition: attachment; filename="${filename}"`,
		'',
		base64Lines(attachment.content)
	].join('\r\n');
}

function multipart(kind: string, parts: string[]): string {
	const mark = boundary(kind);
	return [
		`Content-Type: multipart/${kind}; boundary="${mark}"`,
		'',
		...parts.map((part) => `--${mark}\r\n${part}`),
		`--${mark}--`
	].join('\r\n');
}

/** Headers that the message builder writes itself and a caller may not override. */
const ownHeaders = new Set([
	'from',
	'to',
	'cc',
	'bcc',
	'subject',
	'date',
	'message-id',
	'mime-version',
	'content-type',
	'content-transfer-encoding',
	'reply-to'
]);

/**
 * The whole message as text with CRLF line endings. Bcc is never written
 * into the message; it is only an envelope recipient.
 */
export function buildRawMessage(mail: OutgoingMail): string {
	const headers: string[] = [
		`From: ${encodeAddress(mail.from)}`,
		`To: ${addressList(mail.to)}`,
		...(mail.cc?.length ? [`Cc: ${addressList(mail.cc)}`] : []),
		...(mail.replyTo ? [`Reply-To: ${encodeAddress(mail.replyTo)}`] : []),
		`Subject: ${encodeHeaderText(mail.subject)}`,
		`Date: ${(mail.date ?? new Date()).toUTCString().replace('GMT', '+0000')}`,
		`Message-ID: <${mail.messageId}>`,
		'MIME-Version: 1.0'
	];
	for (const [name, value] of Object.entries(mail.headers ?? {})) {
		if (ownHeaders.has(name.toLowerCase()) || !/^[A-Za-z0-9-]+$/.test(name)) continue;
		headers.push(`${name}: ${value.replace(/[\r\n]+/g, ' ')}`);
	}
	const alternative = mail.html
		? multipart('alternative', [textPart('text/plain', mail.text), textPart('text/html', mail.html)])
		: textPart('text/plain', mail.text);
	const body = mail.attachments?.length
		? multipart('mixed', [alternative, ...mail.attachments.map(attachmentPart)])
		: alternative;
	return `${headers.join('\r\n')}\r\n${body}\r\n`;
}

/** A new Message-ID on the sending domain, without angle brackets. */
export function newMessageId(domain: string): string {
	return `${crypto.randomUUID()}@${domain}`;
}

/** The headers as a mail program would show them, for the archived copy's summary. */
export function describeAddresses(addresses: MailAddress[]): string {
	return addresses.map(formatAddress).join(', ');
}
