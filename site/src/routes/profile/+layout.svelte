<script lang="ts">
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="profile-bar">
	<span class="small">Signed in as <strong>{data.email}</strong></span>
	<span class="links">
		{#if data.hasWorkspaceAccess}<a href="/workspace">Workspace</a>{/if}
		<form method="post" action="/sign-out">
			<button class="button button-quiet" type="submit">Sign out</button>
		</form>
	</span>
</div>

<div class="reading">
	{@render children()}
</div>

<style>
	.profile-bar {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-3);
		border-bottom: 1px solid var(--color-line);
		padding-bottom: var(--space-3);
		margin-bottom: var(--space-5);
	}

	.links {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}

	.links form {
		margin: 0;
	}
</style>
