<!-- Your data: take a copy of what the project keeps about you, or delete your account. What is kept on the device instead is in Settings, under This device. Each part is a card, as drawn (design/settings-and-account). -->
<script lang="ts">
	import { openSettings } from '#lib/settings-dialog.ts';
</script>

<svelte:head>
	<title>Your data · Tribal Law Project</title>
</svelte:head>

<h1>Your data</h1>
<p class="lead">What the project keeps about you, and how to take a copy or delete it.</p>

<section class="account-card" aria-labelledby="download-heading">
<h2 id="download-heading">Download a copy</h2>
<p>
	One file with your account’s email address and sign-in dates, your profile answers and every version you
	confirmed, your credit choices, the files and links you sent, the pages you follow and your email setting, and where you are signed in. Your
	password is never in it.
</p>
<p><a class="button button-quiet" href="/account/data/download" download>Download my data</a></p>
<p class="small muted">
	Requests sent through the request form are not tied to your account, so they are not in the file. Ask about them
	with the reference you were given.
</p>
</section>

<section class="account-card" aria-labelledby="device-heading">
<h2 id="device-heading">Kept on this device, not with your account</h2>
<p>
	Your display settings, print choices, starred pages and pages saved for offline reading stay in this browser. You
	can export or clear them in Settings, under This device.
</p>
<p class="needs-scripts"><button class="button button-quiet" type="button" onclick={(event) => openSettings('device', event.currentTarget)}>Open Settings</button></p>
</section>

<section class="account-card danger-card" aria-labelledby="delete-heading">
<h2 id="delete-heading">Delete your account</h2>
<p>
	Deletes your sign-in, your profile, your workspace access and the pages you follow, at once. You choose whether
	your name stays on work you helped with.
</p>
<p><a class="button button-quiet danger" href="/profile/delete-account">Delete your account</a></p>
</section>
