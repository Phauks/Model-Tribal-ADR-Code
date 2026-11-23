/**
 * The few calls the site makes to Cloudflare RealtimeKit's REST API, for the
 * events video room (decision record 0048, "The video room").
 *
 * - Create a meeting: POST /meetings (Cloudflare, "Meeting").
 * - Add a participant, and later refresh their token: POST
 *   /meetings/{meeting}/participants and
 *   /meetings/{meeting}/participants/{participant}/token. Each token is limited
 *   to the room's opening hours with not_before and expires_on (Cloudflare,
 *   "Participant", "Token validity and refresh").
 * - List a meeting's recordings: GET /recordings?meeting_id= (Cloudflare,
 *   "Monitor Recording Status").
 *
 * The API token is sent only from the Worker, never to a browser (Cloudflare,
 * RealtimeKit "FAQ", "API token"). Participant ids are account identifiers,
 * never email addresses (Cloudflare, RealtimeKit "FAQ", "What should I use for
 * custom_participant_id?").
 */

/** The settings the room needs. All three are set in the Cloudflare dashboard (site/COLLABORATION.md, "The video room"). */
export interface VideoRoomSettings {
	account: string;
	application: string;
	token: string;
}

/** The room's settings, or null while any is missing, which keeps the room off. */
export function videoRoomSettings(environment: {
	VIDEO_ROOM_ACCOUNT?: string;
	VIDEO_ROOM_APPLICATION?: string;
	VIDEO_ROOM_TOKEN?: string;
}): VideoRoomSettings | null {
	const account = environment.VIDEO_ROOM_ACCOUNT?.trim();
	const application = environment.VIDEO_ROOM_APPLICATION?.trim();
	const token = environment.VIDEO_ROOM_TOKEN?.trim();
	if (!account || !application || !token) return null;
	return { account, application, token };
}

export class RealtimeKitError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
		this.name = 'RealtimeKitError';
	}
}

/** Lets tests stand in for the network. */
export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

function address(settings: VideoRoomSettings, path: string): string {
	return `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(settings.account)}/realtime/kit/${encodeURIComponent(settings.application)}${path}`;
}

async function call<T>(settings: VideoRoomSettings, fetcher: Fetcher, method: string, path: string, body?: unknown): Promise<T> {
	const response = await fetcher(address(settings, path), {
		method,
		headers: {
			authorization: `Bearer ${settings.token}`,
			...(body === undefined ? {} : { 'content-type': 'application/json' })
		},
		...(body === undefined ? {} : { body: JSON.stringify(body) })
	});
	const text = await response.text();
	let parsed: { success?: boolean; data?: unknown; errors?: { message?: string }[]; error?: { message?: string } } = {};
	try {
		parsed = text ? JSON.parse(text) : {};
	} catch {
		// Not JSON: reported below with the status.
	}
	if (!response.ok || parsed.success === false) {
		const message = parsed.errors?.[0]?.message ?? parsed.error?.message ?? (text.slice(0, 200) || response.statusText);
		throw new RealtimeKitError(`RealtimeKit ${method} ${path.split('?')[0]} failed (${response.status}): ${message}`, response.status);
	}
	return parsed.data as T;
}

/** Makes the meeting for one event's room and returns its id. */
export async function createMeeting(settings: VideoRoomSettings, title: string, fetcher: Fetcher = fetch): Promise<string> {
	const data = await call<{ id?: string }>(settings, fetcher, 'POST', '/meetings', { title: title.slice(0, 200) });
	if (!data?.id) throw new RealtimeKitError('RealtimeKit made a meeting but did not say its id.', 502);
	return data.id;
}

export interface ParticipantToken {
	participant: string;
	token: string;
}

function tokenWindow(time: Date, closes: Date): { not_before: string; expires_on: string } {
	// A minute of slack for clocks; a token can never outlast the room.
	return { not_before: new Date(time.getTime() - 60_000).toISOString(), expires_on: closes.toISOString() };
}

