<script lang="ts">
	// The rule editor (site/MAIL.md, "Folders, tags and rules"): a name, the
	// conditions, and what to do. Rows can be added and removed; each row sends
	// its fields under shared names (rule-form.ts reads them by position).
	import FlaskConical from '@lucide/svelte/icons/flask-conical';
	import Plus from '@lucide/svelte/icons/plus';
	import Save from '@lucide/svelte/icons/save';
	import X from '@lucide/svelte/icons/x';
	import Dropdown from '#lib/components/Dropdown.svelte';
	import SearchableDropdown from '#lib/components/SearchableDropdown.svelte';
	import { ruleActionKinds, ruleFields, ruleOperators, type RuleAction, type RuleCondition } from '#lib/mail.ts';

	interface Draft {
		name: string;
		enabled: boolean;
		matchAll: boolean;
		conditions: RuleCondition[];
		actions: RuleAction[];
		stopAfter: boolean;
	}

	let {
		draft,
		folders,
		tags,
		people,
		preview = null,
		isNew
	}: {
		draft: Draft;
		folders: { identifier: string; path: string; depth: number; name: string }[];
		tags: { identifier: string; name: string }[];
		people: { identifier: string; name: string }[];
		preview?: { count: number; examples: { identifier: string; subject: string; counterpart: string }[] } | null;
		isNew: boolean;
	} = $props();

	// Rows are the editor's own state from here on; the page passes a fresh draft after each submit.
	const start = () => structuredClone($state.snapshot(draft)) as Draft;
	let rule = $state(start());
	if (rule.conditions.length === 0) rule.conditions.push({ field: 'from', operator: 'contains', value: '' });
	if (rule.actions.length === 0) rule.actions.push({ action: 'move', value: '' });

	const fieldChoices = ruleFields.map((field) => ({ value: field.key as string, label: field.label }));
	const yesNoChoices = [
		{ value: 'yes', label: 'Yes' },
		{ value: 'no', label: 'No' }
	];
	const operatorChoices = ruleOperators.map((operator) => ({ value: operator.key as string, label: operator.label }));
	const actionChoices = ruleActionKinds.map((kind) => ({ value: kind.key as string, label: kind.label }));
	/** What an action can be applied with: a folder (shown by its path), a tag or a person. */
	function valueChoices(action: string): { value: string; label: string }[] {
		const listed =
			action === 'move'
				? [
						...folders.map((folder) => ({ value: folder.identifier, label: folder.path })),
						{ value: 'archive', label: 'Archive' },
						{ value: 'trash', label: 'Deleted' },
						{ value: 'spam', label: 'Spam' }
					]
				: action === 'tag'
					? tags.map((tag) => ({ value: tag.identifier, label: tag.name }))
					: people.map((person) => ({ value: person.identifier, label: person.name }));
		return [{ value: '', label: 'Choose…' }, ...listed];
	}

	const kindOf = (field: string) => ruleFields.find((item) => item.key === field)?.kind ?? 'text';
	const placeholders: Record<string, string> = {
		from: 'such as @navajo-nsn.gov',
		to: 'such as requests@',
		subject: 'such as correction',
		body: 'such as remove',
		anywhere: 'such as peacemaking'
	};
</script>

