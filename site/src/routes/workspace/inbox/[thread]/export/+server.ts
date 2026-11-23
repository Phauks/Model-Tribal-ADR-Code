import { error } from '@sveltejs/kit';
import { conversationExport } from '#lib/server/mail/export.ts';
import { mailContext } from '#lib/server/mail/runtime.ts';
import { saveAs } from '../../download.ts';
import type { RequestHandler } from './$types';
import { requireThread } from '#lib/server/mail/inbox-access.ts';

// A whole conversation as an .mbox file, which mail programs such as
// Thunderbird and Apple Mail import (src/lib/server/mail/export.ts).
export const prerender = false;

export const GET: RequestHandler = async (event) => {
	await requireThread(event, event.params.thread);
	const exported = await conversationExport(mailContext(), event.params.thread);
	if (exported.state === 'missing') error(404, 'This conversation has no kept messages to export.');
	if (exported.state === 'held') error(403, `Not yet: ${exported.files.join(', ')} ${exported.files.length === 1 ? 'is' : 'are'} still held for the virus check.`);
	return new Response(exported.bytes, {
		headers: {
			'content-type': 'application/mbox',
			'content-disposition': saveAs(exported.filename),
			'cache-control': 'private, no-store',
			'x-content-type-options': 'nosniff'
		}
	});
};
