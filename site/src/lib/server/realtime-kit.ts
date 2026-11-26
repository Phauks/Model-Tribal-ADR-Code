/**
 * The few calls the site makes to Cloudflare RealtimeKit's REST API, for the
 * video rooms (decision record 0048, "The video room" and "Rooms of their
 * own").
 *
 * - Create a meeting: POST /meetings (Cloudflare, "Meeting").
 * - Add a participant, and later refresh their token: POST
 *   /meetings/{meeting}/participants and
 *   /meetings/{meeting}/participants/{participant}/token. Each token is limited
 *   to the room's opening hours with not_before and expires_on (Cloudflare,
 *   "Participant", "Token validity and refresh").
 * - List a meeting's recordings: GET /recordings?meeting_id= (Cloudflare,
 *   "Monitor Recording Status").
 * - End a meeting's live session for everyone: POST
 *   /meetings/{meeting}/active-session/kick-all (Cloudflare, "End a session").
 *   An expired token does not remove anyone already in a room; it only stops
 *   them joining or reconnecting (Cloudflare, RealtimeKit "FAQ", "What happens
 *   to a participant already in a meeting when their auth token expires?").
 *
 * The API token is sent only from the Worker, never to a browser (Cloudflare,
 * RealtimeKit "FAQ", "API token"). Participant ids are account identifiers,
 * never email addresses (Cloudflare, RealtimeKit "FAQ", "What should I use for
 * custom_participant_id?").
 */

/**
 * The settings the room needs. Only the API token is required; it is a Secret
 * set in the Cloudflare dashboard (site/COLLABORATION.md, "The video room").
 * RealtimeKit has no Worker binding, so the Worker calls the REST API with a
 * token (Cloudflare, RealtimeKit "FAQ", "API token"). The account and the
 * RealtimeKit app (made once in the dashboard) are found with the token when
 * not given; see videoRoomPlace.
 */
export interface VideoRoomSettings {
	token: string;
	account?: string;
	application?: string;
}

