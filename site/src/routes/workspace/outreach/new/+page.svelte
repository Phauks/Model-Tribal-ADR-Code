<script lang="ts">
	// New outreach batch (design/email-inbox, mockup 3): 1 Who, 2 Message,
	// 3 Pace and send. Without scripts every step shows at once.
	import { onMount } from 'svelte';
	import Dropdown from '#lib/components/Dropdown.svelte';
	import { fillTemplate, outreachText } from '#lib/mail.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Step = 'who' | 'message' | 'send';
	const steps: { value: Step; label: string }[] = [
		{ value: 'who', label: 'Who' },
		{ value: 'message', label: 'Message' },
		{ value: 'send', label: 'Pace and send' }
	];

	let mounted = $state(false);
	let step = $state<Step>('who');
	onMount(() => {
		mounted = true;
		const asked = new URLSearchParams(location.search).get('step');
		if (asked === 'message' || asked === 'send') step = asked;
	});
	const shows = (...which: Step[]) => !mounted || which.includes(step);

	// svelte-ignore state_referenced_locally
	let templateIdentifier = $state(data.templates[0]?.identifier ?? '');
	// svelte-ignore state_referenced_locally
	let subject = $state(data.templates[0]?.subject ?? '');
	// svelte-ignore state_referenced_locally
	let body = $state(data.templates[0]?.body ?? '');
	let showing = $state(0);
	let name = $state('');
	let perDay = $state(40);
	let windowStart = $state(9);
	let windowEnd = $state(15);
	let weekdaysOnly = $state(true);
	let followUp = $state(true);
	let followUpDays = $state(10);
	let askAcknowledgment = $state(false);

	const tagChoices = $derived([{ value: '', label: 'Any tag' }, ...data.tags.map((tag) => ({ value: tag, label: tag }))]);
	const labelChoices = [
		{ value: '', label: 'Any' },
		{ value: 'general-office', label: 'A general office address' },
		{ value: 'leader', label: 'A leader’s own address' },
		{ value: 'state-listed', label: 'Listed by a state government' }
	];
	const nationsChoices = [
		{ value: 'linked', label: 'Linked to a nation' },
		{ value: 'any', label: 'Every contact' }
	];
	const templateChoices = $derived(data.templates.map((template) => ({ value: template.identifier, label: `${template.name} (v${template.version})` })));

	function chooseTemplate(identifier: string) {
		const template = data.templates.find((item) => item.identifier === identifier);
		if (!template) return;
		subject = template.subject;
		body = template.body;
	}

	const count = $derived(data.recipients.length);
	const who = $derived(data.filter.nationsOnly ? 'nations' : 'contacts');
	const current = $derived(data.recipients[Math.min(showing, Math.max(0, count - 1))]);
	const days = $derived(Math.max(1, Math.ceil(count / Math.max(1, perDay))));
	const letter = $derived.by(() => {
		const fields = current?.fields ?? {};
		const text = outreachText(body, fields, { ...data.links, acknowledgeLink: askAcknowledgment ? data.links.acknowledgeLink : null });
		const [words, footer] = text.split('\n--\n');
		return { subject: fillTemplate(subject, fields).trim(), words, footer };
	});

	function hour(value: number): string {
		if (value === 0 || value === 24) return '12 AM';
		if (value === 12) return '12 PM';
		return value < 12 ? `${value} AM` : `${value - 12} PM`;
	}

	const labelWords: Record<string, string> = {
		'general-office': 'general office addresses',
		leader: 'leaders’ own addresses',
		'state-listed': 'addresses listed by a state'
	};
	const described = $derived(
		[
			data.filter.nationsOnly ? 'contacts linked to a nation' : 'every contact',
			data.filter.tag ? `with the tag “${data.filter.tag}”` : null,
			data.filter.label ? labelWords[data.filter.label] : null
		]
			.filter(Boolean)
			.join(', ')
	);
</script>

<svelte:head>
	<title>New outreach batch · Outreach · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<p class="small back"><a href="/workspace/outreach">Outreach</a></p>
<h1>New outreach batch</h1>

