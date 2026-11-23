/**
 * Reading the event form in the workspace (src/lib/components/EventFields.svelte).
 * Times are entered as a date and a clock time in the event's own zone and
 * stored in UTC.
 */
import {
	eventKinds,
	isEventSlug,
	isEventTimeZone,
	isWebLink,
	recordingChoices,
	slugFromTitle,
	wallClock,
	zonedToUtc,
	type EventKind,
	type RecordingChoice
} from '#lib/event-calendar.ts';
import type { CalendarEvent, EventInput } from '#lib/server/event-calendar.ts';
import { formText } from '#lib/server/workspace.ts';

/** What the form shows: the values as typed, so a refused form keeps them. */
export interface EventFormValues {
	title: string;
	slug: string;
	summary: string;
	description: string;
	kind: string;
	startDate: string;
	startTime: string;
	endDate: string;
	endTime: string;
	timeZone: string;
	venueName: string;
	venueAddress: string;
	onlineLink: string;
	recordingLink: string;
	recording: string;
	accessNotes: string;
	closesDate: string;
	closesTime: string;
}

export const emptyEventForm: EventFormValues = {
	title: '',
	slug: '',
	summary: '',
	description: '',
	kind: 'talk',
	startDate: '',
	startTime: '',
	endDate: '',
	endTime: '',
	timeZone: 'America/Los_Angeles',
	venueName: '',
	venueAddress: '',
	onlineLink: '',
	recordingLink: '',
	recording: 'undecided',
	accessNotes: '',
	closesDate: '',
	closesTime: ''
};

/** The form's values for an event already saved, in its own zone. */
export function formValuesOf(event: CalendarEvent): EventFormValues {
	const start = wallClock(new Date(event.startsAt), event.timeZone);
	const end = wallClock(new Date(event.endsAt), event.timeZone);
	const closes = event.registrationClosesAt ? wallClock(new Date(event.registrationClosesAt), event.timeZone) : '';
	return {
		title: event.title,
		slug: event.slug,
		summary: event.summary,
		description: event.description,
		kind: event.kind,
		startDate: start.slice(0, 10),
		startTime: start.slice(11),
		endDate: end.slice(0, 10),
		endTime: end.slice(11),
		timeZone: event.timeZone,
		venueName: event.venueName ?? '',
		venueAddress: event.venueAddress ?? '',
		onlineLink: event.onlineLink ?? '',
		recordingLink: event.recordingLink ?? '',
		recording: event.recording,
		accessNotes: event.accessNotes,
		closesDate: closes.slice(0, 10),
		closesTime: closes.slice(11)
	};
}

function text(form: FormData, name: string, maximum: number): string {
	const value = form.get(name);
	return typeof value === 'string' ? value.normalize('NFC').slice(0, maximum) : '';
}

export type EventFormResult =
	| { ok: true; input: EventInput; values: EventFormValues }
	| { ok: false; problem: string; field: keyof EventFormValues; values: EventFormValues };

/** Reads and checks the event form. */
export function readEventForm(form: FormData): EventFormResult {
	const values: EventFormValues = {
		title: text(form, 'title', 200).trim(),
		slug: text(form, 'slug', 80).trim(),
		summary: text(form, 'summary', 400).trim(),
		description: text(form, 'description', 20000).trim(),
		kind: text(form, 'kind', 40),
		startDate: text(form, 'start-date', 10),
		startTime: text(form, 'start-time', 5),
		endDate: text(form, 'end-date', 10),
		endTime: text(form, 'end-time', 5),
		timeZone: text(form, 'time-zone', 60),
		venueName: text(form, 'venue-name', 200).trim(),
		venueAddress: text(form, 'venue-address', 400).trim(),
		onlineLink: text(form, 'online-link', 500).trim(),
		recordingLink: text(form, 'recording-link', 500).trim(),
		recording: text(form, 'recording', 40),
		accessNotes: text(form, 'access-notes', 2000).trim(),
		closesDate: text(form, 'closes-date', 10),
		closesTime: text(form, 'closes-time', 5)
	};
	const refuse = (field: keyof EventFormValues, problem: string): EventFormResult => ({ ok: false, problem, field, values });
	if (!values.title) return refuse('title', 'Give the event a title.');
	const slug = values.slug || slugFromTitle(values.title);
	values.slug = slug;
	if (!isEventSlug(slug)) return refuse('slug', 'Use lowercase letters, digits and single hyphens for the address.');
	if (!eventKinds.includes(values.kind as EventKind)) return refuse('kind', 'Choose what kind of event it is.');
	if (!isEventTimeZone(values.timeZone)) return refuse('timeZone', 'Choose the time zone the event is held in.');
	if (!values.endDate) values.endDate = values.startDate;
	const startsAt = zonedToUtc(`${values.startDate}T${values.startTime}`, values.timeZone);
	if (!startsAt) return refuse('startDate', 'Enter the day and time the event starts.');
	const endsAt = zonedToUtc(`${values.endDate}T${values.endTime}`, values.timeZone);
	if (!endsAt) return refuse('endTime', 'Enter the time the event ends.');
	if (endsAt <= startsAt) return refuse('endTime', 'The event must end after it starts.');
	let closesAt: Date | undefined;
	if (values.closesDate || values.closesTime) {
		closesAt = zonedToUtc(`${values.closesDate}T${values.closesTime || '23:59'}`, values.timeZone);
		if (!closesAt) return refuse('closesDate', 'Enter the day registration closes, or leave it empty.');
		if (closesAt > startsAt) return refuse('closesDate', 'Registration must close by the time the event starts.');
	}
	if (values.onlineLink && !isWebLink(values.onlineLink)) return refuse('onlineLink', 'The online link must start with https://.');
	if (values.recordingLink && !isWebLink(values.recordingLink)) return refuse('recordingLink', 'The recording link must start with https://.');
	if (!recordingChoices.includes(values.recording as RecordingChoice)) return refuse('recording', 'Say whether the event will be recorded.');
	return {
		ok: true,
		values,
		input: {
			slug,
			title: values.title,
			summary: values.summary,
			description: values.description,
			kind: values.kind as EventKind,
			startsAt: startsAt.toISOString(),
			endsAt: endsAt.toISOString(),
			timeZone: values.timeZone,
			venueName: values.venueName || null,
			venueAddress: values.venueAddress || null,
			onlineLink: values.onlineLink || null,
			recordingLink: values.recordingLink || null,
			recording: values.recording as RecordingChoice,
			accessNotes: values.accessNotes,
			registrationClosesAt: closesAt ? closesAt.toISOString() : null
		}
	};
}

/** A number of seats from the form: empty means no limit. */
export function readCapacity(form: FormData): number | null | 'bad' {
	const value = formText(form, 'capacity', 10);
	if (!value) return null;
	if (!/^\d+$/.test(value)) return 'bad';
	return Number(value);
}