/** The room's settings, or null while the token is missing, which keeps the room off. */
export function videoRoomSettings(environment: {
	VIDEO_ROOM_ACCOUNT?: string;
	VIDEO_ROOM_APPLICATION?: string;
	VIDEO_ROOM_TOKEN?: string;
}): VideoRoomSettings | null {
	const token = environment.VIDEO_ROOM_TOKEN?.trim();
	if (!token) return null;
	const account = environment.VIDEO_ROOM_ACCOUNT?.trim();
	const application = environment.VIDEO_ROOM_APPLICATION?.trim();
	return { token, ...(account ? { account } : {}), ...(application ? { application } : {}) };
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

const apiRoot = 'https://api.cloudflare.com/client/v4';

/** The name that marks the site's app when an account has several RealtimeKit apps. */
export const videoRoomAppName = 'Tribal Law Project video rooms';

interface Answer {
	success?: boolean;
	data?: unknown;
	result?: unknown;
	errors?: { message?: string }[];
	error?: { message?: string };
}

async function request(fetcher: Fetcher, token: string, method: string, address: string, body?: unknown): Promise<Answer> {
	const response = await fetcher(address, {
		method,
		headers: {
			authorization: `Bearer ${token}`,
			...(body === undefined ? {} : { 'content-type': 'application/json' })
		},
		...(body === undefined ? {} : { body: JSON.stringify(body) })
	});
	const text = await response.text();
	let parsed: Answer = {};
	try {
		parsed = text ? JSON.parse(text) : {};
	} catch {
		// Not JSON: reported below with the status.
	}
	if (!response.ok || parsed.success === false) {
		const message = parsed.errors?.[0]?.message ?? parsed.error?.message ?? (text.slice(0, 200) || response.statusText);
		const path = address.replace(apiRoot, '').replace(/\/accounts\/[^/]+/, '/accounts/…').split('?')[0];
		throw new RealtimeKitError(`RealtimeKit ${method} ${path} failed (${response.status}): ${message}`, response.status);
	}
	return parsed;
}

/** Where the room's API calls go: the account and the RealtimeKit app. */
export interface VideoRoomPlace {
	account: string;
	application: string;
}

const places = new Map<string, Promise<VideoRoomPlace>>();

async function findPlace(settings: VideoRoomSettings, fetcher: Fetcher): Promise<VideoRoomPlace> {
	let account = settings.account;
	if (!account) {
		// The account the token belongs to (Cloudflare API, "List Accounts").
		const answer = await request(fetcher, settings.token, 'GET', `${apiRoot}/accounts`);
		const accounts = Array.isArray(answer.result) ? (answer.result as { id?: string }[]) : [];
		if (accounts.length !== 1 || !accounts[0].id) {
			throw new RealtimeKitError(`The video room token reaches ${accounts.length} accounts; set VIDEO_ROOM_ACCOUNT to the one to use.`, 500);
		}
		account = accounts[0].id;
	}
	let application = settings.application;
	if (!application) {
		// The app made in the dashboard (Cloudflare API, RealtimeKit "Fetch all apps"). The site does not
		// make one itself: only an app made in the dashboard comes with the default presets the room
		// uses (Cloudflare, RealtimeKit "Preset", "Create a Preset").
		const listed = await request(fetcher, settings.token, 'GET', `${apiRoot}/accounts/${encodeURIComponent(account)}/realtime/kit/apps`);
		const apps = (Array.isArray(listed.data) ? listed.data : []) as { id?: string; name?: string; created_at?: string }[];
		const ours = apps.filter((app) => app.id && app.name === videoRoomAppName).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
		if (ours.length > 0) application = ours[0].id as string;
		else if (apps.length === 1 && apps[0].id) application = apps[0].id;
		else if (apps.length === 0) {
			throw new RealtimeKitError('There is no RealtimeKit app yet. Make one in the Cloudflare dashboard under Realtime, RealtimeKit.', 500);
		} else {
			throw new RealtimeKitError(`The account has ${apps.length} RealtimeKit apps; name the one to use "${videoRoomAppName}", or set VIDEO_ROOM_APPLICATION.`, 500);
		}
	}
	return { account, application };
}

/**
 * The account and app the room uses: as set, or found from the token once
 * per Worker instance and kept. A failed lookup is tried again next time.
 */
export function videoRoomPlace(settings: VideoRoomSettings, fetcher: Fetcher = fetch): Promise<VideoRoomPlace> {
	if (settings.account && settings.application) return Promise.resolve({ account: settings.account, application: settings.application });
	const key = `${settings.token}|${settings.account ?? ''}|${settings.application ?? ''}`;
	let found = places.get(key);
	if (!found) {
		found = findPlace(settings, fetcher);
		places.set(key, found);
		found.catch(() => places.delete(key));
	}
	return found;
}

/** Forgets places found from tokens, for tests. */
export function forgetVideoRoomPlaces(): void {
	places.clear();
}

async function call<T>(settings: VideoRoomSettings, fetcher: Fetcher, method: string, path: string, body?: unknown): Promise<T> {
	const place = await videoRoomPlace(settings, fetcher);
	const address = `${apiRoot}/accounts/${encodeURIComponent(place.account)}/realtime/kit/${encodeURIComponent(place.application)}${path}`;
	return (await request(fetcher, settings.token, method, address, body)).data as T;
}

/**
 * Asks RealtimeKit for one page of one meeting, for the Service checks page:
 * proves the token, the account and the app without making or changing
 * anything. Returns how many meetings the app has, when RealtimeKit says.
 */
export async function readMeetingTotal(settings: VideoRoomSettings, fetcher: Fetcher = fetch): Promise<{ place: VideoRoomPlace; total: number | null }> {
	const place = await videoRoomPlace(settings, fetcher);
	const address = `${apiRoot}/accounts/${encodeURIComponent(place.account)}/realtime/kit/${encodeURIComponent(place.application)}/meetings?per_page=1&page_no=1`;
	const answer = (await request(fetcher, settings.token, 'GET', address)) as Answer & { paging?: { total_count?: number } };
	return { place, total: typeof answer.paging?.total_count === 'number' ? answer.paging.total_count : null };
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

/**
 * Removes everyone from a meeting's live session, when a host closes a room.
 * Returns false when nobody was in it (RealtimeKit answers 404 when there is
 * no live session).
 */
export async function endActiveSession(settings: VideoRoomSettings, meeting: string, fetcher: Fetcher = fetch): Promise<boolean> {
	try {
		await call<unknown>(settings, fetcher, 'POST', `/meetings/${encodeURIComponent(meeting)}/active-session/kick-all`);
		return true;
	} catch (problem) {
		if (problem instanceof RealtimeKitError && problem.status === 404) return false;
		throw problem;
	}
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
