// A rule's actions in words, for the rules list and the editor's summary.
import type { RuleAction } from '#lib/mail.ts';

const builtIn: Record<string, string> = { archive: 'Archive', spam: 'Spam', trash: 'Deleted' };

export function describeAction(
	action: RuleAction,
	names: { folders: { identifier: string; path: string }[]; tags: { identifier: string; name: string }[]; people: { identifier: string; name: string }[] }
): string {
	switch (action.action) {
		case 'move':
			return `Move to ${builtIn[action.value] ?? names.folders.find((item) => item.identifier === action.value)?.path ?? 'a folder that is gone'}`;
		case 'tag':
			return `Tag “${names.tags.find((item) => item.identifier === action.value)?.name ?? 'a tag that is gone'}”`;
		case 'assign':
			return `Assign to ${names.people.find((item) => item.identifier === action.value)?.name ?? 'someone who is gone'}`;
		case 'read':
			return 'Mark as read';
	}
}
