<script lang="ts">
	import { daysBetween, dueStateLabels, longDay, monthNames, stageLabels } from '#lib/nonprofit.ts';
	import type { PageProps } from './$types';
	import DateField from '#lib/components/DateField.svelte';
	import Dropdown from '#lib/components/Dropdown.svelte';

	let { data, form }: PageProps = $props();

	function inDays(due: string): string {
		const days = daysBetween(data.today, due);
		if (days === 0) return 'today';
		if (days === 1) return 'tomorrow';
		if (days > 0) return `in ${days} days`;
		return days === -1 ? 'yesterday' : `${-days} days ago`;
	}

	const openTasks = $derived(data.tasks.filter((task) => task.state !== 'done'));
	const doneTasks = $derived(data.tasks.filter((task) => task.state === 'done'));
	const setupDone = $derived(data.setup.filter((step) => step.completion || step.doneByFact).length);
</script>

<svelte:head>
	<title>Nonprofit · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<h1>Nonprofit</h1>
<p class="lead">{stageLabels[data.stage]}.</p>
<p class="small">
	The project's Nevada nonprofit corporation and its filings. Due dates are worked out from the facts at the bottom of this page, so enter the date of incorporation first. Only the lead author sees this page. This is a planning aid, not legal or tax advice; check each date with the agency before relying on it.
</p>

