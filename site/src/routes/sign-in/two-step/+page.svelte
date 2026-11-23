<script lang="ts">
	import ErrorSummary from '#lib/components/ErrorSummary.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const problem = $derived(form?.problem);
	const ended = $derived(form && 'ended' in form ? form.ended : false);
	const problems = $derived(problem ? [{ field: ended ? undefined : 'code', message: problem }] : []);
</script>

<svelte:head>
	<title>{problem ? 'Error: ' : ''}Confirm it is you · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<h1>Confirm it is you</h1>

	<ErrorSummary {problems} />

	{#if ended}
		<p><a class="button" href="/sign-in?returnTo={encodeURIComponent(data.returnTo)}">Sign in again</a></p>
	{:else}
		<p>
			You are signing in as <strong>{data.email}</strong>. Open your authenticator app and type the six-digit
			code it shows for Model Tribal ADR Code.
		</p>
		<form method="post" action="?/confirm" class="panel">
			<input type="hidden" name="returnTo" value={data.returnTo} />
			<div class="field">
				<label for="code">Code from your authenticator app</label>
				<p class="hint" id="code-hint">The code changes every 30 seconds. If you do not have your phone, type one of your backup codes instead.</p>
				{#if problem}
					<p class="field-error" id="code-error"><span class="visually-hidden">Error:</span> {problem}</p>
				{/if}
				<input
					id="code"
					name="code"
					type="text"
					class="code-field"
					autocomplete="one-time-code"
					autocapitalize="none"
					spellcheck="false"
					maxlength="16"
					aria-describedby={problem ? 'code-hint code-error' : 'code-hint'}
					aria-invalid={problem ? 'true' : undefined}
					required
				/>
			</div>
			<button class="button wide" type="submit">Continue</button>
		</form>
		<form method="post" action="?/cancel">
			<p class="small">
				Lost your phone and your backup codes? Ask the lead author to switch off two-step sign-in for your
				account. <button class="button-link" type="submit">Cancel this sign-in</button>
			</p>
		</form>
	{/if}
</div>

<style>
	.panel {
		max-width: 30rem;
	}

	.code-field {
		max-width: 16ch;
		font-size: var(--font-size-lead);
		letter-spacing: 0.1em;
	}

	.wide {
		width: 100%;
		justify-content: center;
	}

	.button-link {
		background: none;
		border: none;
		color: var(--color-link);
		cursor: pointer;
		font: inherit;
		padding: 0;
		text-decoration: underline;
	}
</style>
