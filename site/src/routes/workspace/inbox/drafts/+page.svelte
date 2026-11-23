<script lang="ts">
	// The person's drafts, newest first; each opens where it was being written.
	import FilePen from '@lucide/svelte/icons/file-pen';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { listDate, fullDate } from '../dates.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	function opens(draft: (typeof data.drafts)[number]): string {
		return draft.threadIdentifier ? `/workspace/inbox/${draft.threadIdentifier}?draft#reply` : `/workspace/inbox/new?draft=${draft.identifier}`;
	}
	function preview(text: string): string {
		const words = text.split(/\n-- \n/)[0].replace(/\s+/g, ' ').trim();
		return words.length > 140 ? `${words.slice(0, 139)}…` : words || '(nothing written yet)';
	}
</script>

<svelte:head>
	<title>Drafts · Inbox · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<h1>Drafts</h1>
<p class="lead">Messages and replies you started and have not sent. They save as you type, and only you see them.</p>

{#if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

{#if data.drafts.length}
	<ul class="drafts">
		{#each data.drafts as draft (draft.identifier)}
			<li>
				<a href={opens(draft)} class="draft">
					<FilePen size={18} aria-hidden="true" />
					<span class="what">
						<strong>{draft.fields.subject || draft.threadSubject || '(no subject)'}</strong>
						<span class="small muted">{draft.threadIdentifier ? 'Reply' : 'New message'}{draft.fields.to ? ` to ${draft.fields.to}` : ''}</span>
						<span class="small muted preview">{preview(draft.fields.text)}</span>
					</span>
					<span class="small muted" title={fullDate(draft.updatedAt)}>{listDate(draft.updatedAt)}</span>
				</a>
				<form method="post" action="?/discard">
					<input type="hidden" name="identifier" value={draft.identifier} />
					<button class="icon-button" type="submit" aria-label="Discard this draft" title="Discard this draft"><Trash2 size={18} aria-hidden="true" /></button>
				</form>
			</li>
		{/each}
	</ul>
{:else}
	<p class="muted">No drafts. Anything you start writing is kept here until you send it or discard it.</p>
{/if}

<style>
	.drafts {
		list-style: none;
		margin: 0;
		padding: 0;
		max-width: 60rem;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
	}
	.drafts li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding-right: var(--space-2);
		border-bottom: 1px solid var(--color-line);
	}
	.drafts li:last-child {
		border-bottom: 0;
	}
	.draft {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		color: var(--color-ink);
		text-decoration: none;
	}
	.draft:hover {
		background: var(--color-surface);
	}
	.draft :global(svg) {
		flex: none;
		margin-top: 0.2em;
		color: var(--color-ink-muted);
	}
	.what {
		flex: 1;
		min-width: 0;
		display: grid;
	}
	.preview {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
