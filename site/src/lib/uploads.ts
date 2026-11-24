/**
 * Files people send for review (docs/uploads.md, decision record 0038): the
 * kinds of file, the statuses each upload moves through, and the words the
 * pages use for them. Shared by the browser and the Worker, so it holds no
 * database or storage code.
 */

/** Files are sent in pieces of this size; only the last piece may be smaller. */
export const pieceBytes = 10 * 1024 * 1024;

export const uploadKinds = ['document', 'picture', 'sound', 'video'] as const;
export type UploadKind = (typeof uploadKinds)[number];

export const uploadKindLabels: Record<UploadKind, string> = {
	document: 'Document',
	picture: 'Picture',
	sound: 'Sound recording',
	video: 'Video'
};

const megabyte = 1024 * 1024;

/** The largest file of each kind (decision record 0038). */
export const largestFileBytes: Record<UploadKind, number> = {
	document: 100 * megabyte,
	picture: 50 * megabyte,
	sound: 1024 * megabyte,
	video: 5 * 1024 * megabyte
};

/** The largest file of any kind, checked before the first piece arrives. */
export const largestAnyFileBytes = Math.max(...Object.values(largestFileBytes));


/**
 * Why a file cannot be sent, judged by its name alone, so the upload table can
 * mark it as a problem as soon as it is added (design/upload-table, mockup 1).
 * The server still judges every file by its first bytes
 * (src/lib/server/upload-checks.ts); this only catches the obvious ones early.
 */
export function refusedByName(name: string): string | undefined {
	const extension = /\.([A-Za-z0-9]{1,8})$/.exec(name.trim())?.[1]?.toLowerCase() ?? '';
	if (['html', 'htm', 'xhtml', 'mht', 'mhtml'].includes(extension)) return 'Web pages can’t be sent. Save it as a PDF.';
	if (extension === 'svg') return 'SVG pictures can’t be sent. Save it as a PNG.';
	if (['docm', 'xlsm', 'pptm', 'dotm', 'xltm'].includes(extension)) return 'Office files with macros can’t be accepted.';
	if (['doc', 'xls', 'ppt'].includes(extension)) return 'Older Word and Excel files can’t be accepted. Save it as a PDF, .docx or .xlsx.';
	if (['7z', 'rar', 'gz', 'tar', 'tgz'].includes(extension)) return 'Only ZIP archives can be sent. Unpack this one first.';
	if (['exe', 'dll', 'msi', 'bat', 'cmd', 'sh', 'js', 'ps1', 'app', 'dmg', 'apk', 'jar'].includes(extension))
		return 'Programs and scripts can’t be sent.';
	return undefined;
}

/** Where an upload's bytes are: a file in the private bucket, or a YouTube video it links to. */
export const uploadSources = ['file', 'youtube'] as const;
export type UploadSource = (typeof uploadSources)[number];

/** How the upload came in. Essay figures skip the review queue: publishing the essay is the review. */
export const waysIn = ['send-files', 'essay-figure'] as const;
export type WayIn = (typeof waysIn)[number];

export const uploadStatuses = [
	'sending',
	'checking',
	'not-accepted',
	'waiting-for-review',
	'in-review',
	'needs-answer',
	'waiting-for-nation',
	'filed',
	'kept-for-reference',
	'not-used',
	'withdrawn'
] as const;
export type UploadStatus = (typeof uploadStatuses)[number];

export const uploadStatusLabels: Record<UploadStatus, string> = {
	sending: 'Sending',
	checking: 'Checking',
	'not-accepted': 'Not accepted',
	'waiting-for-review': 'Waiting for review',
	'in-review': 'In review',
	'needs-answer': 'Needs your answer',
	'waiting-for-nation': 'Waiting for the nation',
	filed: 'Filed',
	'kept-for-reference': 'Kept for reference',
	'not-used': 'Not used',
	withdrawn: 'Withdrawn'
};

/** The line under each status on Your uploads. */
export const uploadStatusExplanations: Record<UploadStatus, string> = {
	sending: 'Still arriving. Choose the same file again on Send files to pick up where it stopped.',
	checking: 'It is held for the virus check, and goes to the reviewers by itself once it passes.',
	'not-accepted': 'This file could not be accepted.',
	'waiting-for-review': 'It arrived and is waiting for a reviewer.',
	'in-review': 'A reviewer is looking at it.',
	'needs-answer': 'A reviewer asked a question.',
	'waiting-for-nation': 'You asked that the nation see it first. We are waiting for the nation.',
	filed: 'Filed in the project.',
	'kept-for-reference': 'Used privately as background for research. It is not shown on the site.',
	'not-used': 'We did not use it.',
	withdrawn: 'You withdrew it, and its file was deleted.'
};

/** The line under an intake file's status, where it differs: these are filed by the intake script, not reviewed. */
export const pulledStatusExplanations: Partial<Record<UploadStatus, string>> = {
	'waiting-for-review': 'Waiting to be filed.',
	filed: 'Filed in the research library.',
	'not-used': 'Not filed.'
};

/** The sender's own label in the workspace, where "your" would be wrong. */
export const reviewerStatusLabels: Record<UploadStatus, string> = {
	...uploadStatusLabels,
	'needs-answer': 'Waiting for the sender'
};

