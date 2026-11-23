<script lang="ts">
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ListFilter from '@lucide/svelte/icons/list-filter';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { page } from '$app/state';
	import { describeCondition } from '#lib/mail.ts';
	import { fullDate } from '../dates.ts';
	import { describeAction } from './describe.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const names = $derived({ folders: data.mailFolders, tags: data.tags, people: data.people });
	// After the editor saves, it comes back here with how many conversations it sorted from the inbox.
	const savedNote = $derived.by(() => {
		const made = page.url.searchParams.get('made');
		const saved = page.url.searchParams.get('saved');
		const count = Number(made ?? saved);
		if (made === null && saved === null) return null;
		const sorted = count > 0 ? ` It sorted ${count} conversation${count === 1 ? '' : 's'} from the inbox.` : '';
		return `${made !== null ? 'Made the rule.' : 'Saved the rule.'}${sorted}`;
	});
</script>

<svelte:head>
	<title>Auto-sort rules · Inbox · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<div class="head">
	<h1>Auto-sort rules</h1>
	<a class="button" href="/workspace/inbox/rules/new"><Plus size={18} aria-hidden="true" />New rule</a>
</div>
<p class="lead">
	Rules file, tag and assign mail as it arrives, in the order below. They skip Spam and bounce reports. A rule can stop the ones after it.
</p>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{:else if savedNote}
	<div class="notice" role="status"><p>{savedNote}</p></div>
{/if}

{#if data.rules.length === 0}
	<div class="empty">
		<ListFilter size={48} aria-hidden="true" />
		<p class="lead">No rules yet.</p>
		<p class="muted">For example: mail whose sender ends with “@navajo-nsn.gov” goes to a Navajo Nation folder with the tag “Outreach reply”.</p>
		<p><a class="button-quiet button" href="/workspace/inbox/rules/new">Make the first rule</a></p>
	</div>
{:else}
	<ol class="rules">
		{#each data.rules as rule, index (rule.identifier)}
			<li class="rule" class:off={!rule.enabled}>
				<div class="rule-main">
					<div class="rule-title">
						<span class="order small" aria-hidden="true">{index + 1}</span>
						<h2><a href="/workspace/inbox/rules/{rule.identifier}">{rule.name}</a></h2>
						{#if !rule.enabled}<span class="badge small">Off</span>{/if}
					</div>
					<p class="small">
						<span class="when-word">{rule.matchAll || rule.conditions.length === 1 ? 'When' : 'When any of'}</span>
						{rule.conditions.map(describeCondition).join(rule.matchAll ? ' and ' : ', or ')}
					</p>
					<p class="small">
						<span class="when-word">Then</span>
						{rule.actions.map((action) => describeAction(action, names)).join(', ')}{#if rule.stopAfter}, and stop{/if}
					</p>
					<p class="small muted">
						{#if rule.matchCount}Sorted {rule.matchCount} message{rule.matchCount === 1 ? '' : 's'}; the last on {fullDate(rule.lastMatchedAt)}.{:else}Has not sorted anything yet.{/if}
					</p>
				</div>
				<div class="rule-tools">
					<form method="post" action="?/toggle">
						<input type="hidden" name="rule" value={rule.identifier} />
						<button class="switch" type="submit" name="enabled" value={rule.enabled ? 'no' : 'yes'} role="switch" aria-checked={rule.enabled} aria-label="{rule.name} is on">
							<span class="track" aria-hidden="true"><span class="thumb"></span></span>
						</button>
					</form>
					<form method="post" action="?/move" class="order-tools">
						<input type="hidden" name="rule" value={rule.identifier} />
						<button class="icon-button" type="submit" name="direction" value="up" disabled={index === 0} aria-label="Run {rule.name} earlier" title="Run earlier"><ArrowUp size={18} aria-hidden="true" /></button>
						<button class="icon-button" type="submit" name="direction" value="down" disabled={index === data.rules.length - 1} aria-label="Run {rule.name} later" title="Run later"><ArrowDown size={18} aria-hidden="true" /></button>
					</form>
					<a class="icon-button" href="/workspace/inbox/rules/{rule.identifier}" aria-label="Change {rule.name}" title="Change"><Pencil size={18} aria-hidden="true" /></a>
					<form method="post" action="?/apply">
						<input type="hidden" name="rule" value={rule.identifier} />
						<button class="button-quiet small" type="submit" title="Run this rule on the conversations in the inbox now">Run on inbox</button>
					</form>
					<form method="post" action="?/delete">
						<input type="hidden" name="rule" value={rule.identifier} />
						<button class="icon-button" type="submit" aria-label="Delete {rule.name}" title="Delete"><Trash2 size={18} aria-hidden="true" /></button>
					</form>
				</div>
			</li>
		{/each}
	</ol>
{/if}

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.head h1 {
		margin: 0;
	}
	.head .button {
		gap: var(--space-2);
		border-radius: 999px;
	}
	.rules {
		list-style: none;
		margin: var(--space-4) 0 0;
		padding: 0;
		display: grid;
		gap: var(--space-3);
	}
	.rule {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
	}
	.rule.off {
		background: var(--color-paper);
	}
	.rule.off .rule-main {
		color: var(--color-ink-muted);
	}
	.rule-main {
		flex: 1 1 24rem;
		min-width: 0;
	}
	.rule-main p {
		margin: var(--space-1) 0 0;
	}
	.rule-title {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.rule-title h2 {
		margin: 0;
		font-size: var(--font-size-heading-3);
	}
	.order {
		display: inline-grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		background: var(--color-surface);
		font-weight: var(--font-weight-bold);
	}
	.badge {
		padding: 0 0.6em;
		border-radius: 999px;
		border: 1px solid var(--color-control-border);
	}
	.when-word {
		font-weight: var(--font-weight-semibold);
		color: var(--color-link);
	}
	.rule-tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
	}
	.order-tools {
		display: inline-flex;
	}
	.switch {
		display: inline-grid;
		place-items: center;
		min-width: var(--layout-target-minimum);
		min-height: var(--layout-target-minimum);
		border: 0;
		background: transparent;
		cursor: pointer;
	}
	.track {
		display: inline-flex;
		align-items: center;
		width: 2.5rem;
		height: 1.4rem;
		padding: 2px;
		border-radius: 999px;
		background: var(--color-control-border);
		transition: background-color 150ms ease;
	}
	.thumb {
		width: 1.1rem;
		height: 1.1rem;
		border-radius: 50%;
		background: var(--color-paper);
		transition: transform 150ms ease;
	}
	.switch[aria-checked='true'] .track {
		background: var(--color-link);
	}
	.switch[aria-checked='true'] .thumb {
		transform: translateX(1.1rem);
	}
	@media (prefers-reduced-motion: reduce) {
		.track,
		.thumb {
			transition: none;
		}
	}
	@media (forced-colors: active) {
		.track {
			border: 1px solid ButtonText;
		}
		.thumb {
			background: ButtonText;
		}
	}
	.icon-button:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.empty {
		display: grid;
		justify-items: center;
		text-align: center;
		padding: var(--space-7) var(--space-4);
		color: var(--color-ink-muted);
	}
	.empty .lead {
		color: var(--color-ink);
		margin: var(--space-3) 0 var(--space-1);
	}
</style>
