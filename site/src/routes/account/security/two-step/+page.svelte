<script lang="ts">
	import CodeInput from '#lib/components/CodeInput.svelte';
	import ErrorSummary from '#lib/components/ErrorSummary.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const problem = $derived(form && 'problem' in form ? form.problem : undefined);
	const field = $derived(form && 'field' in form ? (form.field as string | undefined) : undefined);
	const stale = $derived(Boolean(form && 'stale' in form && form.stale) || (!data.recent && !(form && 'setUp' in form)));
	const setUp = $derived(form && 'setUp' in form ? form.setUp : undefined);
	const backupCodes = $derived(form && 'backupCodes' in form ? form.backupCodes : undefined);
	const justTurnedOn = $derived(form && 'justTurnedOn' in form ? form.justTurnedOn : false);
	const done = $derived(form && 'done' in form ? form.done : undefined);
	const problems = $derived(problem ? [{ field, message: problem }] : []);
	const on = $derived(Boolean(backupCodes) || (data.state.on && !done));
	const signInAgainLink = $derived(`/sign-in?returnTo=${encodeURIComponent(`/account/security/two-step?returnTo=${encodeURIComponent(data.returnTo)}`)}`);
	// Each form keeps the page it came from, so "I have saved them" goes back there.
	const after = $derived(`&returnTo=${encodeURIComponent(data.returnTo)}`);
	const onwards = $derived(data.returnTo === '/workspace' && !data.required ? '/account/security' : data.returnTo);
</script>

<svelte:head>
	<title>{problem ? 'Error: ' : ''}Two-step sign-in · Model Tribal ADR Code</title>
</svelte:head>

<p class="small"><a href="/account/security">Sign-in and security</a></p>
<h1>Two-step sign-in</h1>

<ErrorSummary {problems} />

