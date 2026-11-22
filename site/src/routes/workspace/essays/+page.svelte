<script lang="ts">
	// "Start an essay" is a plus button beside the heading that opens its form
	// in a dialog (Trevor asked on Nov. 22, 2026), rather than a form at the
	// foot of the list.
	import Plus from '@lucide/svelte/icons/plus';
	import Modal from '#lib/components/Modal.svelte';
	import { accessLevelLabels } from '#lib/permissions.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let startDialog: Modal<string> | undefined = $state();
</script>

<svelte:head>
	<title>Essays · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<div class="heading-row">
	<h1>Essays</h1>
	{#if data.canStart}
		<button
			class="icon-button start-button"
			type="button"
			aria-haspopup="dialog"
			aria-label="Start an essay"
			title="Start an essay"
			onclick={() => startDialog?.open()}
		>
			<Plus size={26} />
		</button>
	{/if}
</div>
<p>
	Essays are kept in the site’s private storage. Every save keeps a new version and never overwrites an
	earlier one. Readers see a version only once someone with full access publishes it.
</p>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

{#if data.essays.length === 0}
	<p>No essays are open to you yet.</p>
{:else}
	<ul class="essay-rows">
		{#each data.essays as essay (essay.identifier)}
			<li class="panel">
				<h2><a href="/workspace/essays/{essay.identifier}">{essay.title}</a></h2>
				<p class="small muted">
					{essay.part} · your access: {accessLevelLabels[essay.level].toLocaleLowerCase('en-US')}
					{#if essay.latestVersion} · version {essay.latestVersion}, saved {essay.latestSavedAt}{/if}
				</p>
				<p class="small">
					{#if essay.published}
						Version {essay.published.versionNumber} is published (<a href={essay.published.link}>read it</a>), since {essay.published.at}.
					{:else}
						Not published.
					{/if}
				</p>
				<p class="essay-row-actions">
					{#if essay.level === 'contribute' || essay.level === 'full'}
						<a class="button" href="/workspace/essays/{essay.identifier}/edit">Edit</a>
					{:else}
						<a class="button" href="/workspace/essays/{essay.identifier}/edit">Read</a>
					{/if}
					<a class="button button-quiet" href="/workspace/essays/{essay.identifier}">Versions</a>
				</p>
			</li>
		{/each}
	</ul>
{/if}

{#if data.gitChanges.length > 0}
	<section class="panel">
		<h2>Text in git</h2>
		<p class="small">
			These essays in git differ from their newest version here, or are not here yet. Bringing one in saves
			the git text as a new version; nothing here is overwritten. Use it for text other threads changed in
			git, such as the Foundations chapters.
		</p>
		<ul class="git-list">
			{#each data.gitChanges as copy (copy.identifier)}
				<li>
					<form method="post" action="?/bringIn">
						<input type="hidden" name="essay" value={copy.identifier} />
						<code>{copy.identifier}</code>
						<span class="small muted">{copy.inBucket ? 'differs from the newest version' : 'not here yet'}</span>
						<button class="button button-quiet" type="submit">Bring in</button>
					</form>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if data.canStart}
	<Modal bind:this={startDialog} title="Start an essay" fitContent>
		<form method="post" action="?/start" id="start-essay-form">
			<div class="field">
				<label for="essay-title">Title</label>
				<input type="text" id="essay-title" name="title" required />
			</div>
			<div class="field">
				<label for="essay-part">Where it goes</label>
				<select id="essay-part" name="part">
					{#each data.parts as part (part.value)}
						<option value={part.value}>{part.label}</option>
					{/each}
				</select>
			</div>
			<div class="field">
				<label for="essay-identifier">Address</label>
				<p class="hint" id="essay-identifier-hint">Lower-case words joined by hyphens, such as why-consent-matters. It becomes the page’s address and cannot be changed later.</p>
				<input
					type="text"
					id="essay-identifier"
					name="identifier"
					required
					pattern="[a-z0-9]+(-[a-z0-9]+)*"
					aria-describedby="essay-identifier-hint"
				/>
			</div>
		</form>
		{#snippet actions()}
			<button class="button" type="submit" form="start-essay-form">Start the essay</button>
			<button class="button button-quiet" type="button" onclick={() => startDialog?.close()}>Cancel</button>
		{/snippet}
	</Modal>
{/if}

<style>
	.heading-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.heading-row h1 {
		margin-right: auto;
	}

	/* Round, with a light fill, so it reads as a button on the page. */
	.start-button {
		flex: none;
		border-radius: 50%;
		background: var(--color-surface);
		color: var(--color-link);
	}
	.essay-rows {
		list-style: none;
		padding: 0;
	}

	.essay-rows h2 {
		font-size: var(--font-size-heading-3);
		margin: 0 0 var(--space-1);
	}

	.essay-row-actions,
	.git-list form {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}

	.git-list {
		list-style: none;
		padding: 0;
	}

	.git-list li {
		margin-bottom: var(--space-2);
	}
</style>
