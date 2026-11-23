# 0048. List events on the website and take registrations, with continuing legal education later

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

Trevor Goldsmith expects the nonprofit that will publish this work to host continuing legal education programs and other events, and asked how the website could support them. A proposal in the project thread looked at Nevada's continuing legal education rules and other states that accept Nevada credit. It also covered attendance tracking and certificates, paid tickets, the Form 1023-EZ limit on gross receipts, and the meeting rooms Trevor built in Magna Carta. It split the work into five phases: an events calendar, a continuing legal education toolkit, paid tickets, the project's own video room, and recorded programs on demand.

Some of these depend on things that do not exist yet. Paid tickets wait on the nonprofit, its Nevada charitable registration and someone to receive the money. Credit for recorded programs in Nevada is open only to accredited providers, which costs $500 to apply and $500 a year.[^nevada-regulations] Email waits on the project's domain.

## Decision

Trevor chose "Phase 1 now, CLE later". The website gets an events calendar now:

- `/events` lists upcoming and past events, and each event has a page with its time in the zone where it is held, its place, speakers, access notes and whether it will be recorded.
- Signed-in readers register for a kind of seat (such as in person or online), each with its own limit and waitlist. A freed seat is offered to the person waiting longest and held for 48 hours.
- Events are calendar files people can add or subscribe to.[^rfc5545]
- People registered get confirmations, offers, reminders and word of a change or cancellation by email once the domain exists, through the same switch as summaries of followed pages. These are transactional messages about something the person signed up for, the kind Cloudflare Email Service sends.[^cloudflare-email]
- Online events use a Zoom, YouTube or other link the organizer pastes in, shown only to people registered for an online seat.
- The lead author and editors run events from the workspace.

How it is built is in `site/COLLABORATION.md`, "Events".

The project's own video room, when built, must be able to record (Trevor, 2026-11-23). Trevor owns Magna Carta and agreed its code may be reused here. Its meeting rooms already record sound, and everyone in the room is told: a confirmation before it starts, a tone, spoken words and a banner, a mark that stays while it runs, and a record of who was told. Their recordings go through the same malware scan as uploaded files, and a transcript is made with each line under the speaker's name. The room here should keep all of that and add:

- video as well as sound, since a recorded program is watched;
- a notice before joining that the event may be recorded, because some states require every party's consent to record a conversation;[^california-recording]
- storage in the private R2 bucket, scanned like other files;
- the host choosing who may watch each recording (people registered, the public, or nobody);
- recorded programs offered for Nevada credit only once the project is an accredited provider.

## The video room

Trevor chose Cloudflare RealtimeKit for the room on 2026-11-23, over porting Magna Carta's meeting rooms, which record sound only and run to about 43,000 lines. RealtimeKit gives video, a ready-made meeting screen, and recording of the whole room to a single video file, on the same Cloudflare account as the site.[^realtimekit-recording] Each event turns the room on for itself, and the room stays off until the RealtimeKit app's settings are added. The site keeps, from Magna Carta, the parts about telling people:

- before joining, a notice saying whether the event is recorded and who may watch, which people must agree to when it is or may be recorded;[^california-recording]
- a record of what each person was told and when;
- while a recording runs, a banner, a message for screen readers, and a tone when it starts and stops, besides RealtimeKit's own recording mark;
- people join with camera and microphone off.

Recordings are copied from RealtimeKit, which keeps them for seven days, into the private R2 bucket, then go through the same virus check as uploaded files. Hosts choose who may watch: only the people running events (the default), the people registered for the event, or anyone signed in. Showing a recording to everyone, signed in or not, is left for later, as is a transcript with each line under the speaker's name, which RealtimeKit can make.[^realtimekit-transcription] Participants are known to RealtimeKit by their account identifier and the name they registered with, never their email address.[^realtimekit-participant]

RealtimeKit charges by the minute past a free allowance each month: 10,000 participant minutes of audio and video, and 100 minutes of recording, then $0.002 a participant minute and $0.010 a recorded minute (pricing as listed on Nov. 23, 2026).[^realtimekit-pricing] A two-hour talk with 50 people online uses 6,000 participant minutes and 120 recorded minutes. The browser parts are the `@cloudflare/realtimekit` package (Apache License 2.0) and `@cloudflare/realtimekit-ui`, whose package does not state a license; both are Cloudflare's and pinned to exact versions released more than a month earlier.

## Rooms of their own

Trevor asked on 2026-11-23 that several rooms be able to run at once, that rooms be public or private so the project can hold its interviews in them, and that a room can be started instantly. Rooms are no longer tied to events. A room belongs to an event, or stands alone, and each room has its own RealtimeKit meeting, so any number run at the same time; RealtimeKit meetings have no start or end time of their own, so the site keeps each room's times and limits every token to them.[^realtimekit-schedule]

