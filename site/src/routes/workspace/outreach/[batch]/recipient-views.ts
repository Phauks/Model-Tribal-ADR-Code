// The chips over a batch's recipients (design/outreach-redesign): each shows the recipients in some states. Failed and unsubscribed recipients have chips of their own that show only when there are some.
export const recipientViews = [
	{ key: 'all', label: 'All', statuses: null, always: true },
	{ key: 'waiting', label: 'Waiting', statuses: ['queued'], always: true },
	{ key: 'sent', label: 'Sent', statuses: ['sent'], always: true },
	{ key: 'replied', label: 'Replied', statuses: ['replied'], always: true },
	{ key: 'bounced', label: 'Bounced', statuses: ['bounced'], always: true },
	{ key: 'failed', label: 'Failed', statuses: ['failed'], always: false },
	{ key: 'unsubscribed', label: 'Asked to stop', statuses: ['unsubscribed'], always: false },
	{ key: 'left-out', label: 'Left out', statuses: ['skipped'], always: true }
] as const satisfies readonly { key: string; label: string; statuses: readonly string[] | null; always: boolean }[];

/** Whether a recipient in this state shows under a chip. */
export function inView(view: (typeof recipientViews)[number], status: string): boolean {
	return view.statuses === null || (view.statuses as readonly string[]).includes(status);
}
