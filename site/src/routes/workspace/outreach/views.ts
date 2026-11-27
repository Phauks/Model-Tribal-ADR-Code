// The Outreach page's views, in the order the left column lists them
// (design/outreach-redesign). Batches lists every batch but cancelled ones;
// Replies and Follow up due list conversations.
export const outreachViews = [
	{ key: 'all', label: 'Batches', count: 'all' },
	{ key: 'sending', label: 'Sending', count: 'sending' },
	{ key: 'scheduled', label: 'Scheduled', count: 'scheduled' },
	{ key: 'drafts', label: 'Drafts', count: 'drafts' },
	{ key: 'done', label: 'Finished', count: null },
	{ key: 'replies', label: 'Replies', count: 'replies' },
	{ key: 'follow', label: 'Follow up due', count: 'followUp' }
] as const;

export type OutreachView = (typeof outreachViews)[number]['key'];

export function isOutreachView(value: string | null): value is OutreachView {
	return outreachViews.some((view) => view.key === value);
}

export const outreachBase = '/workspace/outreach';

export function viewLink(view: OutreachView): string {
	return view === 'all' ? outreachBase : `${outreachBase}?view=${view}`;
}
