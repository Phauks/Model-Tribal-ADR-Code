<script lang="ts">
	import { page } from '$app/state';
	import { roleLabels } from '#lib/permissions.ts';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	const menu = $derived(
		[
			{ label: 'Overview', link: '/workspace', shown: true },
			{ label: 'Requests', link: '/workspace/requests', shown: data.permissions.includes('read-requests') },
			// Everyone sees the documents they can open, by role or by grant.
			{ label: 'Reviews', link: '/workspace/reviews', shown: true },
			{
				label: 'Contributors',
				link: '/workspace/contributors',
				shown: data.permissions.includes('read-contributors')
			},
			{ label: 'People', link: '/workspace/people', shown: data.permissions.includes('manage-people') },
			{ label: 'Access', link: '/workspace/access', shown: data.permissions.includes('manage-people') },
			{ label: 'Activity log', link: '/workspace/activity', shown: data.permissions.includes('manage-people') }
		].filter((item) => item.shown)
	);

	function isCurrent(link: string): boolean {
		const path = page.url.pathname;
		return link === '/workspace' ? path === link : path === link || path.startsWith(`${link}/`);
	}
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="workspace-bar">
	<nav aria-label="Workspace">
		<ul>
			{#each menu as item (item.link)}
				<li>
					<a href={item.link} aria-current={isCurrent(item.link) ? 'page' : undefined}>{item.label}</a>
				</li>
			{/each}
		</ul>
	</nav>
	<div class="signed-in">
		<span class="small">
			Signed in as <strong>{data.person.displayName}</strong>, {roleLabels[data.person.role].toLocaleLowerCase('en-US')}
		</span>
		<a href="/profile">Your profile</a>
		<form method="post" action="/sign-out">
			<button class="button button-quiet" type="submit">Sign out</button>
		</form>
	</div>
</div>

{@render children()}

<style>
	.workspace-bar {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-3);
		border-bottom: 1px solid var(--color-line);
		padding-bottom: var(--space-3);
		margin-bottom: var(--space-5);
	}

	.workspace-bar ul {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.workspace-bar nav a {
		display: inline-flex;
		align-items: center;
		min-height: var(--layout-target-minimum);
		font-weight: var(--font-weight-semibold);
		text-decoration: none;
		border-bottom: 3px solid transparent;
	}

	.workspace-bar nav a[aria-current='page'] {
		border-bottom-color: var(--color-link);
	}

	.signed-in {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}

	.signed-in form {
		margin: 0;
	}
</style>
