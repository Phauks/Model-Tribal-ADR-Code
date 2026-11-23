/**
 * The site's own video rooms, shared by the server and the pages
 * (migrations/20261123T1750_add_standalone_video_rooms.sql; decision record
 * 0048, "The video room" and "Rooms of their own").
 *
 * A room belongs to an event, or stands alone. A room of its own is public
 * (listed at /rooms, open to anyone signed in) or private (its hosts and the
 * people holding one of its invite links, as for an interview). Each room has
 * its own RealtimeKit meeting, so any number can run at once.
 */
import type { RecordingChoice } from './event-calendar.ts';

export const roomStyles = ['webinar', 'discussion'] as const;
export type RoomStyle = (typeof roomStyles)[number];

export const roomStyleLabels: Record<RoomStyle, string> = {
	webinar: 'Speakers on a stage, everyone else watches and may ask to speak',
	discussion: 'Everyone may speak and show video'
};

export const roomVisibilities = ['public', 'private'] as const;
export type RoomVisibility = (typeof roomVisibilities)[number] | 'event';

export const roomVisibilityLabels: Record<(typeof roomVisibilities)[number], string> = {
	public: 'Public: listed on the Rooms page, and anyone signed in may join',
	private: 'Private: only the hosts and people you send an invite link to, such as for an interview'
};

export const recordingWatchers = ['hosts', 'registered', 'joined', 'signed-in'] as const;
export type RecordingWatchers = (typeof recordingWatchers)[number];

/** The choices offered for an event's room. */
export const eventRecordingWatchers = ['hosts', 'registered', 'signed-in'] as const satisfies readonly RecordingWatchers[];
/** The choices offered for a room of its own. */
export const roomRecordingWatchers = ['hosts', 'joined', 'signed-in'] as const satisfies readonly RecordingWatchers[];

export const recordingWatcherLabels: Record<RecordingWatchers, string> = {
	hosts: 'Only the hosts',
	registered: 'People who registered for the event',
	joined: 'People who joined the room while signed in',
	'signed-in': 'Anyone signed in to the website'
};

/** Guests may come in this long before a room starts, so speakers can check their camera and sound. */
export const roomOpensMinutesBefore = 30;
/** An event's room closes this long after the event is due to end, so a talk that runs over is not cut off. */
export const roomClosesMinutesAfter = 120;
/** How long an instant room stays open unless a host keeps it open longer or closes it. */
export const instantRoomHours = 4;
/** The longest a planned room may stay open, in hours. */
export const longestRoomHours = 24;

/** When a room lets guests in and when it closes. Hosts may enter any time before it closes. */
export interface RoomWindow {
	startsAt: string;
	closesAt: string;
}

/** An event's room: from the event's times. */
export function eventRoomWindow(event: { startsAt: string; endsAt: string }): RoomWindow {
	return { startsAt: event.startsAt, closesAt: new Date(new Date(event.endsAt).getTime() + roomClosesMinutesAfter * 60_000).toISOString() };
}

/** When guests may first come in. */
export function roomOpensAt(window: RoomWindow): Date {
	return new Date(new Date(window.startsAt).getTime() - roomOpensMinutesBefore * 60_000);
}

/** When the room closes, for each person's token: it stops working then. */
export function roomClosesAt(window: RoomWindow): Date {
	return new Date(window.closesAt);
}

/** Whether guests may be in the room at this time. */
export function roomIsOpen(window: RoomWindow, time: Date = new Date()): boolean {
	return time.getTime() >= roomOpensAt(window).getTime() && time.getTime() < roomClosesAt(window).getTime();
}

/**
 * What a person is told before joining, by the room's recording choice. A
 * person must agree to it to join a room that is, or may be, recorded.
 */
export function recordingNotice(
	choice: RecordingChoice,
	watchers: RecordingWatchers,
	kind: 'event' | 'room' = 'event'
): { heading: string; text: string; needsAgreement: boolean } {
	const who = {
		hosts: kind === 'event' ? 'only the people running the project’s events' : 'only the room’s hosts',
		registered: 'the people who registered for this event',
		joined: 'the people who joined this room while signed in',
		'signed-in': 'anyone signed in to this website'
	}[watchers];
	const noun = kind === 'event' ? 'event' : 'room';
	switch (choice) {
		case 'recorded':
			return {
				heading: `This ${noun} is recorded`,
				text: `The hosts will record what this room shows and what is said in it: the names shown, and your camera and microphone when they are on. The recording is kept in the project's private storage, and ${who} may watch it. While a recording runs, the room shows a recording mark and you hear a short tone when it starts and stops. You can join with your camera and microphone off.`,
				needsAgreement: true
			};
		case 'undecided':
			return {
				heading: `This ${noun} may be recorded`,
				text: `The hosts have not decided whether to record this room. If they do, the recording holds what the room shows and what is said in it: the names shown, and your camera and microphone when they are on, and ${who} may watch it. While a recording runs, the room shows a recording mark and you hear a short tone when it starts and stops. You can join with your camera and microphone off.`,
				needsAgreement: true
			};
		case 'not-recorded':
			return {
				heading: `This ${noun} is not recorded`,
				text: 'The hosts do not plan to record this room. If a recording is ever started, the room shows a recording mark and you hear a short tone, and you can leave.',
				needsAgreement: false
			};
	}
}

