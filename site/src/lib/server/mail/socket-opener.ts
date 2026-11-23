/**
 * Opens the TCP connection for outreach over SMTP, from the Worker
 * (Cloudflare, "TCP sockets"). The module is loaded only when a connection
 * is opened, because the site's build runs the server code in Node, where
 * "cloudflare:" modules do not exist.
 */
import type { SmtpSocket, SocketOpener } from './smtp.ts';

export const workerSocketOpener: SocketOpener = async (host, port, security) => {
	const { connect } = await import('cloudflare:sockets');
	return connect({ hostname: host, port }, { secureTransport: security === 'tls' ? 'on' : 'starttls', allowHalfOpen: false }) as SmtpSocket;
};
