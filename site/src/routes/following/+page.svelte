<script lang="ts">
	// The reader's Following page (site/DESIGN.md, section 6, "Follow").
	import BellOff from '@lucide/svelte/icons/bell-off';
	import History from '@lucide/svelte/icons/history';
	import { followKindLabels } from '#lib/following.ts';
	import { readableDate } from '#lib/readable-date.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	function day(iso: string): string {
		return readableDate(iso.slice(0, 10));
	}
</script>

<svelte:head>
	<title>Following · Model Tribal ADR Code</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="reading">
	<h1>Following</h1>
	<p class="lead">
		When a page you follow changes, it is listed here, and you can choose to get an email. To follow a page,
		press the bell at the top of a nation's page, the model code or an essay.
	</p>

	{#if form?.done}
		<div class="notice" role="status"><p>{form.done}</p></div>
	{:else if form?.problem}
		<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
	{/if}

	<h2>Updates</h2>
	{#if data.notices.length === 0}
		<p class="muted">No updates yet. When a page you follow changes, it is listed here.</p>
	{:else}
		<ol class="following-list">
			{#each data.notices as notice (`${notice.address} ${notice.updatedAt}`)}
				<li class="following-item">
					<p class="item-title">
						<a href={notice.address}>{notice.title}</a>
						{#if notice.unread}<span class="new-tag">New</span>{/if}
					</p>
					<p class="hint item-detail">{followKindLabels[notice.kind]} · Updated {day(notice.updatedAt)}</p>
					{#if notice.history}
						<p class="item-actions">
							<a class="button button-quiet" href={notice.history}>
								<History size={20} strokeWidth={1.75} />
								What changed<span class="visually-hidden">: {notice.title}</span>
							</a>
						</p>
					{/if}
				</li>
			{/each}
		</ol>
		<p class="small muted">
			An update says only that the page changed. Nation pages have no public list of earlier versions,
			because a nation may ask for something to be taken off its page.
		</p>
	{/if}

	<h2>Pages you follow</h2>
	{#if data.pages.length === 0}
		<p class="muted">You do not follow any pages yet.</p>
	{:else}
		<ul class="following-list">
			{#each data.pages as page (page.address)}
				<li class="following-item">
					<p class="item-title">
						{#if page.title}
							<a href={page.address}>{page.title}</a>
						{:else}
							<span>A page that is no longer on the site</span>
						{/if}
					</p>
					<p class="hint item-detail">
						{page.kind ? `${followKindLabels[page.kind]} · ` : ''}Followed {day(page.followedAt)}
					</p>
					<form method="post" action="?/unfollow" class="item-actions">
						<input type="hidden" name="address" value={page.address} />
						<button class="button button-quiet" type="submit">
							<BellOff size={20} strokeWidth={1.75} />
							Stop following<span class="visually-hidden">: {page.title ?? 'this page'}</span>
						</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}

	<h2>Email</h2>
	<p>
		{data.emailLine}
		<a href="/account/email">Change how often you get email</a>, in your account.
	</p>
</div>

<style>
	.following-list {
		list-style: none;
		margin: var(--space-4) 0 var(--space-4);
		padding: 0;
	}

	.following-item {
		padding: var(--space-4) 0;
		border-top: 1px solid var(--color-line);
	}

	.following-item:last-child {
		border-bottom: 1px solid var(--color-line);
	}

	.item-title {
		margin: 0;
		font-size: var(--font-size-lead);
		font-weight: var(--font-weight-semibold);
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-2);
	}

	.new-tag {
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		color: var(--color-action);
		border: 1px solid currentColor;
		border-radius: var(--radius-control);
		padding: 0 var(--space-2);
	}

	.item-detail {
		margin: var(--space-1) 0 0;
	}

	.item-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin: var(--space-3) 0 0;
	}

	.item-actions .button,
	form .button {
		gap: var(--space-2);
	}


</style>
