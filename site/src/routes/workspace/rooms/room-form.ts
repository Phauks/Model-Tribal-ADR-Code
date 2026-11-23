/**
 * Reading the form for a room of its own (src/routes/workspace/rooms/RoomFields.svelte).
 * The start is entered as a date and a clock time in the room's own zone and
 * stored in UTC; the room closes the given number of hours later.
 */
import { isEventTimeZone, wallClock, zonedToUtc } from '#lib/event-calendar.ts';
import {
	longestRoomHours,
	roomRecordingWatchers,
	roomStyles,
	roomVisibilities,
	type RecordingWatchers,
	type RoomStyle
} from '#lib/video-rooms.ts';
import type { StandaloneRoom, StandaloneRoomInput } from '#lib/server/video-rooms.ts';
import { formText } from '#lib/server/workspace.ts';

export interface RoomFormValues {
	title: string;
	visibility: string;
	style: string;
	watchers: string;
	startDate: string;
	startTime: string;
	hours: string;
	timeZone: string;
}

export const emptyRoomForm: RoomFormValues = {
	title: '',
	visibility: 'private',
	style: 'discussion',
	watchers: 'hosts',
	startDate: '',
	startTime: '',
	hours: '2',
	timeZone: 'America/Los_Angeles'
};

/** The form's values for a room already saved, in its own zone. */
export function roomFormValuesOf(room: StandaloneRoom): RoomFormValues {
	const start = wallClock(new Date(room.startsAt), room.timeZone);
	const hours = (new Date(room.closesAt).getTime() - new Date(room.startsAt).getTime()) / 3_600_000;
	return {
		title: room.title,
		visibility: room.visibility,
		style: room.style,
		watchers: room.watchers,
		startDate: start.slice(0, 10),
		startTime: start.slice(11),
		hours: String(Math.max(1, Math.min(longestRoomHours, Math.round(hours)))),
		timeZone: room.timeZone
	};
}

export type RoomFormResult =
	| { input: StandaloneRoomInput; values: RoomFormValues }
	| { problem: string; field: keyof RoomFormValues; values: RoomFormValues };

export function readRoomForm(form: FormData): RoomFormResult {
	const text = (name: string, length = 200) => formText(form, name, length) ?? '';
	const values: RoomFormValues = {
		title: text('title'),
		visibility: text('visibility', 20),
		style: text('style', 20),
		watchers: text('watchers', 20),
		startDate: text('start-date', 10),
		startTime: text('start-time', 5),
		hours: text('hours', 4),
		timeZone: text('time-zone', 40)
	};
	const refuse = (field: keyof RoomFormValues, problem: string): RoomFormResult => ({ problem, field, values });
	if (!values.title) return refuse('title', 'Give the room a name, such as "Interview with a peacemaker".');
	if (!(roomVisibilities as readonly string[]).includes(values.visibility)) return refuse('visibility', 'Say whether the room is public or private.');
	if (!(roomStyles as readonly string[]).includes(values.style)) return refuse('style', 'Choose how the room works.');
	if (!(roomRecordingWatchers as readonly string[]).includes(values.watchers)) return refuse('watchers', 'Choose who may watch the recordings.');
	if (!isEventTimeZone(values.timeZone)) return refuse('timeZone', 'Choose a time zone.');
	const startsAt = zonedToUtc(`${values.startDate}T${values.startTime}`, values.timeZone);
	if (!startsAt) return refuse('startDate', 'Enter the day and time the room starts.');
	const hours = Number(values.hours);
	if (!Number.isInteger(hours) || hours < 1 || hours > longestRoomHours) return refuse('hours', `Enter how many hours the room stays open, from 1 to ${longestRoomHours}.`);
	return {
		values,
		input: {
			title: values.title,
			visibility: values.visibility as 'public' | 'private',
			style: values.style as RoomStyle,
			watchers: values.watchers as RecordingWatchers,
			startsAt,
			closesAt: new Date(startsAt.getTime() + hours * 3_600_000),
			timeZone: values.timeZone
		}
	};
}
