<script lang="ts">
	import CodeInput from '#lib/components/CodeInput.svelte';
	import ErrorSummary from '#lib/components/ErrorSummary.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const problem = $derived(form?.problem);
	// After a wrong code the address no longer says which field was shown, so the form says.
	const backup = $derived(form && 'backup' in form && form.backup !== undefined ? form.backup : data.backup);
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
			You are signing in as <strong>{data.email}</strong>.
			{backup
				? 'Type one of the backup codes you saved when you set up two-step sign-in. Each one works once.'
				: 'Open your authenticator app and type the six-digit code it shows for Model Tribal ADR Code.'}
		</p>
		<form method="post" action="?/confirm" class="panel">
			<input type="hidden" name="returnTo" value={data.returnTo} />
			<input type="hidden" name="kind" value={backup ? 'backup' : 'app'} />
			<div class="field">
				<label for="code">{backup ? 'Backup code' : 'Code from your authenticator app'}</label>
				<p class="hint" id="code-hint">
					{backup ? 'For example, 7k2mq-x9d4r. Capitals and dashes do not matter.' : 'The code changes every 30 seconds.'}
				</p>
				{#if problem}
					<p class="field-error" id="code-error"><span class="visually-hidden">Error:</span> {problem}</p>
				{/if}
				{#if backup}
					<input
						id="code"
						name="code"
						type="text"
						class="backup-field"
						autocomplete="off"
						autocapitalize="none"
						spellcheck="false"
						maxlength="16"
						aria-describedby={problem ? 'code-hint code-error' : 'code-hint'}
						aria-invalid={problem ? 'true' : undefined}
						required
					/>
				{:else}
					<CodeInput id="code" name="code" describedBy={problem ? 'code-hint code-error' : 'code-hint'} invalid={Boolean(problem)} />
				{/if}
			</div>
			<button class="button wide" type="submit">Continue</button>
		</form>
		<p class="small">
			{#if backup}
				<a href="/sign-in/two-step?returnTo={encodeURIComponent(data.returnTo)}">Use your authenticator app instead</a>
			{:else}
				No phone with you? <a href="/sign-in/two-step?returnTo={encodeURIComponent(data.returnTo)}&amp;backup=1">Use a backup code instead</a>
			{/if}
		</p>
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
		max-width: var(--layout-panel);
	}

	.backup-field {
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
