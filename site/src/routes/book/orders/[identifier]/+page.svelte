<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatDollars } from '#lib/book-order.ts';
	import {
		kindsWithPhoto,
		orderStatusText,
		problemKindHints,
		problemKindLabels,
		problemKinds,
		problemStatusLabels,
		type ProblemKind
	} from '#lib/book-order-problems.ts';
	import { readableDate } from '#lib/readable-date.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const values = $derived(form && 'values' in form ? (form.values as { kind?: string; details?: string } | undefined) : undefined);
	let kind = $state<ProblemKind | ''>('');
	$effect(() => {
		if (values?.kind) kind = values.kind as ProblemKind;
	});
	let sending = $state(false);
	const money = (cents: number) => formatDollars(cents / 100);
	const day = (stamp: string) => readableDate(stamp.slice(0, 10));
</script>

<svelte:head>
	<title>Your printed copy · Model Tribal ADR Code</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="reading">
	<h1>Your printed copy</h1>
	{#if data.justPaid}
		<p class="lead">Thank you. Stripe has emailed your receipt. Keep this page’s address to check on the order.</p>
	{/if}
	{#if data.order.mode === 'test'}
		<div class="notice" role="status"><p>Test order: nothing was charged and nothing will be printed.</p></div>
	{/if}
	<div class="panel">
		<p><strong>{data.order.title}</strong>, {data.order.pages} pages, {money(data.order.priceCents)}</p>
		<p class="small muted">Ordered {day(data.order.placedAt)}</p>
		<p>{orderStatusText[data.order.status] ?? data.order.status}</p>
		{#if data.order.refundedCents > 0}
			<p>
				<strong>Refunded {money(data.order.refundedCents)}</strong>{data.order.refundedAt ? ` on ${day(data.order.refundedAt)}` : ''}. Your bank
				may take 5 to 10 days to show it.
			</p>
		{/if}
		{#if data.order.trackingLink}
			<p><a href={data.order.trackingLink} rel="noreferrer">Track the package</a></p>
		{/if}
	</div>
	{#if data.order.onAccount}
		<p class="small muted">This order is also listed under <a href="/account/orders">Your orders</a>.</p>
	{/if}

	{#if data.problems.length > 0}
		<h2>Problems you reported</h2>
		<ul class="problems">
			{#each data.problems as problem (problem.identifier)}
				<li class="panel">
					<p>
						<strong>{problemKindLabels[problem.kind]}</strong>
						<span class="muted">· {day(problem.reportedAt)} · {problemStatusLabels[problem.status]}</span>
					</p>
					<p class="details">{problem.details}</p>
					{#if problem.hasPhoto}<p class="small muted">With a photo.</p>{/if}
					{#if problem.answer}
						<div class="answer">
							<p class="small"><strong>The project’s answer</strong></p>
							<p class="details">{problem.answer}</p>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	{#if data.order.mayReport}
		<section aria-labelledby="problem-heading">
			<h2 id="problem-heading">Problem with this order?</h2>
			{#if form && 'problemSent' in form}
				<div class="notice" role="status">
					<p>Thank you. The project has your report and will answer here, on this page, and by email once email is set up.</p>
				</div>
			{/if}
			<form
				method="POST"
				action="?/problem"
				enctype="multipart/form-data"
				use:enhance={() => {
					sending = true;
					return async ({ update, result }) => {
						await update({ reset: result.type === 'success' });
						if (result.type === 'success') kind = '';
						sending = false;
					};
				}}
			>
				<fieldset class="kinds">
					<legend>What went wrong?</legend>
					{#each problemKinds as option (option)}
						<label class="choice">
							<input type="radio" name="kind" value={option} bind:group={kind} required />
							{problemKindLabels[option]}
						</label>
					{/each}
				</fieldset>
				{#if kind}
					<p class="small hint">{problemKindHints[kind]}</p>
				{/if}
				<div class="field">
					<label for="problem-details">What happened</label>
					<textarea id="problem-details" name="details" rows="5" maxlength="4000" required>{values?.details ?? ''}</textarea>
				</div>
				<div class="field">
					<label for="problem-photo">
						Photo {kind && kindsWithPhoto.includes(kind) ? '' : '(optional)'}
					</label>
					<input
						id="problem-photo"
						type="file"
						name="photo"
						accept="image/png,image/jpeg,image/webp"
						required={Boolean(kind && kindsWithPhoto.includes(kind))}
					/>
					<p class="small muted">PNG, JPEG or WebP, up to 10 MB. It is checked for viruses, and only the project sees it.</p>
				</div>
				{#if form && 'problemError' in form && form.problemError}
					<p class="field-error" role="alert">{form.problemError}</p>
				{/if}
				<button type="submit" class="button" disabled={sending}>{sending ? 'Sending…' : 'Send to the project'}</button>
			</form>
		</section>
	{/if}
</div>

<style>
	.problems {
		display: grid;
		gap: var(--space-3);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.details {
		white-space: pre-wrap;
	}

	.answer {
		margin-top: var(--space-2);
		padding-left: var(--space-3);
		border-left: 3px solid var(--color-action);
	}

	.kinds {
		display: grid;
		gap: var(--space-1);
		margin: var(--space-3) 0;
		padding: 0;
		border: 0;
	}

	.kinds legend {
		margin-bottom: var(--space-2);
		font-weight: var(--font-weight-bold);
	}

	.choice {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 44px;
	}

	.choice input {
		width: 1.1rem;
		height: 1.1rem;
		margin: 0;
		accent-color: var(--color-action);
	}

	.hint {
		margin-top: 0;
	}
</style>
