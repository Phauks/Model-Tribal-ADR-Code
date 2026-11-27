<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Plus from '@lucide/svelte/icons/plus';
	import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const others = $derived(data.devices.filter((device) => !device.current));
	const howSignedIn: Record<string, string> = {
		code: 'a code',
		link: 'a link',
		password: 'a password',
		passkey: 'a passkey',
		google: 'Google',
		microsoft: 'Microsoft'
	};
	const providerNames = { google: 'Google', microsoft: 'Microsoft' } as const;
	const signInAgainLink = '/sign-in?returnTo=%2Faccount%2Fsecurity';

	/** How long ago, in words, so the page reads the same in every time zone. */
	function ago(time: string): string {
		const minutes = Math.max(0, Math.round((Date.parse(data.now) - Date.parse(time)) / 60000));
		if (minutes < 2) return 'just now';
		if (minutes < 60) return `${minutes} minutes ago`;
		const hours = Math.round(minutes / 60);
		if (hours < 48) return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
		const days = Math.round(hours / 24);
		return `${days} days ago`;
	}

	/** A date such as "Nov. 26, 2026", in the project's style. */
	function day(time: string): string {
		const date = new Date(time);
		const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
		return `${month}${month.length > 3 || month === 'May' ? '' : '.'} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
	}

	// Adding a passkey happens in the browser, so its result is kept here rather than in `form`.
	let passkeysWork = $state(false);
	let adding = $state(false);
	let added = $state<string | undefined>(undefined);
	let addProblem = $state<{ message: string; stale: boolean } | undefined>(undefined);

	$effect(() => {
		passkeysWork = browserSupportsWebAuthn();
	});

	/** Asks the browser to make a passkey, and keeps it (./passkeys/+server.ts). */
	async function addPasskey() {
		adding = true;
		added = undefined;
		addProblem = undefined;
		try {
			const asked = await fetch('/account/security/passkeys', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ step: 'options' })
			});
			const options = await asked.json();
			if (!asked.ok) {
				addProblem = { message: options.problem ?? 'A passkey could not be added just now.', stale: Boolean(options.stale) };
				return;
			}
			const response = await startRegistration({ optionsJSON: options });
			const kept = await fetch('/account/security/passkeys', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ step: 'add', response })
			});
			const result: { added?: string; problem?: string; stale?: boolean } = await kept.json().catch(() => ({}));
			if (result.added) {
				added = result.added;
				await invalidateAll();
			} else {
				addProblem = { message: result.problem ?? 'A passkey could not be added just now.', stale: Boolean(result.stale) };
			}
		} catch (problem) {
			const name = problem instanceof Error ? problem.name : '';
			if (name === 'InvalidStateError') addProblem = { message: 'This device or password manager already holds a passkey for your account.', stale: false };
			else if (name !== 'NotAllowedError' && name !== 'AbortError') addProblem = { message: 'A passkey could not be added just now.', stale: false };
		} finally {
			adding = false;
		}
	}

	const notice = $derived(
		form && 'problem' in form
			? { problem: form.problem as string, stale: 'stale' in form && Boolean(form.stale) }
			: form && 'done' in form
				? { done: form.done as string }
				: added
					? { done: `Your passkey is added (${added}). Next time, choose "Sign in with a passkey".` }
					: addProblem
						? { problem: addProblem.message, stale: addProblem.stale }
						: data.notice
	);
</script>

<svelte:head>
	<title>Sign-in and security · Tribal Law Project</title>
</svelte:head>

<h1>Sign-in and security</h1>
<p class="lead">How you sign in, and where you are signed in now.</p>

{#if notice && 'problem' in notice}
	<div class="notice notice-problem" role="alert">
		<p>{notice.problem}</p>
		{#if 'stale' in notice && notice.stale}<p><a class="button" href={signInAgainLink}>Sign in again</a></p>{/if}
	</div>
{:else if notice && 'done' in notice}
	<div class="notice" role="status"><p>{notice.done}</p></div>
{/if}

<h2>Password</h2>
<p>
	{#if data.hasPassword}
		You have a password. You can also always sign in with a code sent to your email address.
	{:else}
		You have no password, so you sign in with a code sent to your email address. A password is optional.
	{/if}
</p>
<p><a class="button button-quiet" href="/profile/password">{data.hasPassword ? 'Change your password' : 'Choose a password'}</a></p>

<h2 id="passkeys-heading">Passkeys</h2>
<p>
	A passkey signs you in with your fingerprint, face or device PIN instead of a password. It counts as both
	steps, so no authenticator code is asked for.
</p>
{#if data.passkeys.length > 0}
	<ul class="items" aria-labelledby="passkeys-heading">
		{#each data.passkeys as passkey (passkey.credentialId)}
			<li>
				<div class="who">
					<KeyRound size={20} strokeWidth={1.75} aria-hidden="true" />
					<div>
						<strong>{passkey.name}</strong>
						<p class="small muted">
							Added{passkey.device ? ` on ${passkey.device}` : ''}, {day(passkey.createdAt)}.
							{passkey.lastUsedAt ? `Last used ${ago(passkey.lastUsedAt)}.` : 'Never used.'}
						</p>
					</div>
				</div>
				<form method="post" action="?/removePasskey">
					<input type="hidden" name="passkey" value={passkey.credentialId} />
					<button class="button button-quiet" type="submit">Remove<span class="visually-hidden"> {passkey.name}</span></button>
				</form>
			</li>
		{/each}
	</ul>
{/if}
{#if passkeysWork}
	<p>
		<button class="button button-quiet with-icon" type="button" disabled={adding} onclick={addPasskey}
			><Plus size={20} strokeWidth={1.75} aria-hidden="true" /> Add a passkey</button
		>
	</p>
{:else}
	<p class="small muted">This browser cannot make passkeys.</p>
{/if}

{#if data.providers.length > 0 || data.connected.length > 0}
	<h2 id="linked-heading">Google and Microsoft</h2>
	<p>
		Sign in with an account you already have. We get only your name, email address and an identifier from it,
		never your password.
	</p>
	<ul class="items" aria-labelledby="linked-heading">
		{#each (['google', 'microsoft'] as const).filter((provider) => data.providers.includes(provider) || data.connected.some((item) => item.provider === provider)) as provider (provider)}
			{@const connection = data.connected.find((item) => item.provider === provider)}
			<li>
				<div class="who">
					<img src="/sign-in/{provider}.svg" alt="" width="20" height="20" />
					<div>
						<strong>{providerNames[provider]}</strong>
						<p class="small muted">
							{#if connection}
								Connected{connection.email ? ` as ${connection.email}` : ''} on {day(connection.createdAt)}.
							{:else if provider === 'microsoft'}
								Not connected. Personal, work and school accounts all work.
							{:else}
								Not connected.
							{/if}
						</p>
					</div>
				</div>
				<form method="post" action="?/{connection ? 'disconnect' : 'connect'}">
					<input type="hidden" name="provider" value={provider} />
					<button class="button button-quiet" type="submit"
						>{connection ? 'Disconnect' : 'Connect'}<span class="visually-hidden"> {providerNames[provider]}</span></button
					>
				</form>
			</li>
		{/each}
	</ul>
{/if}

<h2>Two-step sign-in</h2>
<p>
	{#if data.twoStep.on}
		On. Signing in with a password, a code{data.providers.length > 0 ? ', Google or Microsoft' : ''} also needs a code from
		your authenticator app. You have {data.twoStep.backupCodesLeft} unused
		{data.twoStep.backupCodesLeft === 1 ? 'backup code' : 'backup codes'}.
	{:else if data.twoStepRequired}
		Off. Your role needs it, and the workspace opens once you set it up, or when you sign in with a passkey.
	{:else}
		Off. It is optional for your account: signing in would also need a code from an app on your phone.
	{/if}
</p>
<p>
	<a class="button {data.twoStep.on ? 'button-quiet' : ''}" href="/account/security/two-step"
		>{data.twoStep.on ? 'Manage two-step sign-in' : 'Set up two-step sign-in'}</a
	>
</p>

<h2 id="devices-heading">Where you are signed in</h2>
<p>
	Each browser you sign in with is listed until it signs out or its session ends: 12 hours after signing in,
	or 30 days if you chose "Keep me signed in" on an account without workspace access. Only the browser’s
	name and the times are kept, never where you were.
</p>
<ul class="devices" aria-labelledby="devices-heading">
	{#each data.devices as device (device.handle)}
		<li>
			<div>
				<strong>{device.device}</strong>
				{#if device.current}<span class="this-device">This device</span>{/if}
				<p class="small muted">
					Signed in with {howSignedIn[device.method] ?? 'a code'} {ago(device.createdAt)}. Last used {ago(
						device.lastSeenAt
					)}.
				</p>
			</div>
			{#if !device.current}
				<form method="post" action="?/signOut">
					<input type="hidden" name="device" value={device.handle} />
					<button class="button button-quiet" type="submit">Sign out<span class="visually-hidden"> {device.device}</span></button>
				</form>
			{/if}
		</li>
	{/each}
</ul>
{#if others.length > 0}
	<form method="post" action="?/signOutOthers">
		<p><button class="button button-quiet" type="submit">Sign out everywhere else</button></p>
	</form>
{/if}
<p class="small muted">To sign out on this device, use Sign out in the account menu at the top of the page.</p>

<style>
	.devices,
	.items {
		list-style: none;
		padding: 0;
		margin: var(--space-4) 0;
	}

	.devices li,
	.items li {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: center;
		justify-content: space-between;
		padding: var(--space-3) 0;
		border-top: 1px solid var(--color-line);
	}

	.devices li:last-child,
	.items li:last-child {
		border-bottom: 1px solid var(--color-line);
	}

	.devices p,
	.items p {
		margin: var(--space-1) 0 0;
	}

	.devices form,
	.items form {
		margin: 0;
	}

	.who {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
	}

	.who > :global(svg),
	.who > img {
		flex: none;
		margin-top: 3px;
	}

	.with-icon {
		gap: var(--space-2);
	}

	.this-device {
		margin-left: var(--space-2);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		color: var(--color-link);
	}
</style>
