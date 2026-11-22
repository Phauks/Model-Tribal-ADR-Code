<script lang="ts">
	// What the reader sees once a request is saved: the reference number and
	// what happens next (docs/requests.md). Used by the request page and the
	// Report a problem dialog.
	import type { RequestKind } from '#lib/requests.ts';

	let {
		sent,
		headingLevel = 2
	}: {
		sent: { reference: string; kind: RequestKind; receivedAt: string };
		/** 2 on the request page, 3 inside a dialog. */
		headingLevel?: 2 | 3;
	} = $props();
</script>

<div class="panel panel-filled" role="status">
	<p>Your reference number is</p>
	<p class="reference"><strong>{sent.reference}</strong></p>
	<p class="small">
		Received {new Date(sent.receivedAt).toLocaleDateString('en-US', { dateStyle: 'long' })}. Please keep this number; quote it if you write again or apply again.
	</p>
</div>
<svelte:element this={`h${headingLevel}`}>What happens next</svelte:element>
<ul>
	<li>We acknowledge the request within 7 days, using the contact details you gave.</li>
	{#if sent.kind === 'restrict' || sent.kind === 'remove'}
		<li>The material you named is taken out of public view within 7 days, before it is reviewed.</li>
	{/if}
	{#if sent.kind === 'add-nation'}
		<li>We check each source in the government’s own publication, then search our list for the nation under other names. Usually a decision follows within 30 days of the acknowledgment.</li>
	{/if}
	<li>A request about a nation is confirmed with that nation’s own office before it is final.</li>
	<li>Your request and any files you sent are kept private. They are never published.</li>
</ul>

<style>
	.reference {
		font-size: var(--font-size-lead);
		letter-spacing: 0.05em;
	}
</style>
