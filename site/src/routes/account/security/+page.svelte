<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const others = $derived(data.devices.filter((device) => !device.current));
	const howSignedIn: Record<string, string> = { code: 'a code', link: 'a link', password: 'a password' };

	/** How long ago, in words, so the page reads the same in every time zone. */
	function ago(time: string): string {
		const minutes = Math.max(0, Math.round((Date.parse(data.now) - Date.parse(time)) / 60000));
		if (minutes < 2) return 'just now';
		if (minutes < 60) return `${minutes} minutes ago`;
		const hours = Math.round(minutes / 60);
		return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
	}
</script>

<svelte:head>
	<title>Sign-in and security · Model Tribal ADR Code</title>
</svelte:head>

<h1>Sign-in and security</h1>
<p class="lead">How you sign in, and where you are signed in now.</p>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
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

<h2 id="devices-heading">Where you are signed in</h2>
<p>
	Each browser you sign in with is listed until it signs out or its session ends, at most 12 hours after
	signing in. Only the browser’s name and the times are kept, never where you were.
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
	.devices {
		list-style: none;
		padding: 0;
		margin: var(--space-4) 0;
	}

	.devices li {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: center;
		justify-content: space-between;
		padding: var(--space-3) 0;
		border-top: 1px solid var(--color-line);
	}

	.devices li:last-child {
		border-bottom: 1px solid var(--color-line);
	}

	.devices p {
		margin: var(--space-1) 0 0;
	}

	.devices form {
		margin: 0;
	}

	.this-device {
		margin-left: var(--space-2);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		color: var(--color-link);
	}
</style>
