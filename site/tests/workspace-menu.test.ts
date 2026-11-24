import { describe, expect, it } from 'vitest';
import { permissionsOf } from '#lib/permissions.ts';
import { readSignedInHint, signedInHintValue } from '#lib/signed-in-hint.ts';
import {
	groupWorkspacePages,
	isCurrentWorkspacePage,
	workspacePagesFor,
	workspacePagesNamed
} from '#lib/workspace-menu.ts';

const names = (pages: { name: string }[]) => pages.map((item) => item.name);

describe('the workspace pages in the left sidebar', () => {
	it('lists every page for the lead author', () => {
		expect(names(workspacePagesFor(permissionsOf('lead-author')))).toEqual([
			'overview',
			'review-requests',
			'comments',
			'reviews',
			'inbox',
			'requests',
			'outreach',
			'address-book',
			'uploads',
			'intake',
			'library',
			'nation-teams',
			'nation-pages',
			'events',
			'rooms',
			'people',
			'contributors',
			'access',
			'activity',
			'sponsors',
			'orders',
			'nonprofit',
			'site-text',
			'changes',
			'service-checks'
		]);
	});

	it('leaves out the pages a role cannot open', () => {
		expect(names(workspacePagesFor(permissionsOf('editor')))).toEqual([
			'overview',
			'review-requests',
			'comments',
			'reviews',
			'requests',
			'uploads',
			'intake',
			'library',
			'nation-pages',
			'events',
			'rooms',
			'contributors',
			'site-text'
		]);
		expect(names(workspacePagesFor(permissionsOf('co-author')))).toEqual(['overview', 'review-requests', 'comments', 'reviews', 'library', 'rooms', 'site-text']);
		expect(names(workspacePagesFor(permissionsOf('nation-reviewer')))).toEqual(['overview', 'reviews', 'nation-uploads']);
	});

	it('marks the overview only on its own page, and other pages on the pages within them', () => {
		expect(isCurrentWorkspacePage('/workspace', '/workspace')).toBe(true);
		expect(isCurrentWorkspacePage('/workspace', '/workspace/essays')).toBe(false);
		expect(isCurrentWorkspacePage('/workspace/essays', '/workspace/essays/why/edit')).toBe(true);
		expect(isCurrentWorkspacePage('/workspace/access', '/workspace/activity')).toBe(false);
	});

	it('keeps menu order and ignores unknown names', () => {
		expect(names(workspacePagesNamed(['reviews', 'overview', 'nothing']))).toEqual(['overview', 'reviews']);
	});
});

describe('the signed-in hint', () => {
	it('carries the workspace pages, or "1" when there are none', () => {
		expect(signedInHintValue(['overview', 'essays'])).toBe('overview.essays');
		expect(signedInHintValue([])).toBe('1');
	});

	it('reads back what it carries', () => {
		expect(readSignedInHint('theme=dark; signed-in-hint=overview.essays.reviews')).toEqual({
			signedIn: true,
			workspacePageNames: ['overview', 'essays', 'reviews']
		});
		expect(readSignedInHint('signed-in-hint=1')).toEqual({ signedIn: true, workspacePageNames: [] });
		expect(readSignedInHint('theme=dark')).toEqual({ signedIn: false, workspacePageNames: [] });
	});

	it('keeps page names with hyphens, such as review-requests', () => {
		const names = ['overview', 'review-requests', 'nation-uploads', 'address-book', 'orders'];
		expect(readSignedInHint(`signed-in-hint=${signedInHintValue(names)}`).workspacePageNames).toEqual(names);
		expect(readSignedInHint('signed-in-hint=overview.-bad.bad-.a--b').workspacePageNames).toEqual(['overview']);
	});

	it('ignores anything in it that is not a page name', () => {
		expect(readSignedInHint('signed-in-hint=overview.<b>.essays').workspacePageNames).toEqual([
			'overview',
			'essays'
		]);
	});
});

describe('the workspace pages under their categories', () => {
	it('puts Overview first on its own, then each category in order', () => {
		const groups = groupWorkspacePages(workspacePagesFor(permissionsOf('lead-author')));
		expect(groups.map((group) => group.category ?? 'none')).toEqual([
			'none',
			'Writing and review',
			'Messages',
			'Files and sources',
			'Nations',
			'Events',
			'People and access',
			'Money',
			'Site'
		]);
		expect(names(groups[0].pages)).toEqual(['overview']);
		expect(names(groups.find((group) => group.category === 'Money')?.pages ?? [])).toEqual(['sponsors', 'orders', 'nonprofit']);
	});

	it('leaves out a category none of the person’s pages are in', () => {
		const groups = groupWorkspacePages(workspacePagesFor(permissionsOf('nation-reviewer')));
		expect(groups.map((group) => group.category ?? 'none')).toEqual(['none', 'Writing and review', 'Files and sources']);
	});
});
