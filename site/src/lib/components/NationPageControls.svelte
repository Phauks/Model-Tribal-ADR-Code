<script lang="ts">
	// For someone on a nation's team, the nation page's controls in the
	// masthead (PageControls.svelte): Edit this page, History of the page's
	// changes, and Your nation's team, as icon buttons after the site's name
	// (design/header-page-controls, approved by Trevor on Nov. 23, 2026; they
	// replace the banner of design/nation-editors, screen 2). Each part of the
	// page their place covers also shows an Edit link. Nation pages are built
	// ahead of time and the same for every reader, so the page asks who is
	// reading after it loads (/profile/nation-team/place.json), and only when
	// the signed-in hint says someone is signed in. The Edit links are already
	// in the page, hidden; the attribute set here on the root shows the ones
	// for the person's parts (site/src/lib/styles/global.css).
	import { atLeastTeamLevel, pageParts, type PagePart, type TeamLevel } from '#lib/nation-teams.ts';
	import { offerPageControls, type PageLink } from '#lib/page-editing.svelte.ts';
	import { readSignedInHint } from '#lib/signed-in-hint.ts';

	let { nation }: { nation: string } = $props();

	let place = $state<{ nation: string; level: TeamLevel; parts: PagePart[] | null } | null>(null);

	const writes = $derived(place !== null && atLeastTeamLevel(place.level, 'drafter'));
	const publishes = $derived(place !== null && atLeastTeamLevel(place.level, 'editor'));
	const name = $derived(place ? (/^the\s/i.test(place.nation) ? place.nation : `the ${place.nation}`) : '');

	$effect(() => {
		const identifier = nation;
		place = null;
		if (!readSignedInHint(document.cookie).signedIn) return;
		let current = true;
		fetch(`/profile/nation-team/place.json?nation=${encodeURIComponent(identifier)}`, { headers: { accept: 'application/json' } })
			.then((response) => (response.ok ? response.json() : { place: null }))
			.then((answer: { place: typeof place }) => {
				if (current) place = answer.place;
			})
			.catch(() => {
				// Offline or signed out: the page is shown as to any reader.
			});
		return () => {
			current = false;
		};
	});

	$effect(() => {
		const root = document.documentElement;
		if (place && writes) root.dataset.nationEdit = (place.parts ?? pageParts).join(' ');
		else delete root.dataset.nationEdit;
		return () => {
			delete root.dataset.nationEdit;
		};
	});

	$effect(() => {
		if (!place) return;
		const links: PageLink[] = [];
		if (writes) {
			links.push({
				icon: 'edit',
				href: `/workspace/nation-teams/${nation}/edit`,
				title: publishes ? `Edit this page for ${name}. Changes go live as soon as you publish them.` : `Write changes to this page for ${name}. An editor or steward publishes them.`
			});
		}
		links.push({ icon: 'team', href: `/workspace/nation-teams/${nation}`, title: 'Your nation’s team' });
		return offerPageControls({
			modes: [],
			links,
			history: { title: 'History: changes to this page', href: `/workspace/nation-teams/${nation}/changes` }
		});
	});
</script>