/** The words of the agreement box. */
export function agreementLabel(choice: RecordingChoice): string {
	return `I have read this and agree to join ${choice === 'recorded' ? 'a recorded room' : 'a room that may be recorded'}.`;
}

/** The style a new event room starts with, from the kind of event. */
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

export type RoomRefusal = 'cancelled' | 'over' | 'closed' | 'sign-in' | 'not-registered' | 'not-online' | 'not-open-yet' | 'private' | 'invite-ended';
export type RoomRole = 'host' | 'guest';
export type RoomAccess = { kind: RoomRole } | { kind: 'refused'; reason: RoomRefusal };

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
	const window = eventRoomWindow(input.event);
	if (input.event.status === 'cancelled') return { kind: 'refused', reason: 'cancelled' };
	if (time.getTime() >= roomClosesAt(window).getTime()) return { kind: 'refused', reason: 'over' };
	if (input.host) return { kind: 'host' };
	if (!input.signedIn) return { kind: 'refused', reason: 'sign-in' };
	if (input.seatKinds > 0) {
		if (input.registration?.status !== 'registered') return { kind: 'refused', reason: 'not-registered' };
		if (input.registration.attendance !== 'online') return { kind: 'refused', reason: 'not-online' };
	}
	if (!roomIsOpen(window, time)) return { kind: 'refused', reason: 'not-open-yet' };
	return { kind: 'guest' };
}

/**
 * Who may enter a room of its own. Its hosts may, until it closes. Someone
 * holding one of its invite links may, with the link's role, from 30 minutes
 * before it starts; a link a host turned off lets nobody in. A public room
 * also lets in anyone signed in in that time; a private room nobody else.
 */
export function standaloneRoomAccess(
	input: {
		room: { visibility: 'public' | 'private'; startsAt: string; closesAt: string };
		host: boolean;
		signedIn: boolean;
		invite?: { role: RoomRole; revoked: boolean } | null;
	},
	time: Date = new Date()
): RoomAccess {
	if (time.getTime() >= roomClosesAt(input.room).getTime()) return { kind: 'refused', reason: 'closed' };
	if (input.host) return { kind: 'host' };
	if (input.invite) {
		if (input.invite.revoked) return { kind: 'refused', reason: 'invite-ended' };
		if (!roomIsOpen(input.room, time)) return { kind: 'refused', reason: 'not-open-yet' };
		return { kind: input.invite.role };
	}
	if (input.room.visibility === 'private') return { kind: 'refused', reason: 'private' };
	if (!input.signedIn) return { kind: 'refused', reason: 'sign-in' };
	if (!roomIsOpen(input.room, time)) return { kind: 'refused', reason: 'not-open-yet' };
	return { kind: 'guest' };
}

export const roomRefusalWords: Record<RoomRefusal, string> = {
	cancelled: 'This event is cancelled, so its room is closed.',
	over: 'This event is over, so its room is closed.',
	closed: 'This room has closed.',
	'sign-in': 'Sign in to join the room.',
	'not-registered': 'The room is for people registered for an online seat. Register on the event’s page first.',
	'not-online': 'Your seat is in person. The room is for people with an online seat.',
	'not-open-yet': `The room opens ${roomOpensMinutesBefore} minutes before it starts.`,
	private: 'This room is private. Its hosts let people in with an invite link.',
	'invite-ended': 'This invite link has been turned off. Ask the person who sent it for a new one.'
};

/** The RealtimeKit preset each person joins with: the app's default presets (Cloudflare, "Set up a webinar"; "Preset"). */
export function roomPreset(style: RoomStyle, role: RoomRole): string {
	if (style === 'webinar') return role === 'host' ? 'webinar_presenter' : 'webinar_viewer';
	return role === 'host' ? 'group_call_host' : 'group_call_participant';
}

/** Whether text could be a room's identifier or an invite's secret, before looking either up. */
export function isRoomIdentifier(value: unknown): value is string {
	return typeof value === 'string' && /^[a-z0-9-]{1,80}$/.test(value);
}

export function isInviteSecret(value: unknown): value is string {
	return typeof value === 'string' && /^[A-Za-z0-9_-]{32,64}$/.test(value);
}
