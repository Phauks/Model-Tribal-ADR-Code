/**
 * The site's own video room for events, shared by the server and the pages
 * (migrations/20261123T0452_add_event_video_rooms.sql; decision record 0048,
 * "The video room").
 */
import type { RecordingChoice } from './event-calendar.ts';

export const roomStyles = ['webinar', 'discussion'] as const;
export type RoomStyle = (typeof roomStyles)[number];

export const roomStyleLabels: Record<RoomStyle, string> = {
	webinar: 'Speakers on a stage, everyone else watches and may ask to speak',
	discussion: 'Everyone may speak and show video'
};

export const recordingWatchers = ['hosts', 'registered', 'signed-in'] as const;
export type RecordingWatchers = (typeof recordingWatchers)[number];

export const recordingWatcherLabels: Record<RecordingWatchers, string> = {
	hosts: 'Only the people running events',
	registered: 'People who registered for the event',
	'signed-in': 'Anyone signed in to the website'
};

/** The room opens this long before the event starts, so speakers can check their camera and sound. */
export const roomOpensMinutesBefore = 30;
/** And closes this long after it is due to end, so a talk that runs over is not cut off. */
export const roomClosesMinutesAfter = 120;

/** Whether the room is open at this time. */
export function roomIsOpen(event: { startsAt: string; endsAt: string }, time: Date = new Date()): boolean {
	const opens = new Date(event.startsAt).getTime() - roomOpensMinutesBefore * 60_000;
	const closes = new Date(event.endsAt).getTime() + roomClosesMinutesAfter * 60_000;
	return time.getTime() >= opens && time.getTime() < closes;
}

/** When the room closes, for the participant's token: it stops working then. */
export function roomClosesAt(event: { endsAt: string }): Date {
	return new Date(new Date(event.endsAt).getTime() + roomClosesMinutesAfter * 60_000);
}

/**
 * What a person is told before joining, by the event's recording choice. A
 * person must agree to it to join a room that is, or may be, recorded.
 */
export function recordingNotice(choice: RecordingChoice, watchers: RecordingWatchers): { heading: string; text: string; needsAgreement: boolean } {
	const who = {
		hosts: 'only the people running the project’s events',
		registered: 'the people who registered for this event',
		'signed-in': 'anyone signed in to this website'
	}[watchers];
	switch (choice) {
		case 'recorded':
			return {
				heading: 'This event is recorded',
				text: `The hosts will record what this room shows and what is said in it: the names shown, and your camera and microphone when they are on. The recording is kept in the project's private storage, and ${who} may watch it. While a recording runs, the room shows a recording mark and you hear a short tone when it starts and stops. You can join with your camera and microphone off.`,
				needsAgreement: true
			};
		case 'undecided':
			return {
				heading: 'This event may be recorded',
				text: `The hosts have not decided whether to record this room. If they do, the recording holds what the room shows and what is said in it: the names shown, and your camera and microphone when they are on, and ${who} may watch it. While a recording runs, the room shows a recording mark and you hear a short tone when it starts and stops. You can join with your camera and microphone off.`,
				needsAgreement: true
			};
		case 'not-recorded':
			return {
				heading: 'This event is not recorded',
				text: 'The hosts do not plan to record this room. If a recording is ever started, the room shows a recording mark and you hear a short tone, and you can leave.',
				needsAgreement: false
			};
	}
}

/** The style a new room starts with, from the kind of event. */
export function defaultRoomStyle(kind: string): RoomStyle {
	return kind === 'workshop' || kind === 'gathering' ? 'discussion' : 'webinar';
}

/** RealtimeKit's own recording statuses (Cloudflare, "Monitor Recording Status"). */
export const recordingStatusWords: Record<string, string> = {
	INVOKED: 'Starting',
	RECORDING: 'Recording',
	PAUSED: 'Paused',
	UPLOADING: 'Being saved',
	UPLOADED: 'Saved',
	ERRORED: 'Failed'
};

/** "1 hour 4 minutes", from seconds. */
export function durationWords(seconds: number | null): string {
	if (seconds === null || seconds < 0) return '';
	const minutes = Math.round(seconds / 60);
	if (minutes < 1) return 'under a minute';
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	const parts: string[] = [];
	if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
	if (rest > 0) parts.push(`${rest} ${rest === 1 ? 'minute' : 'minutes'}`);
	return parts.join(' ');
}

export type RoomRefusal = 'cancelled' | 'over' | 'sign-in' | 'not-registered' | 'not-online' | 'not-open-yet';
export type RoomAccess = { kind: 'host' } | { kind: 'guest' } | { kind: 'refused'; reason: RoomRefusal };

/**
 * Who may enter an event's room. The people who run events host every room,
 * from when it is set up (to check it works) until it closes. Others need to
 * be signed in, and registered for an online seat when the event has seats,
 * and come while the room is open.
 */
export function roomAccess(
	input: {
		event: { status: string; startsAt: string; endsAt: string };
		host: boolean;
		signedIn: boolean;
		seatKinds: number;
		registration?: { status: string; attendance: string } | null;
	},
	time: Date = new Date()
): RoomAccess {
	if (input.event.status === 'cancelled') return { kind: 'refused', reason: 'cancelled' };
	if (time.getTime() >= roomClosesAt(input.event).getTime()) return { kind: 'refused', reason: 'over' };
	if (input.host) return { kind: 'host' };
	if (!input.signedIn) return { kind: 'refused', reason: 'sign-in' };
	if (input.seatKinds > 0) {
		if (input.registration?.status !== 'registered') return { kind: 'refused', reason: 'not-registered' };
		if (input.registration.attendance !== 'online') return { kind: 'refused', reason: 'not-online' };
	}
	if (!roomIsOpen(input.event, time)) return { kind: 'refused', reason: 'not-open-yet' };
	return { kind: 'guest' };
}

export const roomRefusalWords: Record<RoomRefusal, string> = {
	cancelled: 'This event is cancelled, so its room is closed.',
	over: 'This event is over, so its room is closed.',
	'sign-in': 'Sign in to join the room.',
	'not-registered': 'The room is for people registered for an online seat. Register on the event’s page first.',
	'not-online': 'Your seat is in person. The room is for people with an online seat.',
	'not-open-yet': `The room opens ${roomOpensMinutesBefore} minutes before the event starts.`
};

/** The RealtimeKit preset each person joins with: the app's default presets (Cloudflare, "Set up a webinar"; "Preset"). */
export function roomPreset(style: RoomStyle, role: 'host' | 'guest'): string {
	if (style === 'webinar') return role === 'host' ? 'webinar_presenter' : 'webinar_viewer';
	return role === 'host' ? 'group_call_host' : 'group_call_participant';
}
