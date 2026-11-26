/**
 * Summary emails about followed pages, through Cloudflare Email Service
 * (Cloudflare, "Email Sending Workers API",
 * developers.cloudflare.com/email-service/api/send-emails/workers-api/).
 *
 * The switch is the UPDATE_EMAIL_FROM variable in wrangler.jsonc. While it is
 * empty, which it stays until the project's domain is bought and onboarded in
 * Email Service (docs/domain-to-do.md), nothing is sent and readers see
 * notices on the site only. Setting it, and nothing else, turns the emails on.
 * Links in the emails use SITE_ADDRESS, the site's public address.
 *
 * An email names each page and the day it changed, links to it and says
 * nothing else about it: never what changed, so it cannot carry text a nation
 * asked to have removed or restricted.
 */
import { readableDate } from '#lib/readable-date.ts';
import { followKindLabels, historyAddress } from '#lib/following.ts';
import type { Digest } from './following.ts';

export type UpdateEmailDelivery =
	| { kind: 'email'; send: (digest: Digest) => Promise<void> }
	| { kind: 'off'; reason: string };

/** The site's public address, without a trailing slash, or undefined when not set or not https. */
export function siteAddress(environment: Pick<WorkerEnvironment, 'SITE_ADDRESS'>): string | undefined {
	const value = environment.SITE_ADDRESS?.trim().replace(/\/+$/, '');
	if (!value) return undefined;
	try {
		const url = new URL(value);
		return url.protocol === 'https:' && url.pathname === '/' && !url.search && !url.hash ? url.origin : undefined;
	} catch {
		return undefined;
	}
}

/** Whether the site can send summary emails now, and how. */
export function updateEmailDelivery(environment: WorkerEnvironment): UpdateEmailDelivery {
	const from = environment.UPDATE_EMAIL_FROM?.trim();
	const binding = environment.updateEmail;
	const site = siteAddress(environment);
	if (!from) return { kind: 'off', reason: 'UPDATE_EMAIL_FROM is not set (the project has no domain yet).' };
	if (!binding) return { kind: 'off', reason: 'The updateEmail binding is missing.' };
	if (!site) return { kind: 'off', reason: 'SITE_ADDRESS is not set to an https address.' };
	return {
		kind: 'email',
		send: async (digest) => {
			const message = digestMessage(digest, site);
			await binding.send({
				to: digest.email,
				from: { email: from, name: 'Tribal Law Project' },
				subject: message.subject,
				text: message.text,
				headers: { 'List-Unsubscribe': `<${message.emailOffLink}>` }
			});
		}
	};
}

function dayOf(iso: string): string {
	return readableDate(iso.slice(0, 10));
}

/** The text of a summary email. */
export function digestMessage(digest: Digest, site: string): { subject: string; text: string; emailOffLink: string } {
	const count = digest.pages.length;
	const emailOffLink = `${site}/following/email-off?token=${encodeURIComponent(digest.emailOffToken)}`;
	const lines = [
		count === 1 ? 'A page you follow on the Tribal Law Project was updated:' : `${count} pages you follow on the Tribal Law Project were updated:`,
		''
	];
	for (const page of digest.pages) {
		lines.push(`${page.title} (${followKindLabels[page.kind]}), updated ${dayOf(page.updatedAt)}`);
		lines.push(`${site}${page.address}`);
		const history = historyAddress(page.kind, page.address);
		if (history) lines.push(`What changed: ${site}${history}`);
		lines.push('');
	}
	lines.push(
		`You get this ${digest.choice === 'weekly' ? 'weekly' : 'daily'} summary because you follow these pages.`,
		`Pages you follow and email settings: ${site}/following`,
		`Stop these emails: ${emailOffLink}`
	);
	return {
		subject: count === 1 ? `Updated: ${digest.pages[0].title}` : `${count} pages you follow were updated`,
		text: lines.join('\n'),
		emailOffLink
	};
}

/** The Email Service binding for summaries, which also takes headers (Cloudflare, "Email Sending Workers API"). */
export interface UpdateEmailBinding {
	send(message: {
		to: string;
		from: string | { email: string; name?: string };
		subject: string;
		text: string;
		headers?: Record<string, string>;
	}): Promise<{ messageId: string }>;
}
