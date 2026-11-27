import { describe, expect, it } from 'vitest';
import { accountPages } from '#lib/account-menu.ts';
import { accountSection, isWorkspacePath, personalSectionOf, workspaceSection } from '#lib/personal-navigation.ts';
import { holdingNavigationLink } from '#lib/site-navigation.ts';
import { workspacePages, workspacePagesNamed } from '#lib/workspace-menu.ts';

describe('the Workspace as a section', () => {
	it('is left out for someone without workspace access', () => {
		expect(workspaceSection([])).toBeUndefined();
	});

	it('lists the pages under their categories, with Overview as its home', () => {
		const section = workspaceSection(workspacePages);
		expect(section?.label).toBe('Workspace');
		expect(section?.home).toBe('/workspace');
		expect(section?.groups.map((group) => group.title)).toEqual([
			'Writing and review',
			'Messages',
			'Files and sources',
			'Nations',
			'Events',
			'People and access',
			'Money',
			'Site'
		]);
		// Overview is the home, not a link in a group.
		expect(section?.groups.flatMap((group) => group.links).some((link) => link.link === '/workspace')).toBe(false);
	});

	it('lists only the categories the person has pages in', () => {
		const section = workspaceSection(workspacePagesNamed(['overview', 'inbox', 'requests']));
		expect(section?.groups).toEqual([
			{ title: 'Messages', links: [{ label: 'Inbox', link: '/workspace/inbox' }, { label: 'Requests', link: '/workspace/requests' }] }
		]);
	});

	it('marks the page a message in the inbox belongs to', () => {
		const section = workspaceSection(workspacePages);
		expect(section && holdingNavigationLink(section, '/workspace/inbox/123', '')?.link).toBe('/workspace/inbox');
	});
});

describe('the Account pages as a section', () => {
	it('has every account page, the person’s own first and the settings after', () => {
		expect(accountSection.groups.map((group) => group.title)).toEqual(['', 'Settings']);
		const links = accountSection.groups.flatMap((group) => group.links.map((link) => link.link));
		expect(links).toEqual(accountPages.map((item) => item.link));
		expect(accountSection.groups[0].links.map((link) => link.label)).toEqual(['Profile and credit', 'Following', 'Your uploads', 'Nation team']);
	});
});

describe('which personal place a page is in', () => {
	const workspace = workspaceSection(workspacePages);

	it('knows the workspace pages', () => {
		expect(isWorkspacePath('/workspace')).toBe(true);
		expect(isWorkspacePath('/workspace/inbox')).toBe(true);
		expect(isWorkspacePath('/workspaces')).toBe(false);
		expect(personalSectionOf('/workspace/people', workspace)).toBe(workspace);
	});

	it('lists no workspace for someone without access', () => {
		expect(personalSectionOf('/workspace/people', undefined)).toBeUndefined();
	});

	it('knows the account pages', () => {
		expect(personalSectionOf('/account/email', workspace)).toBe(accountSection);
		expect(personalSectionOf('/profile/edit', workspace)).toBe(accountSection);
		expect(personalSectionOf('/following', workspace)).toBe(accountSection);
		expect(personalSectionOf('/nations', workspace)).toBeUndefined();
	});
});
