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

## Consequences

- New tables `calendar_events`, `calendar_ticket_types`, `calendar_speakers`, `calendar_registrations` and `calendar_messages` (migration `20261123T0450_add_event_calendar.sql`), a `manage-events` permission for the lead author and editors, a 15-minute scheduled run, and Events in the left sidebar, the footer and search.
- Nothing is charged. Paid tickets wait on the nonprofit and its charitable registration.
- Continuing legal education credit (applications, attendance codes, certificates and the uniform certificate of attendance) is built when the first program is planned.
- Until the domain exists, nobody gets event emails; the event page shows each person where they stand.

## Sources

[^nevada-regulations]: State Bar of Nevada, Board of Continuing Legal Education, *Regulations*, Regs. 2 and 5 (2022), https://nvbar.org/wp-content/uploads/MCLE-Board-Regulations_2022.pdf; State Bar of Nevada, "Application for Accredited Provider Status," https://nvbar.org/licensing-compliance/mcle/application-for-accredited-provider-status/ (both checked Nov. 23, 2026).
[^rfc5545]: B. Desruisseaux, ed., *Internet Calendaring and Scheduling Core Object Specification (iCalendar)*, RFC 5545 (Internet Engineering Task Force, Sept. 2009), https://www.rfc-editor.org/rfc/rfc5545.
[^cloudflare-email]: Cloudflare, "Email Sending Workers API," https://developers.cloudflare.com/email-service/api/send-emails/workers-api/.
[^california-recording]: Cal. Penal Code § 632 (recording a confidential communication without the consent of all parties).