{#if done}
	<div class="notice" role="status"><p>{done}</p></div>
{/if}

{#if backupCodes}
	<div class="notice" role="status">
		<p><strong>{justTurnedOn ? 'Two-step sign-in is on.' : 'Your new backup codes are ready.'}</strong></p>
		<p>
			{justTurnedOn ? 'Every other browser signed in to your account has been signed out.' : 'Your old backup codes no longer work.'}
		</p>
	</div>
	<h2>Save your backup codes</h2>
	<p>
		If you lose your phone, each of these codes signs you in once in place of a code from the app. Keep them
		somewhere safe that is not your phone: a password manager, or printed and put away. They are shown only
		this once.
	</p>
	<ul class="backup-codes">
		{#each backupCodes as code (code)}
			<li><code>{code}</code></li>
		{/each}
	</ul>
	<p class="actions">
		<button class="button button-quiet" type="button" onclick={() => window.print()}>Print the codes</button>
		<a class="button" href={onwards}>I have saved them</a>
	</p>
{:else if setUp}
	<h2>Set up your authenticator app</h2>
	<ol class="steps">
		<li>
			<p>
				Open an authenticator app on your phone, such as Google Authenticator, Microsoft Authenticator, or the
				one built into your password manager, and add an account.
			</p>
		</li>
		<li>
			<p>Scan this QR code with the app.</p>
			<svg
				class="scan-code"
				viewBox="-4 -4 {setUp.scanCode.size + 8} {setUp.scanCode.size + 8}"
				role="img"
				aria-label="QR code for adding Model Tribal ADR Code to an authenticator app. The key below does the same."
				shape-rendering="crispEdges"
			>
				<rect class="scan-code-light" x="-4" y="-4" width={setUp.scanCode.size + 8} height={setUp.scanCode.size + 8} />
				<path class="scan-code-dark" d={setUp.scanCode.path} />
			</svg>
			<p class="small">
				Cannot scan it? Choose to type a key in the app, and type this one:
				<code class="secret">{setUp.secret}</code>
				On this phone? <a href={setUp.link}>Open it in your authenticator app</a>.
			</p>
		</li>
		<li>
			<form method="post" action="?/confirm{after}" class="panel">
				<div class="field">
					<label for="code">Type the six-digit code the app shows</label>
					{#if field === 'code' && problem}
						<p class="field-error" id="code-error"><span class="visually-hidden">Error:</span> {problem}</p>
					{/if}
					<CodeInput
						id="code"
						name="code"
						describedBy={field === 'code' && problem ? 'code-error' : undefined}
						invalid={field === 'code' && Boolean(problem)}
					/>
				</div>
				<button class="button" type="submit">Turn on two-step sign-in</button>
			</form>
		</li>
	</ol>
{:else}
	{#if data.askedBecauseRequired && !on}
		<div class="notice" role="status">
			<p>
				<strong>Your role needs two-step sign-in.</strong> The workspace opens once you set it up. It takes
				about two minutes and needs a phone.
			</p>
		</div>
	{:else if data.fewBackupCodesLeft !== null}
		<div class="notice" role="status">
			<p>
				You signed in with a backup code. You have {data.fewBackupCodesLeft}
				{data.fewBackupCodesLeft === 1 ? 'backup code' : 'backup codes'} left. Make new ones below before you run out.
			</p>
		</div>
	{/if}

	<p class="lead">
		With two-step sign-in, signing in needs your password or email code and also a code from an app on your
		phone, so someone who learns your password still cannot get in.
	</p>

	{#if on}
		<p>
			<strong>Two-step sign-in is on.</strong>
			{#if data.state.addedAt}You set up your app on {new Date(data.state.addedAt).toLocaleDateString('en-US', { dateStyle: 'long' })}.{/if}
			You have {data.state.backupCodesLeft} unused {data.state.backupCodesLeft === 1 ? 'backup code' : 'backup codes'}.
		</p>
	{:else}
		<p>
			<strong>Two-step sign-in is off.</strong>
			{data.required ? 'Your role needs it.' : 'It is optional for your account, and recommended.'}
		</p>
	{/if}

	{#if stale}
		<div class="notice" role="status">
			<p>For your safety, changes here need a sign-in from the last 10 minutes.</p>
			<p><a class="button" href={signInAgainLink}>Sign in again</a></p>
		</div>
	{:else if on}
		<div class="choices">
			<form method="post" action="?/codes{after}">
				<button class="button button-quiet" type="submit">Make new backup codes</button>
			</form>
			<form method="post" action="?/start{after}">
				<button class="button button-quiet" type="submit">Move to a new phone or app</button>
			</form>
			{#if !data.required}
				<form method="post" action="?/off{after}">
					<button class="button button-quiet" type="submit">Turn off two-step sign-in</button>
				</form>
			{/if}
		</div>
	{:else}
		<form method="post" action="?/start{after}">
			<button class="button" type="submit">Set up an authenticator app</button>
		</form>
	{/if}
{/if}

<style>
	.panel {
		max-width: var(--layout-panel);
	}

	.steps {
		max-width: var(--layout-measure);
		padding-left: var(--space-5);
	}

	.steps > li {
		margin-bottom: var(--space-5);
	}

	.scan-code {
		display: block;
		width: 12rem;
		height: 12rem;
		margin: var(--space-3) 0;
	}

	.scan-code-light {
		fill: var(--color-scan-code-light);
	}

	.scan-code-dark {
		fill: var(--color-scan-code-dark);
	}

	.secret {
		display: block;
		margin: var(--space-2) 0;
		font-size: var(--font-size-lead);
		letter-spacing: 0.05em;
		overflow-wrap: anywhere;
	}


	.backup-codes {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
		gap: var(--space-2) var(--space-5);
		max-width: var(--layout-panel);
		list-style: none;
		padding: 0;
		font-size: var(--font-size-lead);
	}

	.actions,
	.choices {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: center;
	}

	.choices form {
		margin: 0;
	}

	@media print {
		.actions {
			display: none;
		}
	}
</style>
