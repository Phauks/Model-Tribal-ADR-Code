<script lang="ts">
	import FolderIcon from '@lucide/svelte/icons/folder';
	import FolderPlus from '@lucide/svelte/icons/folder-plus';
	import Tag from '@lucide/svelte/icons/tag';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { folderDepthLimit, tagColors } from '#lib/mail.ts';
	import TagChip from '../TagChip.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const colorNames: Record<string, string> = { teal: 'Teal', orange: 'Orange', gray: 'Gray', gold: 'Gold', green: 'Green', purple: 'Purple' };
</script>

<svelte:head>
	<title>Folders and tags · Inbox · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<h1>Folders and tags</h1>
<p class="lead">A conversation sits in one folder and can have any number of tags. <a href="/workspace/inbox/rules">Auto-sort rules</a> can file and tag mail as it arrives.</p>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

<div class="columns">
	<section class="card" aria-labelledby="folders-heading">
		<h2 id="folders-heading"><FolderIcon size={20} aria-hidden="true" />Folders</h2>
		{#if data.mailFolders.length}
			<ul class="items">
				{#each data.mailFolders as folder (folder.identifier)}
					<li style="padding-left: {folder.depth * 1.5}rem">
						<form method="post" action="?/renameFolder" class="item-form">
							<input type="hidden" name="folder" value={folder.identifier} />
							<FolderIcon size={18} aria-hidden="true" />
							<label for="folder-{folder.identifier}" class="visually-hidden">Name of the folder {folder.path}</label>
							<input type="text" id="folder-{folder.identifier}" name="name" value={folder.name} maxlength="60" required />
							<button class="button-quiet small" type="submit">Rename</button>
						</form>
						<form method="post" action="?/deleteFolder">
							<input type="hidden" name="folder" value={folder.identifier} />
							<button class="icon-button" type="submit" aria-label="Delete the folder {folder.path}" title="Delete; its mail goes back to the inbox">
								<Trash2 size={18} aria-hidden="true" />
							</button>
						</form>
					</li>
				{/each}
			</ul>
			<p class="small muted">Deleting a folder sends its conversations, and those of the folders inside it, back to the inbox.</p>
		{:else}
			<p class="muted">No folders yet. Make one for a nation, an advisor, or a kind of request.</p>
		{/if}
		<form method="post" action="?/newFolder" class="new" id="new-folder">
			<h3><FolderPlus size={18} aria-hidden="true" />New folder</h3>
			<div class="new-row">
				<div class="field">
					<label for="folder-name">Name</label>
					<input type="text" id="folder-name" name="name" maxlength="60" required />
				</div>
				<div class="field">
					<label for="folder-parent">Inside</label>
					<select id="folder-parent" name="parent">
						<option value="">Nothing (top level)</option>
						{#each data.mailFolders.filter((folder) => folder.depth < folderDepthLimit - 1) as folder (folder.identifier)}
							<option value={folder.identifier}>{folder.path}</option>
						{/each}
					</select>
				</div>
				<button class="button" type="submit">Make the folder</button>
			</div>
		</form>
	</section>

	<section class="card" aria-labelledby="tags-heading">
		<h2 id="tags-heading"><Tag size={20} aria-hidden="true" />Tags</h2>
		{#if data.tags.length}
			<ul class="items">
				{#each data.tags as tag (tag.identifier)}
					<li>
						<form method="post" action="?/changeTag" class="item-form">
							<input type="hidden" name="tag" value={tag.identifier} />
							<TagChip {tag} />
							<label for="tag-{tag.identifier}" class="visually-hidden">Name of the tag {tag.name}</label>
							<input type="text" id="tag-{tag.identifier}" name="name" value={tag.name} maxlength="60" required />
							<label for="tag-color-{tag.identifier}" class="visually-hidden">Color of the tag {tag.name}</label>
							<select id="tag-color-{tag.identifier}" name="color">
								{#each tagColors as color (color)}<option value={color} selected={color === tag.color}>{colorNames[color]}</option>{/each}
							</select>
							<button class="button-quiet small" type="submit">Save</button>
						</form>
						<form method="post" action="?/deleteTag">
							<input type="hidden" name="tag" value={tag.identifier} />
							<button class="icon-button" type="submit" aria-label="Delete the tag {tag.name}" title="Delete the tag"><Trash2 size={18} aria-hidden="true" /></button>
						</form>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted">No tags yet.</p>
		{/if}
		<form method="post" action="?/newTag" class="new" id="new-tag">
			<h3><Tag size={18} aria-hidden="true" />New tag</h3>
			<div class="new-row">
				<div class="field">
					<label for="tag-name">Name</label>
					<input type="text" id="tag-name" name="name" maxlength="60" required />
				</div>
				<div class="field">
					<label for="tag-color">Color</label>
					<select id="tag-color" name="color">
						{#each tagColors as color (color)}<option value={color}>{colorNames[color]}</option>{/each}
					</select>
				</div>
				<button class="button" type="submit">Make the tag</button>
			</div>
		</form>
	</section>
</div>

<style>
	.columns {
		display: grid;
		gap: var(--space-5);
	}
	@media (min-width: 75rem) {
		.columns {
			grid-template-columns: 1fr 1fr;
			align-items: start;
		}
	}
	.card {
		padding: var(--space-4) var(--space-5);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
	}
	.card h2,
	.card h3 {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-top: 0;
	}
	.card h3 {
		font-size: var(--font-size-body);
	}
	.items {
		list-style: none;
		margin: 0 0 var(--space-3);
		padding: 0;
	}
	.items li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		border-bottom: 1px solid var(--color-line);
		padding-block: var(--space-1);
	}
	.item-form {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.item-form input[type='text'] {
		flex: 1;
		min-width: 6rem;
		border-color: transparent;
		background: transparent;
	}
	.item-form input[type='text']:hover,
	.item-form input[type='text']:focus {
		border-color: var(--color-control-border);
		background: var(--color-paper);
	}
	.items :global(svg) {
		flex: none;
		color: var(--color-ink-muted);
	}
	.new {
		margin-top: var(--space-4);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-line);
	}
	.new-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--space-3);
	}
	.new-row .field {
		flex: 1 1 10rem;
		margin: 0;
	}
	.new-row .button {
		flex: none;
	}
</style>