- A public room is listed on a Rooms page, and anyone signed in may join it while it is open.
- A private room, such as an interview, lets in only its hosts and the people holding one of its invite links. A link needs no account, so a person being interviewed does not have to make one. They type the name shown in the room, and are told about recording and agree to it, like everyone else. Only a hash of a link's secret is kept, so a link is shown once, when it is made, and a host can turn it off. One link can be passed to several people; each browser is a separate person in the room.
- An instant room is a private room started with one click. It is open for four hours, has a guest link to send, and can be kept open longer or closed. Closing a room also ends the live call, because an expired token does not remove anyone already in a meeting.[^realtimekit-session]
- The people who manage events host every room. Co-authors and advisors may start rooms too (a new `host-video-rooms` permission), and host the rooms they started. A recording of a room of its own may be watched by its hosts only (the default, and the right choice for an interview), by the people who joined it while signed in, or by anyone signed in.

RealtimeKit has no Worker binding; the Worker calls its REST API with an API token, which is the only setting the room needs.[^realtimekit-participant] The site finds the account and the RealtimeKit app with that token. The app is made once in the dashboard rather than by the site, because only an app made there comes with the default presets the room uses.[^realtimekit-preset]
- Nobody decides about recording before a room of its own starts (Trevor, 2026-11-23). Everyone is told the room may be recorded, in one line with who may watch, and agrees before joining; the hosts start and stop recording in the call, where the recording mark, the banner and the tones say so. A room's call has the whole browser window, opened in a new tab.

## Consequences

- New tables `calendar_events`, `calendar_ticket_types`, `calendar_speakers`, `calendar_registrations` and `calendar_messages` (migration `20261123T0450_add_event_calendar.sql`), a `manage-events` permission for the lead author and editors, a 15-minute scheduled run, and Events in the left sidebar, the footer and search.
- Nothing is charged. Paid tickets wait on the nonprofit and its charitable registration.
- Continuing legal education credit (applications, attendance codes, certificates and the uniform certificate of attendance) is built when the first program is planned.
- Until the domain exists, nobody gets event emails; the event page shows each person where they stand.
- The video room added `calendar_rooms`, `calendar_room_people` and `calendar_recordings` (migration `20261123T0452_add_event_video_rooms.sql`). Rooms of their own replace them with `video_rooms`, `video_room_invites`, `video_room_people` and `video_room_recordings` (migration `20261123T1750_add_standalone_video_rooms.sql`), which copies the old rows over. The room needs one Secret in the Cloudflare dashboard, `VIDEO_ROOM_TOKEN`; `VIDEO_ROOM_ACCOUNT` and `VIDEO_ROOM_APPLICATION` are optional, for when the token reaches several accounts or apps.

## Sources

[^nevada-regulations]: State Bar of Nevada, Board of Continuing Legal Education, *Regulations*, Regs. 2 and 5 (2022), https://nvbar.org/wp-content/uploads/MCLE-Board-Regulations_2022.pdf; State Bar of Nevada, "Application for Accredited Provider Status," https://nvbar.org/licensing-compliance/mcle/application-for-accredited-provider-status/ (both checked Nov. 23, 2026).
[^rfc5545]: B. Desruisseaux, ed., *Internet Calendaring and Scheduling Core Object Specification (iCalendar)*, RFC 5545 (Internet Engineering Task Force, Sept. 2009), https://www.rfc-editor.org/rfc/rfc5545.
[^cloudflare-email]: Cloudflare, "Email Sending Workers API," https://developers.cloudflare.com/email-service/api/send-emails/workers-api/.
[^california-recording]: Cal. Penal Code § 632 (recording a confidential communication without the consent of all parties).
[^realtimekit-recording]: Cloudflare, "Recording Guide" and "Monitor Recording Status," RealtimeKit documentation, https://developers.cloudflare.com/realtime/realtimekit/recording-guide/ (checked Nov. 23, 2026).
[^realtimekit-transcription]: Cloudflare, "Transcription," RealtimeKit documentation, https://developers.cloudflare.com/realtime/realtimekit/ai/transcription/ (checked Nov. 23, 2026).
[^realtimekit-participant]: Cloudflare, "Participant" and "FAQ," RealtimeKit documentation, https://developers.cloudflare.com/realtime/realtimekit/concepts/participant/ and https://developers.cloudflare.com/realtime/realtimekit/faq/ (checked Nov. 23, 2026).
[^realtimekit-schedule]: Cloudflare, "FAQ," RealtimeKit documentation, "Can I schedule meetings in advance with RealtimeKit?," https://developers.cloudflare.com/realtime/realtimekit/faq/ (checked Nov. 23, 2026).
[^realtimekit-session]: Cloudflare, "FAQ," RealtimeKit documentation, "What happens to a participant already in a meeting when their auth token expires?," https://developers.cloudflare.com/realtime/realtimekit/faq/; Cloudflare, "End a session," https://developers.cloudflare.com/realtime/realtimekit/humans/core/end-a-session/ (both checked Nov. 23, 2026).
[^realtimekit-preset]: Cloudflare, "Preset," RealtimeKit documentation, "Create a Preset," https://developers.cloudflare.com/realtime/realtimekit/concepts/preset/; Cloudflare, "Quickstart," https://developers.cloudflare.com/realtime/realtimekit/quickstart/ (both checked Nov. 23, 2026).
[^realtimekit-pricing]: Cloudflare, "Pricing," RealtimeKit documentation, https://developers.cloudflare.com/realtime/realtimekit/platform/pricing/ (checked Nov. 23, 2026).
