// Reading the compose and reply forms (src/routes/workspace/inbox).
import { zonedTimeToUtc } from '#lib/mail.ts';

/** The time zone the person's browser reports, sent with the form; Mountain time when missing. */
export function zoneFromForm(form: FormData): string {
	const zone = form.get('zone');
	if (typeof zone === 'string' && /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(zone)) {
		try {
			new Intl.DateTimeFormat('en-US', { timeZone: zone });
			return zone;
		} catch {
			// Not a time zone this runtime knows.
		}
	}
	return 'America/Denver';
}

/** A date and time typed in a datetime-local box, in the person's time zone, as UTC; null when empty. */
export function whenFromForm(form: FormData, name: string): string | null {
	const value = form.get(name);
	if (typeof value !== 'string' || value.trim() === '') return null;
	return zonedTimeToUtc(value, zoneFromForm(form));
}

/** Files chosen in the form's attachment box. */
export async function readAttachments(form: FormData): Promise<{ filename: string; mediaType: string; content: Uint8Array }[]> {
	const files: { filename: string; mediaType: string; content: Uint8Array }[] = [];
	for (const value of form.getAll('attachments')) {
		if (typeof value === 'string' || value.size === 0) continue;
		files.push({
			filename: value.name.replace(/[\r\n"]/g, ' ').slice(0, 200) || 'attachment',
			mediaType: value.type || 'application/octet-stream',
			content: new Uint8Array(await value.arrayBuffer())
		});
	}
	return files;
}