{#if data.notReady}
	<div class="notice notice-problem" role="alert">
		<p>The nonprofit tables are not in the live database yet, so nothing can be saved. Apply the database migrations from the site folder: <code>npx wrangler d1 migrations apply database --remote</code>.</p>
	</div>
{/if}

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

{#if data.nextOpen}
	<div class="notice {data.nextOpen.state === 'overdue' ? 'notice-problem' : ''}" role="note">
		<p>
			<strong>Next: {data.nextOpen.title}</strong>, due {longDay(data.nextOpen.due)} ({inDays(data.nextOpen.due)}). Fee: {data.nextOpen.fee}.
		</p>
	</div>
{:else if data.stage === 'planning'}
	<div class="notice" role="note">
		<p>
			No due dates yet. Work through <a href="#setting-up">Setting up</a>, and enter the date of incorporation under <a href="#facts">Facts</a> once the articles are filed. Year one costs $375 in required fees ($50 articles, $50 initial list, $275 IRS user fee), then $50 a year.
		</p>
	</div>
{/if}

<p class="small">
	<a href="/workspace/nonprofit/calendar.ics" download>Add the due dates to a calendar</a>: a calendar file with each open due date and reminders 30 and 7 days before. Download it again after the dates change.
	<a href="/workspace/service-checks">Check the linked services</a>.
</p>

<section aria-labelledby="due-dates">
	<h2 id="due-dates">Due dates</h2>
	{#if data.occurrences.length === 0}
		<p>None until the date of incorporation is entered.</p>
	{:else}
		<ul class="due-list">
			{#each data.occurrences as item (`${item.obligation}/${item.period}`)}
				<li class="due due-{item.state}">
					<p class="heading">
						<strong>{item.title}</strong>
						<span class="state state-{item.state}">{dueStateLabels[item.state]}</span>
					</p>
					<p>
						Due {longDay(item.due)} ({inDays(item.due)}). {item.periodLabel}. Fee: {item.fee}.
					</p>
					<p class="small">{item.what}</p>
					<p class="small muted">
						Source:
						{#each item.authority as source, index (source.label)}{index > 0 ? '; ' : ''}{#if source.link}<a href={source.link} rel="external">{source.label}</a>{:else}{source.label}{/if}{/each}.
					</p>
					{#if item.completion}
						<p class="small">
							Done {item.completion.doneOn}{#if item.completion.reference}, confirmation {item.completion.reference}{/if}{#if item.completion.recordedByName}, recorded by {item.completion.recordedByName}{/if}.
						</p>
						{#if item.completion.recordedByName}
							<form method="post" action="?/undo">
								<input type="hidden" name="obligation" value={item.obligation} />
								<input type="hidden" name="period" value={item.period} />
								<button class="link-button small" type="submit">Mark not done</button>
							</form>
						{/if}
					{:else}
						<details>
							<summary>Mark done</summary>
							<form method="post" action="?/complete" class="inline-form">
								<input type="hidden" name="obligation" value={item.obligation} />
								<input type="hidden" name="period" value={item.period} />
								<span class="date-label"><label for="done-{item.obligation}-{item.period}">Done on</label><DateField id="done-{item.obligation}-{item.period}" name="doneOn" value={data.today} max={data.today} required hint="" /></span>
								<label>Confirmation number (optional) <input type="text" name="reference" maxlength="200" /></label>
								<label>Note (optional) <input type="text" name="note" maxlength="2000" /></label>
								<button class="button" type="submit">Mark done</button>
							</form>
						</details>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section aria-labelledby="setting-up">
	<h2 id="setting-up">Setting up</h2>
	<p class="small">{setupDone} of {data.setup.length} done. The order follows the brief on becoming a 501(c)(3) with Form 1023-EZ.</p>
	<ol class="steps">
		{#each data.setup as step (step.key)}
			{@const done = step.completion?.doneOn ?? step.doneByFact}
			<li class:done>
				<p>
					<strong>{step.title}</strong>
					{#if step.fee}<span class="small muted">({step.fee})</span>{/if}
					{#if done}<span class="state state-done">Done{done === 'entered' ? '' : `, ${done}`}</span>{/if}
				</p>
				<p class="small">
					{step.what}
					{#if step.authority.length > 0}
						Source:
						{#each step.authority as source, index (source.label)}{index > 0 ? '; ' : ''}{#if source.link}<a href={source.link} rel="external">{source.label}</a>{:else}{source.label}{/if}{/each}.
					{/if}
				</p>
				{#if step.completion}
					<form method="post" action="?/undo">
						<input type="hidden" name="obligation" value={step.key} />
						<input type="hidden" name="period" value="once" />
						<button class="link-button small" type="submit">Mark not done</button>
					</form>
				{:else if !step.doneByFact}
					<details>
						<summary>Mark done</summary>
						<form method="post" action="?/complete" class="inline-form">
							<input type="hidden" name="obligation" value={step.key} />
							<input type="hidden" name="period" value="once" />
							<span class="date-label"><label for="done-{step.key}">Done on</label><DateField id="done-{step.key}" name="doneOn" value={data.today} max={data.today} required hint="" /></span>
							<label>Note (optional) <input type="text" name="note" maxlength="2000" /></label>
							<button class="button" type="submit">Mark done</button>
						</form>
					</details>
				{/if}
			</li>
		{/each}
	</ol>
</section>

<section aria-labelledby="to-dos">
	<h2 id="to-dos">Your to-dos</h2>
	{#if openTasks.length === 0}
		<p>No open to-dos.</p>
	{:else}
		<ul class="tasks">
			{#each openTasks as task (task.identifier)}
				<li>
					<p>
						<strong>{task.title}</strong>
						{#if task.dueOn}
							, due {longDay(task.dueOn)} ({inDays(task.dueOn)}){#if task.repeatsYearly}, every year{/if}
						{/if}
						{#if task.state !== 'no-date'}<span class="state state-{task.state}">{dueStateLabels[task.state]}</span>{/if}
					</p>
					{#if task.notes}<p class="small">{task.notes}</p>{/if}
					<div class="row">
						<form method="post" action="?/finishTask">
							<input type="hidden" name="task" value={task.identifier} />
							<input type="hidden" name="doneOn" value={data.today} />
							<button class="button" type="submit">Done</button>
						</form>
						<form method="post" action="?/removeTask">
							<input type="hidden" name="task" value={task.identifier} />
							<button class="link-button small" type="submit">Remove</button>
						</form>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
	{#if doneTasks.length > 0}
		<details>
			<summary>Done ({doneTasks.length})</summary>
			<ul class="tasks">
				{#each doneTasks as task (task.identifier)}
					<li>
						<p>{task.title}, done {task.doneOn}</p>
						<form method="post" action="?/reopenTask">
							<input type="hidden" name="task" value={task.identifier} />
							<button class="link-button small" type="submit">Open again</button>
						</form>
					</li>
				{/each}
			</ul>
		</details>
	{/if}

	<form method="post" action="?/addTask" class="panel">
		<h3>Add a to-do</h3>
		<div class="field">
			<label for="task-title">What</label>
			<input id="task-title" name="title" type="text" required maxlength="300" />
		</div>
		<div class="field">
			<label for="task-due">Due (optional)</label>
			<DateField id="task-due" name="dueOn" />
		</div>
		<div class="field">
			<label><input name="repeatsYearly" type="checkbox" /> Repeats every year, such as a registered agent's renewal</label>
		</div>
		<div class="field">
			<label for="task-notes">Notes (optional)</label>
			<textarea id="task-notes" name="notes" rows="2" maxlength="4000"></textarea>
		</div>
		<button class="button" type="submit">Add</button>
	</form>
</section>

<section aria-labelledby="facts">
	<h2 id="facts">Facts</h2>
	<form method="post" action="?/facts" class="panel">
		{#each data.factFields as field (field.name)}
			<div class="field">
				{#snippet hint()}
					{#if field.hint}<p class="small muted" id="hint-{field.name}">{field.hint}</p>{/if}
				{/snippet}
				{#if field.kind !== 'month'}
					<label for="fact-{field.name}">{field.label}</label>
					{@render hint()}
				{/if}
				{#if field.kind === 'date'}
					<DateField id="fact-{field.name}" name={field.name} value={data.facts[field.name] ?? ''} describedby={field.hint ? `hint-${field.name}` : undefined} />
				{:else if field.kind === 'month'}
					<Dropdown
						label={field.label}
						id="fact-{field.name}"
						name={field.name}
						choices={monthNames.map((month, index) => ({ value: String(index + 1), label: month }))}
						value={data.facts[field.name] ?? '12'}
						describedBy={field.hint ? `hint-${field.name}` : undefined}
						message={hint}
					/>
				{:else if field.kind === 'lines'}
					<textarea id="fact-{field.name}" name={field.name} rows="4" maxlength="4000" aria-describedby={field.hint ? `hint-${field.name}` : undefined}>{data.facts[field.name] ?? ''}</textarea>
				{:else}
					<input id="fact-{field.name}" name={field.name} type="text" maxlength="4000" value={data.facts[field.name] ?? ''} aria-describedby={field.hint ? `hint-${field.name}` : undefined} />
				{/if}
			</div>
		{/each}
		<button class="button" type="submit">Save facts</button>
	</form>
</section>

<style>
	.due-list {
		list-style: none;
		padding: 0;
		max-width: var(--layout-measure);
	}

	.due {
		border: 1px solid var(--color-line);
		border-left-width: 6px;
		border-radius: var(--radius-control);
		padding: var(--space-3) var(--space-4);
		margin-bottom: var(--space-3);
	}

	.due > p {
		margin: 0 0 var(--space-1);
	}

	.due-overdue {
		border-left-color: var(--color-danger);
	}

	.due-due-soon {
		border-left-color: var(--color-link);
	}

	.heading {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: baseline;
	}

	.state {
		display: inline-block;
		font-weight: var(--font-weight-semibold);
	}

	.state-overdue {
		color: var(--color-danger);
	}

	.state-due-soon {
		color: var(--color-link);
	}

	.state-done,
	.state-upcoming {
		color: var(--color-ink-muted);
	}

	.inline-form {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}

	.inline-form label,
	.inline-form .date-label {
		display: grid;
		gap: var(--space-1);
	}

	.steps > li,
	.tasks > li {
		margin-bottom: var(--space-4);
	}

	.steps > li > p,
	.tasks > li > p {
		margin: 0 0 var(--space-1);
	}

	.steps > li.done > p:first-child strong {
		color: var(--color-ink-muted);
	}

	.link-button {
		background: none;
		border: none;
		color: var(--color-link);
		cursor: pointer;
		font: inherit;
		padding: 0;
		text-decoration: underline;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: center;
	}
</style>
