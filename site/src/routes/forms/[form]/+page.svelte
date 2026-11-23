<script lang="ts">
	import FileVerifier from '#lib/components/FileVerifier.svelte';
	import FormDocument from '#lib/components/FormDocument.svelte';
	import { verifyLink } from '#lib/checksums.ts';
	import { formHtml } from '#lib/forms.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const template = $derived(data.template);
	const way = $derived(form && 'way' in form ? form.way : undefined);
	const sent = $derived(form && 'sent' in form ? form.sent : undefined);
	const problem = $derived(form && 'problem' in form ? form.problem : undefined);
	const errors: Record<string, string> = $derived(form && 'errors' in form ? (form.errors ?? {}) : {});
	const values: Record<string, string> = $derived(form && 'values' in form ? (form.values ?? {}) : {});
	const onlineValues = $derived(way === 'online' ? values : {});
	const uploadValues = $derived(way === 'upload' ? values : {});
	const onlineErrors = $derived(way === 'online' ? errors : {});
	const uploadErrors = $derived(way === 'upload' ? errors : {});
	const signatureField = $derived(
		template.fields.find((field) => field.kind === 'signature' && !field.projectOnly)?.name ?? 'send'
	);
	/** Each problem, linked to the field it is about (WCAG 3.3.1). */
	const errorLinks = $derived(
		Object.entries(onlineErrors).map(([name, message]) => ({
			name,
			message,
			target: /^f\d+$/.test(name) ? `form-${name}` : name === 'signature' ? `form-${signatureField}` : `send-${name}`
		}))
	);
	const accepted = 'application/pdf,image/png,image/jpeg,image/webp';

	function focusOnArrival(node: HTMLElement) {
		node.focus();
	}

	function printPage() {
		window.print();
	}
</script>

<svelte:head>
	<title>{template.title} · Forms · Model Tribal ADR Code</title>
	<meta name="description" content="{template.title}. When to use it: {template.summary}." />
</svelte:head>

