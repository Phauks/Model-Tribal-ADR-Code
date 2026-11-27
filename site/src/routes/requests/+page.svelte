<script lang="ts">
	import RequestForm from '#lib/components/RequestForm.svelte';
	import RequestSent from '#lib/components/RequestSent.svelte';
	import { requestKindHints, requestKindLabels, requestKinds, type RequestKind } from '#lib/requests.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// An error page's Report link may say what to put in Details to start with.
	const values: Record<string, string> = $derived(
		form && 'values' in form ? (form.values ?? {}) : data.details ? { details: data.details } : {}
	);
	const errors: Record<string, string> = $derived(form && 'errors' in form ? (form.errors ?? {}) : {});
	const problem = $derived(form && 'problem' in form ? form.problem : undefined);
	const sent = $derived(form && 'sent' in form ? form.sent : undefined);
	const kind: RequestKind | undefined = $derived(
		(values.kind as RequestKind | undefined) ?? data.kind
	);
</script>

<svelte:head>
	<title>{data.toTeam ? 'Write to the nation’s team' : 'Make a request'} · Tribal Law Project</title>
</svelte:head>

<div class="reading">
	{#if sent}
		<h1>Request sent</h1>
		<RequestSent {sent} />
		<p><a href="/">Return to the home page</a></p>
	{:else}
		{#if data.teamPage}<p class="small"><a href={data.teamPage.link}>{data.teamPage.title}</a></p>{/if}
		<h1>{data.toTeam ? 'Write to the nation’s team' : 'Make a request'}</h1>
		{#if !data.toTeam}<p class="lead">
			Ask us to correct, restrict or remove material about a Native nation, ask to add a
			nation that is missing, offer to contribute, or ask a question. No account is needed.
		</p>{/if}

		{#if !kind}
			<form method="get" action="/requests">
				{#if data.record}<input type="hidden" name="record" value={data.record} />{/if}
				{#if data.field}<input type="hidden" name="field" value={data.field} />{/if}
				<fieldset>
					<legend><h2>What would you like to do?</h2></legend>
					{#each requestKinds as option (option)}
						<div class="choice">
							<input type="radio" id="kind-{option}" name="kind" value={option} required />
							<label for="kind-{option}">
								{requestKindLabels[option]}
								<span class="hint">{requestKindHints[option]}</span>
							</label>
						</div>
					{/each}
				</fieldset>
				<p><button class="button" type="submit">Continue</button></p>
			</form>
			<p class="small muted">
				Please do not use public GitHub issues for a request about a nation.
			</p>
		{:else if data.toTeam}
			<RequestForm
				{kind}
				nationIdentifier={data.nationIdentifier}
				material={data.material}
				{values}
				{errors}
				{problem}
				toTeam
			/>
		{:else}
			<p>
				<strong>{requestKindLabels[kind]}.</strong>
				{requestKindHints[kind]}
				<a href="/requests{data.record ? `?record=${encodeURIComponent(data.record)}` : ''}"
					>Choose something else</a
				>
			</p>

			<RequestForm
				{kind}
				nationIdentifier={data.nationIdentifier}
				material={data.material}
				{values}
				{errors}
				{problem}
			/>
		{/if}
	{/if}
</div>

<style>
	fieldset {
		border: 0;
		margin: 0 0 var(--space-5);
		padding: 0;
		min-width: 0;
	}

	legend {
		padding: 0;
	}

	legend h2 {
		margin-bottom: var(--space-2);
	}

	.choice {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		margin: var(--space-3) 0;
	}

	.choice input {
		margin-top: 0.3em;
		width: 1.25rem;
		height: 1.25rem;
		flex: none;
	}

	.choice .hint {
		display: block;
	}
</style>
