<script lang="ts">
	import { methodStatusNames } from '#lib/address-book.ts';
	import { differenceKindNames, type DifferenceKind } from '#lib/address-book-sync.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const kinds: DifferenceKind[] = ['page-shows-old', 'book-only', 'page-only'];
	const advice: Record<DifferenceKind, string> = {
		'page-shows-old':
			'The page still shows an address the book has marked replaced, bounced or retired. Correct the profile by pull request, or put the address back in use in the book if the mark was wrong.',
		'book-only':
			'The book holds an office address the page does not show, often one a directory listed after the page was built. Add it to the profile by pull request, with its source, if it belongs on the page.',
		'page-only':
			'The page shows an office address the book lacks. Bring it in below; the weekly check and Check now on the Address book page also do this.'
	};
</script>

<svelte:head>
	<title>Differences · Address book · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<p class="small"><a href="/workspace/address-book">Address book</a></p>
<h1>Differences with the nation pages</h1>
<p>
	Office emails and phones on which the nation pages and the address book disagree. The pages show what the profiles in
	the repository say, with their sources, as of the last build; the book is the private working list. Leaders' own
	addresses are never on a page, so they are not compared.
	<a href="/workspace/address-book/differences/differences.csv" download>Download the list (CSV)</a> to turn it into a
	pull request.
</p>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

{#if data.differences.length === 0}
	<p>None: the nation pages and the address book agree.</p>
{/if}

{#each kinds as kind (kind)}
	{@const items = data.differences.filter((item) => item.kind === kind)}
	{#if items.length > 0}
		<section>
			<h2>{differenceKindNames[kind]} ({items.length})</h2>
			<p class="small">{advice[kind]}</p>
			<ul>
				{#each items as item (`${item.nationIdentifier} ${item.method} ${item.value}`)}
					<li>
						<a href="/nations/{item.nationIdentifier}">{item.nationName}</a>: {item.method === 'email' ? 'email' : 'phone'}
						{item.value}
						<span class="small muted">
							({#if item.sourceLink}<a href={item.sourceLink} rel="noreferrer">{item.sourceTitle}</a>{:else}{item.sourceTitle}{/if}{#if item.status}; {methodStatusNames[
									item.status
								].toLocaleLowerCase('en-US')}{#if item.note}: {item.note}{/if}{/if})
						</span>
					</li>
				{/each}
			</ul>
			{#if kind === 'page-only'}
				<form method="post" action="?/bringIn">
					<button class="button" type="submit">Bring these into the address book</button>
				</form>
			{/if}
		</section>
	{/if}
{/each}
