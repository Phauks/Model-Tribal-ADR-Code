<script lang="ts">
	import { repositoryLink } from '#lib';
</script>

<svelte:head>
	<title>Make a request · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<h1>Make a request</h1>
	<p class="lead">
		Ask the project to correct, restrict or remove material about a Native nation, ask to add a
		nation that is missing, offer to contribute, or ask a question.
	</p>
	<div class="notice" role="note">
		<p>
			The request form is not built yet. Until it is, follow the interim route described in
			<a href="{repositoryLink}/blob/main/docs/requests.md#until-the-website-is-live">
				Requests from Native nations and contributors</a
			>. Please do not use public GitHub issues for a request about a nation.
		</p>
	</div>
	<h2>Adding a nation that is missing</h2>
	<p>
		A nation is added when a federal or state government source names it as a Native nation, Tribe,
		band or community. One source is enough. See
		<a href="{repositoryLink}/blob/main/docs/requests.md#adding-a-nation-that-is-missing"
			>Adding a nation that is missing</a
		>.
	</p>
	<h2>What happens after a request</h2>
	<ul>
		<li>The project acknowledges the request within 7 days.</li>
		<li>
			Material named in a request to restrict or remove it is taken out of public view within 7
			days, before the request is reviewed.
		</li>
		<li>A request about a nation is confirmed with that nation’s own office before it is final.</li>
	</ul>
	<p class="small muted">
		Source: <a href="{repositoryLink}/blob/main/docs/requests.md">docs/requests.md</a>, “What happens
		after a request.”
	</p>
</div>
