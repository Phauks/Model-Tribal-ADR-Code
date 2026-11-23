import { describe, expect, it } from 'vitest';
import { permissionsOf } from '#lib/permissions.ts';
import { readSignedInHint, signedInHintValue } from '#lib/signed-in-hint.ts';
import {
	isCurrentWorkspacePage,
	workspacePagesFor,
	workspacePagesNamed
} from '#lib/workspace-menu.ts';

const names = (pages: { name: string }[]) => pages.map((item) => item.name);

describe('the workspace pages in the left sidebar', () => {
	it('lists all nine pages for the lead author', () => {
		expect(names(workspacePagesFor(permissionsOf('lead-author')))).toEqual([
			'overview',
			'essays',
			'requests',
			'uploads',
			'reviews',
			'contributors',
			'people',
			'access',
			'address-book',
			'activity'
		]);
	});

	it('leaves out the pages a role cannot open', () => {
		expect(names(workspacePagesFor(permissionsOf('editor')))).toEqual([
			'overview',
			'essays',
			'requests',
			'uploads',
			'reviews',
			'contributors'
		]);
		expect(names(workspacePagesFor(permissionsOf('co-author')))).toEqual(['overview', 'essays', 'reviews']);
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

	it('ignores anything in it that is not a page name', () => {
		expect(readSignedInHint('signed-in-hint=overview.<b>.essays').workspacePageNames).toEqual([
			'overview',
			'essays'
		]);
	});
});