/** Adds a person to a meeting with a preset, and returns their participant id and a token that works until the room closes. */
export async function addParticipant(
	settings: VideoRoomSettings,
	input: { meeting: string; accountIdentifier: string; name: string; preset: string; closes: Date; time?: Date },
	fetcher: Fetcher = fetch
): Promise<ParticipantToken> {
	const data = await call<{ id?: string; token?: string }>(
		settings,
		fetcher,
		'POST',
		`/meetings/${encodeURIComponent(input.meeting)}/participants`,
		{
			name: input.name.slice(0, 200),
			preset_name: input.preset,
			custom_participant_id: input.accountIdentifier,
			token: tokenWindow(input.time ?? new Date(), input.closes)
		}
	);
	if (!data?.id || !data.token) throw new RealtimeKitError('RealtimeKit added the participant but sent no token.', 502);
	return { participant: data.id, token: data.token };
}

/** A fresh token for someone already added to the meeting. */
export async function refreshParticipantToken(
	settings: VideoRoomSettings,
	input: { meeting: string; participant: string; closes: Date; time?: Date },
	fetcher: Fetcher = fetch
): Promise<string> {
	const data = await call<{ token?: string }>(
		settings,
		fetcher,
		'POST',
		`/meetings/${encodeURIComponent(input.meeting)}/participants/${encodeURIComponent(input.participant)}/token`,
		tokenWindow(input.time ?? new Date(), input.closes)
	);
	if (!data?.token) throw new RealtimeKitError('RealtimeKit refreshed the token but sent none.', 502);
	return data.token;
}

/** One recording as RealtimeKit describes it. */
export interface RemoteRecording {
	identifier: string;
	status: string;
	startedAt: string | null;
	stoppedAt: string | null;
	durationSeconds: number | null;
	sizeBytes: number | null;
	downloadAddress: string | null;
}

interface RecordingRow {
	id?: string;
	status?: string;
	started_time?: string | null;
	stopped_time?: string | null;
	recording_duration?: number | null;
	file_size?: number | string | null;
	download_url?: string | null;
	type?: string;
}

function numberOrNull(value: unknown): number | null {
	const number = typeof value === 'string' ? Number(value) : value;
	return typeof number === 'number' && Number.isFinite(number) ? number : null;
}

function durationOf(row: RecordingRow): number | null {
	const given = numberOrNull(row.recording_duration);
	if (given !== null) return given;
	if (row.started_time && row.stopped_time) {
		const seconds = (new Date(row.stopped_time).getTime() - new Date(row.started_time).getTime()) / 1000;
		return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds) : null;
	}
	return null;
}

export function remoteRecordingOf(row: RecordingRow): RemoteRecording | null {
	if (!row.id || !row.status) return null;
	// Only the single, whole-room file. Track recordings (one sound file per
	// person) are not used here.
	if (row.type && row.type !== 'RECORDING' && row.type !== 'COMPOSITE') return null;
	return {
		identifier: row.id,
		status: row.status,
		startedAt: row.started_time ?? null,
		stoppedAt: row.stopped_time ?? null,
		durationSeconds: durationOf(row),
		sizeBytes: numberOrNull(row.file_size),
		downloadAddress: typeof row.download_url === 'string' && row.download_url.startsWith('https://') ? row.download_url : null
	};
}

/** Every recording of one meeting, newest pages included. */
export async function meetingRecordings(settings: VideoRoomSettings, meeting: string, fetcher: Fetcher = fetch): Promise<RemoteRecording[]> {
	const found: RemoteRecording[] = [];
	for (let page = 1; page <= 10; page += 1) {
		const data = await call<RecordingRow[] | { recordings?: RecordingRow[] }>(
			settings,
			fetcher,
			'GET',
			`/recordings?meeting_id=${encodeURIComponent(meeting)}&page_no=${page}&per_page=50`
		);
		const rows = Array.isArray(data) ? data : (data?.recordings ?? []);
		for (const row of rows) {
			const recording = remoteRecordingOf(row);
			if (recording) found.push(recording);
		}
		if (rows.length < 50) break;
	}
	return found;
}