/** The label a nation reviewer sees, on Files about your nation. */
export const nationStatusLabels: Record<UploadStatus, string> = {
	...reviewerStatusLabels,
	'waiting-for-review': 'Not reviewed yet',
	'in-review': 'Being reviewed',
	'waiting-for-nation': 'Waiting for your nation',
	'kept-for-reference': 'Kept for reference, never shown'
};

/** Statuses in which the sender can still take a file back. */
export const withdrawableStatuses: readonly UploadStatus[] = [
	'sending',
	'checking',
	'waiting-for-review',
	'in-review',
	'needs-answer',
	'waiting-for-nation'
];

/** Statuses a reviewer still has to act on. */
export const openStatuses: readonly UploadStatus[] = ['waiting-for-review', 'in-review'];

/** Statuses waiting on someone outside the team. */
export const waitingStatuses: readonly UploadStatus[] = ['needs-answer', 'waiting-for-nation'];

/** Statuses after a decision. */
export const decidedStatuses: readonly UploadStatus[] = ['filed', 'kept-for-reference', 'not-used'];

export const checkResults = ['passed', 'careful-look', 'refused'] as const;
export type CheckResult = (typeof checkResults)[number];

export const checkResultLabels: Record<CheckResult, string> = {
	passed: 'Passed',
	'careful-look': 'Needs a careful look',
	refused: 'Refused'
};

/** "Where did they come from?" */
export const origins = ['own-work', 'with-permission', 'published', 'government', 'not-sure'] as const;
export type Origin = (typeof origins)[number];

export const originLabels: Record<Origin, string> = {
	'own-work': 'I made them',
	'with-permission': 'Someone else made them, and I have their permission',
	published: 'They were published (a book, a newspaper, a website)',
	government: 'A government made them',
	'not-sure': 'I am not sure'
};

/** The same answers, about one file, for reviewers. */
export const originReviewLabels: Record<Origin, string> = {
	'own-work': 'The sender made it',
	'with-permission': 'Someone else made it; the sender has their permission',
	published: 'Published (a book, a newspaper, a website)',
	government: 'Made by a government',
	'not-sure': 'The sender is not sure'
};

/** "How may we use them?" The values are the permittedUses of schemas/common.schema.json. */
export const permittedUses = ['background-only', 'reference-only', 'quote', 'publish-in-full'] as const;
export type PermittedUse = (typeof permittedUses)[number];

export const permittedUseLabels: Record<PermittedUse, string> = {
	'background-only': 'Background only. Don’t quote or show them.',
	'reference-only': 'Cite them as a source',
	quote: 'Quote short parts',
	'publish-in-full': 'Show them in full'
};

export const permittedUseShortLabels: Record<PermittedUse, string> = {
	'background-only': 'background only',
	'reference-only': 'cite as a source',
	quote: 'quote short parts',
	'publish-in-full': 'show in full'
};

/** Who can see a filed upload. The values are the accessLevel of schemas/common.schema.json. */
export const filedAccessLevels = ['public', 'nation-review-first', 'embargoed', 'restricted'] as const;
export type FiledAccessLevel = (typeof filedAccessLevels)[number];

export const filedAccessLevelLabels: Record<FiledAccessLevel, string> = {
	public: 'Everyone',
	'nation-review-first': 'Nation review first',
	embargoed: 'Embargoed until a date',
	restricted: 'Restricted (reviewers only)'
};

/** Where a reviewer files an upload. */
export const destinations = [
	'nation-source',
	'nation-picture',
	'nation-video',
	'story',
	'essay-figure',
	'research-library'
] as const;
export type Destination = (typeof destinations)[number];

export const destinationLabels: Record<Destination, string> = {
	'nation-source': 'Nation page: a source',
	'nation-picture': 'Nation page: a picture',
	'nation-video': 'Nation page: a video or recording',
	story: 'A story (a new telling)',
	'essay-figure': 'An essay figure',
	'research-library': 'Research library (private)'
};

/**
 * Per-account limits. None since Nov. 23, 2026 (decision record 0038,
 * "Limits"): Trevor, "Assume if they have access to this page they have been
 * vetted." The shape stays so a limit can come back for one kind of account.
 */
export interface UploadAllowance {
	filesPerDay: number;
	waitingBytes: number;
}

export const allowances = {
	unlimited: { filesPerDay: Number.POSITIVE_INFINITY, waitingBytes: Number.POSITIVE_INFINITY }
} as const satisfies Record<string, UploadAllowance>;

/** "4.2 MB", "860 KB", "1.9 GB". */
export function readableSize(bytes: number | null | undefined): string {
	if (!bytes) return '';
	if (bytes >= 1024 * megabyte) return `${(bytes / 1024 / megabyte).toFixed(1)} GB`;
	if (bytes >= megabyte) return `${(bytes / megabyte).toFixed(1)} MB`;
	return `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
}

/** Whether text has the shape of an upload reference, such as U-20261123-7KQ2MD. */
export function isUploadReference(text: string): boolean {
	return /^U-\d{8}-[0-9A-HJKMNP-TV-Z]{6}$/.test(text);
}

export function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
	return typeof value === 'string' && (list as readonly string[]).includes(value);
}