<form method="post" class="editor">
	<section class="card">
		<div class="field">
			<label for="rule-name">Name</label>
			<input type="text" id="rule-name" name="name" bind:value={rule.name} maxlength="80" required placeholder="Navajo Nation mail" />
		</div>
		<label class="check"><input type="checkbox" name="enabled" value="yes" bind:checked={rule.enabled} /> On</label>
	</section>

	<section class="card" aria-labelledby="when-heading">
		<h2 id="when-heading">When a message arrives that matches</h2>
		<fieldset class="segmented">
			<legend class="visually-hidden">How many conditions must hold</legend>
			<label><input type="radio" name="match" value="all" checked={rule.matchAll} onchange={() => (rule.matchAll = true)} /><span>All of these</span></label>
			<label><input type="radio" name="match" value="any" checked={!rule.matchAll} onchange={() => (rule.matchAll = false)} /><span>Any of these</span></label>
		</fieldset>
		<ol class="rows">
			{#each rule.conditions as condition, index (index)}
				<li class="row">
					<Dropdown label="Condition {index + 1}: what to look at" hideLabel id="condition-field-{index}" name="condition-field" choices={fieldChoices} bind:value={condition.field} />
					{#if kindOf(condition.field) === 'yes-no'}
						<input type="hidden" name="condition-operator" value="is" />
						<Dropdown label="Condition {index + 1}: yes or no" hideLabel id="condition-value-{index}" name="condition-value" choices={yesNoChoices} bind:value={condition.value} />
					{:else}
						<Dropdown
							label="Condition {index + 1}: how to compare"
							hideLabel
							id="condition-operator-{index}"
							name="condition-operator"
							choices={operatorChoices}
							bind:value={condition.operator}
						/>
						<label for="condition-value-{index}" class="visually-hidden">Condition {index + 1}: words</label>
						<input type="text" id="condition-value-{index}" name="condition-value" bind:value={condition.value} maxlength="200" placeholder={placeholders[condition.field] ?? ''} />
					{/if}
					{#if rule.conditions.length > 1}
						<button type="button" class="icon-button" aria-label="Remove condition {index + 1}" title="Remove" onclick={() => rule.conditions.splice(index, 1)}><X size={18} aria-hidden="true" /></button>
					{/if}
				</li>
			{/each}
		</ol>
		{#if rule.conditions.length < 10}
			<button type="button" class="add" onclick={() => rule.conditions.push({ field: 'subject', operator: 'contains', value: '' })}><Plus size={16} aria-hidden="true" />Add a condition</button>
		{/if}
		<p class="small muted">Words match without regard to capital letters. “Sender” looks at the name and the address.</p>
	</section>

	<section class="card" aria-labelledby="then-heading">
		<h2 id="then-heading">Then</h2>
		<ol class="rows">
			{#each rule.actions as action, index (index)}
				<li class="row">
					<Dropdown
						label="Action {index + 1}"
						hideLabel
						id="action-kind-{index}"
						name="action-kind"
						choices={actionChoices}
						bind:value={action.action}
						onchange={() => (action.value = '')}
					/>
					{#if action.action === 'read'}
						<input type="hidden" name="action-value" value="" />
					{:else}
						<SearchableDropdown
							label="Action {index + 1}: which"
							hideLabel
							id="action-value-{index}"
							name="action-value"
							required
							placeholder="Choose…"
							choices={valueChoices(action.action)}
							bind:value={action.value}
						/>
					{/if}
					{#if rule.actions.length > 1}
						<button type="button" class="icon-button" aria-label="Remove action {index + 1}" title="Remove" onclick={() => rule.actions.splice(index, 1)}><X size={18} aria-hidden="true" /></button>
					{/if}
				</li>
			{/each}
		</ol>
		{#if rule.actions.length < 10}
			<button type="button" class="add" onclick={() => rule.actions.push({ action: 'tag', value: '' })}><Plus size={16} aria-hidden="true" />Add an action</button>
		{/if}
		{#if folders.length === 0 || tags.length === 0}
			<p class="small muted">Folders and tags are made on <a href="/workspace/inbox/organize">Folders and tags</a>.</p>
		{/if}
		<label class="check"><input type="checkbox" name="stopAfter" value="yes" bind:checked={rule.stopAfter} /> Don’t run later rules on a message this rule sorts</label>
	</section>

	{#if preview}
		<section class="card preview" aria-live="polite">
			<h2>Test on the inbox</h2>
			{#if preview.count === 0}
				<p>Nothing in the inbox now matches. New mail will still be sorted.</p>
			{:else}
				<p>{preview.count} conversation{preview.count === 1 ? '' : 's'} in the inbox match{preview.count === 1 ? 'es' : ''}:</p>
				<ul class="small">
					{#each preview.examples as example (example.identifier)}
						<li><a href="/workspace/inbox/{example.identifier}">{example.subject}</a> <span class="muted">({example.counterpart})</span></li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}

	<div class="bar">
		<button class="button" type="submit" formaction="?/save"><Save size={18} aria-hidden="true" />{isNew ? 'Make the rule' : 'Save the rule'}</button>
		<button class="button button-quiet" type="submit" formaction="?/test" formnovalidate><FlaskConical size={18} aria-hidden="true" />Test on the inbox</button>
		<label class="check"><input type="checkbox" name="applyNow" value="yes" /> Also sort what’s in the inbox now</label>
		<a href="/workspace/inbox/rules" class="cancel">Cancel</a>
	</div>
</form>

<style>
	.editor {
		display: grid;
		gap: var(--space-4);
		max-width: var(--layout-measure);
	}
	.card {
		padding: var(--space-4) var(--space-5);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
	}
	.card h2 {
		margin: 0 0 var(--space-3);
		font-size: var(--font-size-heading-3);
	}
	.card .field {
		max-width: var(--layout-field);
	}
	.check {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
	}
	.check input,
	.segmented input {
		accent-color: var(--color-link);
		width: 1.1rem;
		height: 1.1rem;
	}
	.segmented {
		display: inline-flex;
		margin: 0 0 var(--space-3);
		padding: 0;
		border: 2px solid var(--color-control-border);
		border-radius: 999px;
		overflow: hidden;
	}
	.segmented label {
		position: relative;
		display: inline-flex;
		align-items: center;
		min-height: 2.5rem;
		cursor: pointer;
	}
	.segmented input {
		position: absolute;
		opacity: 0;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		cursor: pointer;
	}
	.segmented span {
		padding: 0 var(--space-4);
	}
	.segmented label:has(input:checked) {
		background: var(--color-link);
		color: var(--color-paper);
		font-weight: var(--font-weight-semibold);
	}
	.segmented label:has(input:focus-visible) {
		outline: 3px solid var(--focus-ring);
		outline-offset: -3px;
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-2);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.row :global(.dropdown) {
		flex: 0 1 13rem;
		margin: 0;
	}
	.row :global(.dropdown-control) {
		width: 100%;
	}
	.row :global(.searchable-dropdown) {
		flex: 1 1 12rem;
	}
	.row input[type='text'] {
		flex: 1 1 12rem;
		width: auto;
	}
	.add {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--layout-target-minimum);
		margin-top: var(--space-2);
		padding: 0 var(--space-3);
		border: 1px dashed var(--color-control-border);
		border-radius: 999px;
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		font-size: var(--font-size-small);
		cursor: pointer;
	}
	.add:hover {
		background: var(--color-surface);
	}
	.preview {
		border-color: var(--color-link);
		background: var(--color-notice-background);
	}
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}
	.bar .button {
		gap: var(--space-2);
	}
	.cancel {
		margin-left: auto;
	}
</style>
