<script lang="ts">
	import FolderIcon from '@lucide/svelte/icons/folder';
	import FolderPlus from '@lucide/svelte/icons/folder-plus';
	import Tag from '@lucide/svelte/icons/tag';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Dropdown from '#lib/components/Dropdown.svelte';
	import { folderDepthLimit, tagColors } from '#lib/mail.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const colorNames: Record<string, string> = { teal: 'Teal', orange: 'Orange', gray: 'Gray', gold: 'Gold', green: 'Green', purple: 'Purple' };
	const colorChoices = tagColors.map((color) => ({ value: color as string, label: colorNames[color] }));
	/** Each color's name has a band of the color before it, in the list and in the closed box. */
	const swatch = (color: string) => `border-left: 0.75rem solid var(--tag-${color}); padding-left: var(--space-2)`;
	const parentChoices = $derived([
		{ value: '', label: 'Nothing (top level)' },
		...data.mailFolders.filter((folder) => folder.depth < folderDepthLimit - 1).map((folder) => ({ value: folder.identifier, label: folder.path }))
	]);
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
							<button class="button button-quiet small" type="submit">Rename</button>
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
					<Dropdown label="Inside" id="folder-parent" name="parent" choices={parentChoices} value="" />
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
							<span class="dot" style="--tag-color: var(--tag-{tag.color})" aria-hidden="true"></span>
							<label for="tag-{tag.identifier}" class="visually-hidden">Name of the tag {tag.name}</label>
							<input type="text" id="tag-{tag.identifier}" name="name" value={tag.name} maxlength="60" required />
							<Dropdown label="Color of the tag {tag.name}" hideLabel id="tag-color-{tag.identifier}" name="color" choices={colorChoices} value={tag.color} choiceStyle={swatch} />
							<button class="button button-quiet small" type="submit">Save</button>
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
					<Dropdown label="Color" id="tag-color" name="color" choices={colorChoices} value={tagColors[0]} choiceStyle={swatch} />
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
	@media (min-width: 110rem) {
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
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.item-form :global(.dropdown) {
		margin: 0;
	}
	.item-form :global(.dropdown-control) {
		width: 10rem;
	}
	.new-row :global(.dropdown) {
		margin: 0;
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
	.dot {
		flex: none;
		width: 0.8rem;
		height: 0.8rem;
		border-radius: 50%;
		background: var(--tag-color);
	}
	.columns {
		--tag-teal: var(--color-link);
		--tag-orange: var(--color-action);
		--tag-gray: var(--color-ink-muted);
		--tag-gold: var(--color-placeholder-rule);
		--tag-green: var(--color-map-class-2);
		--tag-purple: var(--color-band);
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
