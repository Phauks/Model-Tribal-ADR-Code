<!--
	@component
	The fields for hiding part of a change (site/COLLABORATION.md, "Recent
	changes", Hiding), as in the approved mockup (design/recent-changes, 6):
	what to hide, the reason readers see and, privately, the request it
	answers. Used by the dialog on a change's page and by the workspace page
	that works without scripts. The form around it posts to
	/workspace/changes/<change>?/hide.
-->
<script lang="ts">
	import { hideReasons } from '#lib/page-history.ts';
	import { requestKindLabels, isRequestKind } from '#lib/requests.ts';

	interface Hidden {
		hideText: boolean;
		hideSummary: boolean;
		hidePerson: boolean;
		reason: string;
	}

	let {
		prefix,
		hidden,
		requests
	}: {
		/** Unique on the page; used for element ids. */
		prefix: string;
		hidden: Hidden | undefined;
		requests: { reference: string; kind: string }[];
	} = $props();

	/** "Hidden at a nation’s request" reads "At a nation’s request" in the list. */
	function choiceLabel(label: string): string {
		const rest = label.replace(/^Hidden:? /, '');
		return rest.charAt(0).toLocaleUpperCase('en-US') + rest.slice(1);
	}
</script>

<div class="hide-fields">
	<label class="check">
		<input type="checkbox" name="text" checked={hidden ? hidden.hideText : true} />
		<span><strong>Hide the text of this version</strong><span class="check-hint">No one can read it or compare it, here or in Recent changes.</span></span>
	</label>
	<label class="check">
		<input type="checkbox" name="summary" checked={hidden ? hidden.hideSummary : true} />
		<span><strong>Hide the summary</strong><span class="check-hint">Use this when the summary itself names what was removed.</span></span>
	</label>
	<label class="check">
		<input type="checkbox" name="person" checked={hidden?.hidePerson ?? false} />
		<span><strong>Hide who made it</strong><span class="check-hint">Shows “name hidden” instead.</span></span>
	</label>
	<div class="field">
		<label for="{prefix}-reason">Reason readers see</label>
		<select id="{prefix}-reason" name="reason">
			{#each Object.entries(hideReasons) as [value, label] (value)}
				<option {value} selected={hidden ? hidden.reason === value : value === 'nation-request'}>{choiceLabel(label)}</option>
			{/each}
		</select>
	</div>
	<div class="field">
		<label for="{prefix}-request">Request it answers (private)</label>
		<select id="{prefix}-request" name="request">
			<option value="">None</option>
			{#each requests as request (request.reference)}
				<option value={request.reference}>{request.reference} · {isRequestKind(request.kind) ? requestKindLabels[request.kind] : request.kind}</option>
			{/each}
		</select>
	</div>
	<p class="hide-note">
		The change stays in the list with a line through it, the way a removed version shows on wikis. The private activity log
		records who hid it and why, and you can show it again later.
	</p>
</div>

<style>
	.check {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		padding: var(--space-2) var(--space-3);
		margin-block: var(--space-2);
		cursor: pointer;
	}

	.check input {
		margin-top: 0.3em;
		flex: none;
		accent-color: var(--color-band);
	}

	.check strong {
		display: block;
	}

	.check-hint {
		display: block;
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
	}

	.field {
		margin-block: var(--space-3);
	}

	.field label {
		display: block;
		font-weight: var(--font-weight-semibold);
		margin-bottom: var(--space-1);
	}

	.field select {
		width: 100%;
		max-width: none;
	}

	.hide-note {
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
		margin: var(--space-3) 0 0;
	}
</style>
