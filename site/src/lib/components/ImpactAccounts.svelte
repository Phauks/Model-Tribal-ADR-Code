<!--
	@component
	"Accounts of its impact" on a law's, treaty's or case's page
	(src/lib/server/impact-accounts.ts; Trevor, Nov. 24, 2026): each account
	that names it, labeled by whose account it is, with the account's own
	words that name it and the other laws and events the same account names.
	Left out when no account names the page's law.
-->
<script lang="ts">
	import CountBadge from './CountBadge.svelte';
	import type { AccountEntry } from '#lib/server/impact-accounts.ts';

	let { accounts }: { accounts: AccountEntry[] } = $props();
</script>

{#if accounts.length > 0}
	<section aria-labelledby="accounts-of-its-impact">
		<h2 id="accounts-of-its-impact">Accounts of its impact <CountBadge count={accounts.length} /></h2>
		<ul class="impact-accounts">
			{#each accounts as account (account.id)}
				<li>
					<p class="account-title"><a href={account.link}>{account.title}</a> <span class="topic-badge account-type">{account.type}</span></p>
					<p class="small muted account-detail">{account.teller}.{#if account.detail}{' '}{account.detail}.{/if}</p>
					{#if account.excerpt}
						<blockquote class="account-words">
							<p>{account.excerpt.text}</p>
							<footer class="small muted">{account.excerpt.locator}</footer>
						</blockquote>
					{/if}
					{#if account.also.length > 0}
						<p class="small account-also">
							Also names: {#each account.also as other, index (other.name)}{#if index > 0}{', '}{/if}{#if other.link}<a href={other.link}>{#if other.italic}<i>{other.name}</i>{:else}{other.name}{/if}</a>{:else}{other.name}{/if}{/each}
						</p>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.impact-accounts {
		display: grid;
		gap: var(--space-4);
		padding: 0;
		list-style: none;
	}

	.impact-accounts li {
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--color-line);
	}

	.impact-accounts p {
		margin: 0;
	}

	.account-title {
		font-weight: var(--font-weight-semibold);
	}

	.account-type {
		margin-left: var(--space-1);
		font-weight: normal;
		vertical-align: 0.1em;
	}

	.account-detail {
		margin-top: var(--space-1);
	}

	.account-words {
		margin: var(--space-3) 0 0;
	}

	.account-words footer {
		margin-top: var(--space-1);
	}

	.account-also {
		margin-top: var(--space-2);
	}
</style>