{#snippet fieldError(errors: Record<string, string>, prefix: string, name: string)}
	{#if errors[name]}
		<p class="field-error" id="{prefix}{name}-error"><span class="visually-hidden">Error:</span> {errors[name]}</p>
	{/if}
{/snippet}

{#snippet senderFields(prefix: string, errors: Record<string, string>, values: Record<string, string>)}
	<div class="field">
		<label for="{prefix}senderName">Your name</label>
		{@render fieldError(errors, prefix, 'senderName')}
		<input
			id="{prefix}senderName"
			name="senderName"
			type="text"
			autocomplete="name"
			value={values.senderName ?? ''}
			aria-invalid={errors.senderName ? 'true' : undefined}
			aria-describedby={errors.senderName ? `${prefix}senderName-error` : undefined}
		/>
	</div>
	<div class="field">
		<label for="{prefix}contact">Email address or phone number</label>
		<p class="hint" id="{prefix}contact-hint">So we can reply and send you a copy. Never published.</p>
		{@render fieldError(errors, prefix, 'contact')}
		<input
			id="{prefix}contact"
			name="contact"
			type="text"
			autocomplete="email"
			value={values.contact ?? ''}
			aria-invalid={errors.contact ? 'true' : undefined}
			aria-describedby="{prefix}contact-hint{errors.contact ? ` ${prefix}contact-error` : ''}"
		/>
	</div>
	<div class="field">
		<label for="{prefix}note">Anything else we should know (optional)</label>
		{@render fieldError(errors, prefix, 'note')}
		<textarea id="{prefix}note" name="note" rows="3">{values.note ?? ''}</textarea>
	</div>
	<div class="trap" aria-hidden="true">
		<label for="{prefix}website">Leave this empty</label>
		<input type="text" id="{prefix}website" name="website" tabindex="-1" autocomplete="off" />
	</div>
{/snippet}

<div class="reading">
	<p class="small no-print">
		<a href="/forms">All forms</a> · <a href="/forms/{template.slug}/print">Print a blank copy</a>
	</p>
	<h1>{template.title}</h1>

	{#if sent}
		<div class="panel panel-filled" role="status" tabindex="-1" {@attach focusOnArrival}>
			<p>We received your form. Your reference number is</p>
			<p class="reference"><strong>{sent.reference}</strong></p>
			<p class="small">
				Received {new Date(sent.receivedAt).toLocaleDateString('en-US', { dateStyle: 'long' })}. Please keep
				this number and quote it if you write to us about this form.
			</p>
		</div>
		<h2>What happens next</h2>
		<ul>
			<li>We reply within 7 days, using the contact details you gave.</li>
			<li>We send you a copy of the form for your records.</li>
			<li>Your form is kept private. Only the lead author and editors see it.</li>
			<li>You can change your mind at any time with the <a href="/forms/change-or-withdrawal-request">Change or withdrawal</a> form, or just tell us.</li>
		</ul>
		{#if sent.way === 'online'}
			<h2>Your copy</h2>
			<p class="no-print">
				<button class="button button-quiet" type="button" onclick={printPage}>Print or save this copy</button>
			</p>
			<FormDocument html={formHtml(template, 'filled', sent.answers)} mode="filled" />
			<p class="small">Sent through the website by {sent.senderName}, who agreed that the name typed in the signature line is their signature.</p>
		{/if}
	{:else}
		<p class="lead no-print">
			{#if data.sendable}
				Fill in what applies to you, type your name in the signature line, and send it. Or print a blank
				copy, sign it by hand and <a href="#upload">send us a photo or scan</a>.
			{:else}
				Fill in the form and print it, or save it as a PDF from the Print window. Nothing you type is sent
				to us.
			{/if}
		</p>
		<p class="small muted no-print">You can say no to any part of the form. Leave out anything you would rather not answer.</p>
		{#if template.downloads}
			<section class="form-downloads no-print" aria-labelledby="form-downloads-heading">
				<h2 id="form-downloads-heading">Download</h2>
				<p>A copy to change in a word processor, or to print and fill in by hand.</p>
				<ul>
					{#each template.downloads as download (download.href)}
						<li>
							<a href={download.href} download>{download.href.slice(download.href.lastIndexOf('.'))}<span class="visually-hidden"> ({download.kind})</span></a>
							<span class="small muted">({Math.max(1, Math.round(download.bytes / 1024))} KB)</span>
							<br />
							<span class="small"
								>SHA-256: <code class="form-hash">{download.sha256}</code> ·
								<a href={verifyLink(download.sha256, download.href.split('/').pop())}>Check this file</a></span
							>
						</li>
					{/each}
				</ul>
				<details class="form-check">
					<summary>Check a file you downloaded</summary>
					<FileVerifier identifier="form-verify" />
					<p class="small">
						The file is checked on your device and never sent to us. On a computer you can also put the files in
						one folder with <a href="/help/forms/SHA256SUMS.txt">this list of hashes</a> and run
						<code>sha256sum -c SHA256SUMS.txt</code>.
					</p>
				</details>
			</section>
		{/if}

		{#if problem}
			<div class="notice notice-problem" role="alert" tabindex="-1" {@attach focusOnArrival}><p>{problem}</p></div>
		{/if}
		{#if way === 'online' && Object.keys(onlineErrors).length > 0}
			<div class="notice notice-problem" role="alert" tabindex="-1" {@attach focusOnArrival}>
				<p><strong>Please check the form.</strong></p>
				<ul>
					{#each errorLinks as error (error.name)}
						<li><a href="#{error.target}">{error.message}</a></li>
					{/each}
				</ul>
			</div>
		{/if}

		<form method="post" action="?/send" novalidate>
			<FormDocument html={formHtml(template, 'online', onlineValues)} mode="online" />

			{#if data.sendable}
				<fieldset id="send" class="panel no-print">
					<legend><h2>Send the form</h2></legend>
					{@render senderFields('send-', onlineErrors, onlineValues)}
					<div class="field">
						{@render fieldError(onlineErrors, 'send-', 'electronicSignature')}
						<div class="choice">
							<input
								type="checkbox"
								id="send-electronicSignature"
								name="electronicSignature"
								checked={onlineValues.electronicSignature === 'on'}
								aria-invalid={onlineErrors.electronicSignature ? 'true' : undefined}
							/>
							<label for="send-electronicSignature">
								The name I typed in the signature line is my signature. It counts the same as signing on paper.
							</label>
						</div>
					</div>
					<p><button class="button" type="submit">Send the form</button></p>
				</fieldset>
			{:else}
				<p class="no-print">
					<button class="button" type="button" onclick={printPage}>Print or save as PDF</button>
				</p>
			{/if}
		</form>

		{#if data.sendable}
			<section id="upload" class="panel no-print" aria-labelledby="upload-heading">
				<h2 id="upload-heading">Signed a paper copy?</h2>
				<p>
					Send us a photo or scan of every page. PDF, PNG, JPEG or WebP, up to 10 MB each. Keep the paper
					copy for yourself.
				</p>
				{#if way === 'upload' && Object.keys(uploadErrors).length > 0}
					<div class="notice notice-problem" role="alert" tabindex="-1" {@attach focusOnArrival}>
						<p><strong>Please check the answers below.</strong></p>
					</div>
				{/if}
				<form method="post" action="?/upload#upload" enctype="multipart/form-data" novalidate>
					{#each [1, 2, 3] as slot (slot)}
						<div class="field">
							<label for="upload-scan{slot}">{slot === 1 ? 'Photo or scan' : `More pages (optional)`}</label>
							{@render fieldError(uploadErrors, 'upload-', `scan${slot}`)}
							<input type="file" id="upload-scan{slot}" name="scan{slot}" accept={accepted} />
						</div>
					{/each}
					{@render senderFields('upload-', uploadErrors, uploadValues)}
					<p><button class="button" type="submit">Send the signed copy</button></p>
				</form>
			</section>
		{/if}
	{/if}
</div>

<style>
	.form-hash {
		overflow-wrap: anywhere;
	}
	fieldset {
		margin: var(--space-6) 0;
	}

	legend h2 {
		margin: 0;
	}

	.reference {
		font-size: var(--font-size-lead);
		letter-spacing: 0.05em;
	}

	.trap {
		position: absolute;
		left: -10000px;
		width: 1px;
		height: 1px;
		overflow: hidden;
	}

	.choice {
		display: flex;
		gap: var(--space-2);
		align-items: flex-start;
	}

	.choice input {
		margin-top: 0.3em;
	}

	input[type='file'] {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
	}
</style>
