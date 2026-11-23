import { error } from '@sveltejs/kit';
import { messageCopy } from '#lib/server/mail/export.ts';
import { mailContext } from '#lib/server/mail/runtime.ts';
import { requirePermission } from '#lib/server/workspace.ts';
import { saveAs } from '../../../download.ts';
import type { RequestHandler } from './$types';

// One message as an .eml file, the whole message as it arrived or was sent,
// which any mail program opens (src/lib/server/mail/export.ts).
export const prerender = false;

export const GET: RequestHandler = async (event) => {
	requirePermission(event, 'read-mail');
	const copy = await messageCopy(mailContext(), event.params.message);
	if (copy.state === 'missing') error(404, 'No copy of this message is kept, so it cannot be exported.');
	if (copy.state === 'held') error(403, `Not yet: ${copy.files.join(', ')} ${copy.files.length === 1 ? 'is' : 'are'} still held for the virus check.`);
	return new Response(copy.bytes, {
		headers: {
			'content-type': 'message/rfc822',
			'content-disposition': saveAs(copy.filename),
			'cache-control': 'private, no-store',
			'x-content-type-options': 'nosniff'
		}
	});
};
