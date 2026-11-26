<script lang="ts">
	// The page as built, drawn by its own component from data without what
	// nations asked the site not to show (src/lib/restricted-pages.ts).
	import NationPage from '../../nations/[id]/+page.svelte';
	import OpinionsPage from '../../nations/[id]/opinions/+page.svelte';
	import CopiesPage from '../../copies/list/[group]/+page.svelte';
	import ChartBarPage from '../../nations/data/[chart]/[bar]/+page.svelte';
	import TimelinePage from '../../nations/timeline/+page.svelte';
	import CollectionPage from '../../stats/[collection]/+page.svelte';
	import CourtPage from '../../courts/[court]/+page.svelte';
	import type { PageProps as NationProps } from '../../nations/[id]/$types';
	import type { PageProps as OpinionsProps } from '../../nations/[id]/opinions/$types';
	import type { PageProps as CopiesProps } from '../../copies/list/[group]/$types';
	import type { PageProps as ChartBarProps } from '../../nations/data/[chart]/[bar]/$types';
	import type { PageProps as TimelineProps } from '../../nations/timeline/$types';
	import type { PageProps as CollectionProps } from '../../stats/[collection]/$types';
	import type { PageProps as CourtProps } from '../../courts/[court]/$types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// The props the page's own component takes: its data, and the address's parts as its own route names them.
	function pageProps<Props extends { data: unknown; params: unknown }>(): Props {
		return { data, params: data.restrictedParams, form: null } as unknown as Props;
	}
</script>

{#if data.restrictedView === 'nation'}
	<NationPage {...pageProps<NationProps>()} />
{:else if data.restrictedView === 'opinions'}
	<OpinionsPage {...pageProps<OpinionsProps>()} />
{:else if data.restrictedView === 'copies'}
	<CopiesPage {...pageProps<CopiesProps>()} />
{:else if data.restrictedView === 'chart-bar'}
	<ChartBarPage {...pageProps<ChartBarProps>()} />
{:else if data.restrictedView === 'timeline'}
	<TimelinePage {...pageProps<TimelineProps>()} />
{:else if data.restrictedView === 'collection'}
	<CollectionPage {...pageProps<CollectionProps>()} />
{:else if data.restrictedView === 'court'}
	<CourtPage {...pageProps<CourtProps>()} />
{/if}