{#if mounted}
	<nav class="steps" aria-label="Steps">
		<ol>
			{#each steps as choice, index (choice.value)}
				<li>
					<button type="button" aria-current={step === choice.value ? 'step' : undefined} onclick={() => (step = choice.value)}>
						{index + 1} {choice.label}
					</button>
				</li>
			{/each}
		</ol>
	</nav>
{/if}

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

<form method="post" class="layout" id="batch">
	<input type="hidden" name="tag" value={data.filter.tag ?? ''} />
	<input type="hidden" name="label" value={data.filter.label ?? ''} />
	<input type="hidden" name="nations" value={data.filter.nationsOnly ? 'linked' : 'any'} />
	<input type="hidden" name="showing" value={showing} />

	<div class="main">
		{#if shows('who')}
			<section class="card" aria-labelledby="who-heading">
				<h2 id="who-heading">Who</h2>
				<div class="who">
					<div class="field">
						<Dropdown label="With the tag" id="tag" name="tag" form="who-form" choices={tagChoices} value={data.filter.tag ?? ''} />
					</div>
					<div class="field">
						<Dropdown label="Kind of address" id="label" name="label" form="who-form" choices={labelChoices} value={data.filter.label ?? ''} />
					</div>
					<div class="field">
						<Dropdown label="Contacts" id="nations" name="nations" form="who-form" choices={nationsChoices} value={data.filter.nationsOnly ? 'linked' : 'any'} />
					</div>
				</div>
				<button class="button button-quiet" type="submit" form="who-form">Show who this reaches</button>
			</section>
		{/if}

		<section class="card" aria-labelledby="recipients-heading">
			<h2 id="recipients-heading">Recipients: {count} {count === 1 ? who.slice(0, -1) : who}</h2>
			<p class="muted small">From the address book: {described}.</p>
			{#if data.leftOut.length}
				<table class="left-out">
					<thead>
						<tr><th scope="col">Left out</th><th scope="col" class="number">{data.filter.nationsOnly ? 'Nations' : 'Contacts'}</th><th scope="col">Why</th></tr>
					</thead>
					<tbody>
						{#each data.leftOut as group (group.reason)}
							<tr>
								<td>{group.reason}</td>
								<td class="number">{group.count}</td>
								<td>{group.why}{#if group.review}{' '}<a href={group.review}>Review</a>{/if}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<p class="small">Nobody is left out.</p>
			{/if}
			{#if mounted && step === 'who'}
				<button class="button" type="button" onclick={() => (step = 'message')}>Next: Message</button>
			{/if}
		</section>

		{#if shows('message')}
			<section class="card" aria-labelledby="message-heading">
				<h2 id="message-heading">Message</h2>
				{#if data.templates.length === 0}
					<p>Write a template first. <a href="/workspace/outreach/templates/new">Write a template</a></p>
				{:else}
					<div class="field">
						<Dropdown label="Template" id="template" name="template" choices={templateChoices} bind:value={templateIdentifier} onchange={chooseTemplate} />
					</div>
					<div class="field wide">
						<label for="subject">Subject</label>
						<input type="text" id="subject" name="subject" bind:value={subject} maxlength="300" required />
					</div>
					<div class="field wide">
						<label for="body">Body</label>
						<p class="hint" id="body-hint">Fields such as {'{{nation.name}}'} are filled in for each recipient.</p>
						<textarea id="body" name="body" rows="9" bind:value={body} aria-describedby="body-hint" required></textarea>
					</div>
					{#if mounted && step === 'message'}
						<button class="button" type="button" onclick={() => (step = 'send')}>Next: Pace and send</button>
					{/if}
				{/if}
			</section>
		{/if}

		{#if shows('send')}
			<section class="card" aria-labelledby="pace-heading">
				<h2 id="pace-heading">Pace</h2>
				<div class="field">
					<label for="name">Name of the batch <span class="small muted">(optional)</span></label>
					<input type="text" id="name" name="name" bind:value={name} maxlength="120" />
				</div>
				<div class="pace">
					<div class="field">
						<label for="per-day">At most a day</label>
						<input id="per-day" name="perDay" type="number" min="1" max="200" bind:value={perDay} />
					</div>
					<div class="field">
						<label for="window-start">From</label>
						<input id="window-start" name="windowStart" type="number" min="0" max="23" bind:value={windowStart} />
					</div>
					<div class="field">
						<label for="window-end">To</label>
						<input id="window-end" name="windowEnd" type="number" min="1" max="24" bind:value={windowEnd} />
					</div>
					<div class="field">
						<label for="follow-up-days">Follow up after days</label>
						<input id="follow-up-days" name="followUpDays" type="number" min="1" max="90" bind:value={followUpDays} />
					</div>
				</div>
				<p class="small muted">Hours are in each nation’s time zone. Start low: a new mailbox is trusted slowly.</p>
			</section>
		{/if}
	</div>

	<aside class="side">
		<section class="card" aria-labelledby="preview-heading">
			<h2 id="preview-heading">Preview</h2>
			{#if current}
				<p class="small muted">
					Showing {showing + 1} of {count}: {current.nationName ?? current.name}{#if count > 1}{' '}·
						<button class="link-button" type="button" onclick={() => (showing = (showing + 1) % count)}>next</button>{/if}
				</p>
			{:else}
				<p class="small muted">No one to show yet.</p>
			{/if}
			<div class="letter">
				<p class="letter-subject">{letter.subject}</p>
				<p class="letter-words">{letter.words}</p>
				{#if letter.footer}<p class="letter-footer">{letter.footer}</p>{/if}
			</div>
		</section>

		{#if shows('message', 'send')}
			<section class="card" aria-labelledby="sending-heading">
				<h2 id="sending-heading">Sending</h2>
				<div class="choice top">
					<input type="radio" id="from-outreach" name="carrier" value="outreach" checked />
					<label for="from-outreach">
						<strong>From the outreach mailbox</strong><br />
						<span class="muted">{data.mailbox ?? 'The outreach mailbox'}, one message per {who === 'nations' ? 'nation' : 'contact'}. Replies come to this inbox.</span>
					</label>
				</div>
				<div class="choice top">
					<input type="checkbox" id="weekdays" name="weekdaysOnly" value="yes" bind:checked={weekdaysOnly} />
					<label for="weekdays">
						At most {perDay} a day, {weekdaysOnly ? 'weekdays' : 'every day'}, {hour(windowStart)} to {hour(windowEnd)} in each nation’s time zone ({days}
						{days === 1 ? 'day' : 'days'})
					</label>
				</div>
				<div class="choice top">
					<input type="checkbox" id="follow-up" name="followUp" value="yes" bind:checked={followUp} />
					<label for="follow-up">Remind me to follow up after {followUpDays} days with no reply</label>
				</div>
				<div class="choice top">
					<input type="checkbox" id="acknowledge" name="askAcknowledgment" value="yes" bind:checked={askAcknowledgment} />
					<label for="acknowledge">Add a “Let us know you got this” link <span class="muted">(visible, optional for them)</span></label>
				</div>
				<p class="small muted">No hidden open tracking: messages carry no tracking pictures or rewritten links.</p>
				{#if data.problems.length}
					<p class="small muted">Nothing can be sent until email is set up: {data.problems.join(' ')}</p>
				{/if}
				<div class="buttons">
					<button class="button button-quiet" type="submit" formaction="?/test">Send a test to me</button>
					<button class="button" type="submit" formaction="?/create" name="start" value="yes">Start the batch</button>
				</div>
				<p class="small"><button class="link-button" type="submit" formaction="?/create">Save without starting</button></p>
			</section>
		{/if}
	</aside>
</form>

<form method="get" id="who-form">
	{#if mounted}<input type="hidden" name="step" value="who" />{/if}
</form>

<style>
	.back {
		margin: 0 0 var(--space-1);
	}
	h1 {
		margin-bottom: var(--space-3);
	}
	.steps ol {
		display: inline-flex;
		margin: 0 0 var(--space-4);
		padding: 0;
		list-style: none;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		overflow: hidden;
	}
	.steps li + li {
		border-left: 1px solid var(--color-line);
	}
	.steps button {
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-4);
		border: 0;
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		cursor: pointer;
	}
	.steps button[aria-current='step'] {
		background: var(--color-band);
		color: var(--color-band-text);
		font-weight: var(--font-weight-semibold);
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(16rem, 26rem);
		gap: var(--space-5);
		align-items: start;
	}
	@media (max-width: 60rem) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.main,
	.side {
		display: grid;
		gap: var(--space-4);
		min-width: 0;
	}
	.card {
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
		padding: var(--space-4) var(--space-5);
		min-width: 0;
	}
	.card h2 {
		margin: 0 0 var(--space-2);
		font-size: var(--font-size-lead);
	}
	.who,
	.pace {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--space-4);
	}
	.pace input {
		max-width: var(--layout-field-short);
	}
	.field.wide :is(input, textarea) {
		max-width: none;
	}
	.choice {
		display: flex;
		gap: var(--space-3);
		align-items: center;
		margin: 0 0 var(--space-3);
	}
	.choice.top {
		align-items: flex-start;
	}
	.choice input {
		width: 1.25rem;
		height: 1.25rem;
		margin: 0.15rem 0 0;
		flex: none;
		accent-color: var(--color-link);
	}
	.choice label {
		font-weight: var(--font-weight-regular);
	}
	.left-out {
		margin: var(--space-3) 0;
	}
	.left-out th {
		background: transparent;
		border-bottom: 2px solid var(--color-ink);
	}
	.number {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.letter {
		border: 1px dashed var(--color-control-border);
		border-radius: var(--radius-control);
		padding: var(--space-3) var(--space-4);
	}
	.letter-subject {
		font-weight: var(--font-weight-semibold);
		margin: 0 0 var(--space-2);
	}
	/* A long letter scrolls inside the box, so its footer stays in view. */
	.letter-words {
		max-height: 22rem;
		overflow: auto;
		margin: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.letter-footer {
		margin: var(--space-3) 0 0;
		padding-top: var(--space-2);
		border-top: 1px solid var(--color-line);
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
	.link-button {
		padding: 0;
		border: 0;
		background: none;
		color: var(--color-link);
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}
</style>
