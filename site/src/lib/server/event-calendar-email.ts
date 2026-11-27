/**
 * Emails about events: confirmations, waitlist offers, reminders, and word of
 * a change or a cancellation. They are transactional mail, sent only to
 * people about events they registered for, so they go through Cloudflare
 * Email Service like the summaries of followed pages (Cloudflare, "Email
 * Sending Workers API",
 * developers.cloudflare.com/email-service/api/send-emails/workers-api/).
 *
 * They use the same switch as those summaries, UPDATE_EMAIL_FROM: while it is
 * empty, which it stays until the project has a domain, nothing is sent, and
 * people see where they stand on the event's page.
 */
import { attendanceLabels, eventMoment, eventWhen } from '#lib/event-calendar.ts';
import type { UpdateEmailBinding } from './following-email.ts';
import { siteAddress } from './following-email.ts';
import {
	claimMessage,
	clearOldAccessNeeds,
	dueMessages,
	expireOffers,
	offerAllFreeSeats,
	releaseMessage,
	type DueMessage
} from './event-calendar.ts';
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { syncRoomRecordings } from './video-rooms.ts';
import { videoRoomSettings } from './realtime-kit.ts';

export interface EventEmail {
	to: string;
	subject: string;
	text: string;
}

export type EventEmailDelivery = { kind: 'email'; site: string; send: (email: EventEmail) => Promise<void> } | { kind: 'off'; reason: string };

/** Whether the site can send event emails now, and how. */
export function eventEmailDelivery(environment: WorkerEnvironment): EventEmailDelivery {
	const from = environment.UPDATE_EMAIL_FROM?.trim();
	const binding: UpdateEmailBinding | undefined = environment.updateEmail;
	const site = siteAddress(environment);
	if (!from) return { kind: 'off', reason: 'UPDATE_EMAIL_FROM is not set (the project has no domain yet).' };
	if (!binding) return { kind: 'off', reason: 'The updateEmail binding is missing.' };
	if (!site) return { kind: 'off', reason: 'SITE_ADDRESS is not set to an https address.' };
	return {
		kind: 'email',
		site,
		send: async (email) => {
			await binding.send({ to: email.to, from: { email: from, name: 'Tribal Law Project' }, subject: email.subject, text: email.text });
		}
	};
}

function placeLines(message: DueMessage): string[] {
	const { event, attendance } = message;
	if (attendance === 'online') {
		return event.onlineLink
			? [`Join online: ${event.onlineLink}`, 'This link is for you; please do not post it.']
			: ['The link to join online will be on the event page before it starts.'];
	}
	const place = [event.venueName, event.venueAddress].filter(Boolean).join(', ');
	return place ? [`Where: ${place}`] : [];
}

/** The text of one email. */
export function eventMessage(message: DueMessage, site: string): EventEmail {
	const { event, registration, kind } = message;
	const page = `${site}/events/${event.slug}`;
	const when = eventWhen(event.startsAt, event.endsAt, event.timeZone);
	const seat = `${message.ticketName} (${attendanceLabels[message.attendance].toLowerCase()})`;
	const calendar = `Add it to your calendar: ${page}/calendar.ics`;
	const footer = [
		'',
		`Your registration and the event's details: ${page}`,
		'You get this email because you registered for this event on the Tribal Law Project website.'
	];
	const greeting = `Hello ${registration.name},`;
	let subject: string;
	let body: string[];
	switch (kind) {
		case 'registered':
			subject = `You're registered: ${event.title}`;
			body = [greeting, '', `You have a seat at ${event.title}: ${seat}.`, '', `When: ${when}`, ...placeLines(message), '', calendar];
			break;
		case 'waitlisted':
			subject = `You're on the waitlist: ${event.title}`;
			body = [
				greeting,
				'',
				`The ${message.ticketName.toLowerCase()} seats for ${event.title} are taken, so you are on the waitlist.`,
				'If a seat opens, we will email you, and you will have up to 48 hours to take it.',
				'',
				`When: ${when}`
			];
			break;
		case 'offered':
			subject = `A seat opened for you: ${event.title}`;
			body = [
				greeting,
				'',
				`A seat opened at ${event.title}: ${seat}.`,
				`It is held for you until ${eventMoment(registration.offerExpiresAt ?? event.startsAt, event.timeZone)}. To take it, open the event page and choose "Take the seat":`,
				page,
				'',
				`When: ${when}`
			];
			break;
		case 'day-before':
			subject = `Tomorrow: ${event.title}`;
			body = [greeting, '', `A reminder that ${event.title} is coming up.`, '', `When: ${when}`, ...placeLines(message)];
			break;
		case 'starting-soon':
			subject = `Starting soon: ${event.title}`;
			body = [greeting, '', `${event.title} starts soon.`, '', `When: ${when}`, ...placeLines(message)];
			break;
		case 'changed':
			subject = `Changed: ${event.title}`;
			body = [
				greeting,
				'',
				`The time or place of ${event.title} has changed. Here it is now:`,
				'',
				`When: ${when}`,
				...placeLines(message),
				'',
				`If you added it to your calendar, add it again to update it: ${page}/calendar.ics`,
				'If you can no longer come, please cancel on the event page so someone else can have your seat.'
			];
			break;
		case 'cancelled':
			subject = `Cancelled: ${event.title}`;
			body = [greeting, '', `We're sorry: ${event.title}, planned for ${when}, is cancelled.`, ...(event.cancelNote ? ['', event.cancelNote] : [])];
			break;
	}
	return { to: message.email, subject, text: [...body, ...footer].join('\n') };
}

/** Sends every email due now, each once. */
export async function sendDueEventMessages(
	database: D1Database,
	delivery: EventEmailDelivery,
	time: Date = new Date()
): Promise<{ sent: number; failed: number; delivery: string }> {
	if (delivery.kind === 'off') return { sent: 0, failed: 0, delivery: delivery.reason };
	let sent = 0;
	let failed = 0;
	for (const message of await dueMessages(database, time)) {
		if (!(await claimMessage(database, message, time))) continue;
		try {
			await delivery.send(eventMessage(message, delivery.site));
			sent += 1;
		} catch {
			await releaseMessage(database, message);
			failed += 1;
		}
	}
	return { sent, failed, delivery: 'email' };
}

/**
 * The hourly events run (wrangler.jsonc, "triggers"): lets lapsed offers go,
 * offers free seats to the waitlist, sends what is due and empties access
 * needs kept past their time.
 */
export async function eventCalendarRun(environment: WorkerEnvironment, time: Date = new Date()) {
	const database = environment.database;
	if (!database) return { skipped: 'The database is not connected.' };
	const lapsed = await expireOffers(database, time);
	const offered = await offerAllFreeSeats(database, time);
	const email = await sendDueEventMessages(database, eventEmailDelivery(environment), time);
	const accessNeedsCleared = await clearOldAccessNeeds(database, time);
	// The video rooms' recordings, events' and rooms' of their own (site/COLLABORATION.md, "The video room"): off until its settings are added.
	const settings = videoRoomSettings(environment);
	const recordings = settings && environment.sourceDocuments
		? await syncRoomRecordings({ database, bucket: environment.sourceDocuments, settings }, time)
		: { skipped: 'The video room is not set up.' };
	return { lapsed, offered, ...email, accessNeedsCleared, recordings };
}
