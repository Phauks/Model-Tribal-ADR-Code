<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import { fullDate } from '../../../inbox/dates.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const values = $derived(
		form && 'values' in form && form.values
			? form.values
			: { name: data.template?.name ?? '', subject: data.template?.subject ?? '', body: data.template?.body ?? '' }
	);
</script>

<svelte:head>
	<title>{data.template ? data.template.name : 'New template'} · Outreach · Workspace · Tribal Law Project</title>
</svelte:head>

<Breadcrumbs
	trail={[
		{ label: 'Workspace', href: '/workspace' },
		{ label: 'Outreach', href: '/workspace/outreach' }
	]}
/>
<h1>{data.template ? data.template.name : 'Write a template'}</h1>
{#if data.template}<p class="muted">Version {data.template.version}{data.template.archived ? ', archived' : ''}. Saving makes a new version; batches keep the version they were made from.</p>{/if}

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

<div class="layout">
	<form method="post" action="?/save">
		<div class="field"><label for="name">Name <span class="small muted">(only the team sees it)</span></label><input type="text" id="name" name="name" value={values.name} required /></div>
		<div class="field"><label for="subject">Subject</label><input type="text" id="subject" name="subject" value={values.subject} required /></div>
		<div class="field"><label for="body">Message</label><textarea id="body" name="body" rows="18" required>{values.body}</textarea></div>
		<p class="small muted">The unsubscribe lines are added below the message by themselves.</p>
		<button class="button" type="submit">Save</button>
	</form>
	<aside>
		<h2 class="small">Fields</h2>
		<p class="small">Type a field in double braces, such as <code>{'{{nation.name}}'}</code>. A recipient without a value for a field the template uses is left out of a batch, with the reason shown.</p>
		<dl class="small">
			{#each data.mergeFields as field (field.key)}<dt><code>{`{{${field.key}}}`}</code></dt><dd>{field.label}</dd>{/each}
		</dl>
	</aside>
</div>

{#if data.preview}
	<h2>How it reads, with sample values</h2>
	<div class="panel preview">
		<p><strong>{data.preview.subject}</strong></p>
		<p class="text">{data.preview.text}</p>
	</div>
{/if}

{#if data.template}
	<form method="post" action="?/archive">
		<button class="button-quiet" type="submit" name="archived" value={data.template.archived ? 'no' : 'yes'}>
			{data.template.archived ? 'Restore the template' : 'Archive the template'}
		</button>
	</form>
{/if}

{#if data.versions.length > 1}
	<h2>Earlier versions</h2>
	{#each data.versions.slice(1) as version (version.version)}
		<details>
			<summary>Version {version.version}, {fullDate(version.savedAt)}{version.savedBy ? ` by ${version.savedBy}` : ''}</summary>
			<p><strong>{version.subject}</strong></p>
			<p class="text">{version.body}</p>
		</details>
	{/each}
{/if}

<style>
	.layout {
		display: grid;
		gap: var(--space-5);
	}
	@media (min-width: 60rem) {
		.layout {
			grid-template-columns: minmax(0, 1fr) 18rem;
		}
	}
	.text {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	textarea {
		width: 100%;
	}
	dd {
		margin: 0 0 var(--space-2);
	}
</style>
