<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let zone = $state('America/Denver');
	onMount(() => {
		zone = Intl.DateTimeFormat().resolvedOptions().timeZone || zone;
	});
	const values = $derived(form && 'values' in form ? form.values : { to: data.to, subject: '', text: '' });
</script>

<svelte:head>
	<title>Write a message · Inbox · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<p class="small"><a href="/workspace/inbox">Inbox</a></p>
<h1>Write a message</h1>
<p class="lead">
	For mail people expect from the project, such as an answer to a question asked elsewhere. A first letter to a nation goes out as
	<a href="/workspace/outreach">outreach</a> instead, through the outreach mailbox, because the service that carries this mail may not be
	used for unsolicited mail.
</p>
{#if !data.emailOn}
	<div class="notice" role="status"><p>Email is not switched on yet, so the message would be kept but not sent.</p></div>
{/if}
{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{/if}

<form method="post" enctype="multipart/form-data" class="compose">
	<input type="hidden" name="zone" value={zone} />
	<div class="field">
		<label for="from">From</label>
		<select id="from" name="from">
			{#each data.addresses as address (address)}<option value={address}>{address}</option>{/each}
		</select>
	</div>
	<div class="field">
		<label for="to">To <span class="small muted">(separate addresses with commas; addresses from the address book are suggested)</span></label>
		<input type="text" id="to" name="to" list="address-book" value={values.to} required autocomplete="off" />
		<datalist id="address-book">
			{#each data.suggestions as suggestion (suggestion.email)}<option value={suggestion.email}>{suggestion.label}</option>{/each}
		</datalist>
	</div>
	<details>
		<summary class="small">Cc and Bcc</summary>
		<div class="field"><label for="cc">Cc</label><input type="text" id="cc" name="cc" list="address-book" /></div>
		<div class="field"><label for="bcc">Bcc</label><input type="text" id="bcc" name="bcc" list="address-book" /></div>
	</details>
	<div class="field">
		<label for="subject">Subject</label>
		<input type="text" id="subject" name="subject" value={values.subject} required />
	</div>
	<div class="field">
		<label for="text">Message</label>
		<textarea id="text" name="text" rows="14" required>{values.text}</textarea>
	</div>
	<div class="field">
		<label for="files">Attachments</label>
		<input id="files" type="file" name="attachments" multiple />
	</div>
	<div class="field">
		<label for="send-at">Send later <span class="small muted">(optional, your time)</span></label>
		<input id="send-at" type="datetime-local" name="sendAt" />
	</div>
	<div class="field">
		<label for="follow-up">Remind me if no reply by <span class="small muted">(optional)</span></label>
		<input id="follow-up" type="datetime-local" name="followUpAt" />
	</div>
	<button class="button" type="submit">Send</button>
</form>

<style>
	.compose {
		max-width: var(--layout-measure);
	}
</style>
