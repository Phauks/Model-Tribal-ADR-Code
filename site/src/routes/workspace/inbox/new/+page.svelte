<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Info from '@lucide/svelte/icons/info';
	import Composer from '../Composer.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const values = $derived(form && 'values' in form ? form.values : { to: data.to, from: data.defaultAddress, subject: '', text: '' });
</script>

<svelte:head>
	<title>Write a message · Inbox · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<div class="head">
	<a class="icon-button" href="/workspace/inbox" aria-label="Back to the inbox" title="Back to the inbox"><ArrowLeft size={20} aria-hidden="true" /></a>
	<h1>New message</h1>
</div>

<p class="small muted about">
	<Info size={16} aria-hidden="true" />
	<span>
		For mail people expect from the project, such as an answer to a question asked elsewhere. A first letter to a nation goes out as
		<a href="/workspace/outreach">outreach</a>, through the outreach mailbox, because the service that carries this mail may not be used for
		unsolicited mail.
	</span>
</p>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{/if}

<div class="compose">
	{#key form}
		<Composer
			action=""
			idPrefix="new"
			addresses={data.addresses}
			from={values.from || data.defaultAddress}
			to={values.to}
			subject={values.subject}
			text={values.text}
			suggestions={data.suggestions}
			discard="/workspace/inbox"
		/>
	{/key}
</div>

<style>
	.head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}
	.head h1 {
		margin: 0;
	}
	.about {
		display: flex;
		gap: var(--space-2);
		align-items: flex-start;
		max-width: 60rem;
		margin: 0 0 var(--space-4);
	}
	.about :global(svg) {
		flex: none;
		margin-top: 0.15em;
	}
	.compose {
		max-width: 60rem;
	}
</style>
