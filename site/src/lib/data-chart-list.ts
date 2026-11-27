/**
 * The charts on the Data and charts topic pages (/nations/data/<topic>), by identifier and title, in the order of the topics and their pages.
 * The counts are worked out at build time (src/lib/server/data-charts.ts); this list is what the
 * browser needs to offer each chart's table on its own in the Download menu, as Trevor asked on
 * Nov. 23, 2026 ("every data and charts table should be separately exportable").
 */
export const dataChartList = [
	{ identifier: 'supreme-court-cases-by-court', title: 'Supreme Court cases by Court' },
	{ identifier: 'supreme-court-cases-by-vote', title: 'Supreme Court cases by vote' },
	{ identifier: 'tribal-opinions-by-decade', title: 'Tribal court opinions by decade' },
	{ identifier: 'tribal-opinions-by-topic', title: 'Tribal court opinions by topic' },
	{ identifier: 'tribal-opinions-by-nation', title: 'Tribal court opinions by nation' },
	{ identifier: 'constitutions-by-status', title: 'Constitutions found' },
	{ identifier: 'constitutions-by-federal-act', title: 'Constitutions adopted under a federal act' },
	{ identifier: 'governing-documents-by-kind', title: 'Governing documents on record' },
	{ identifier: 'constitutions-by-voting-age', title: 'Voting age in constitutions' },
	{ identifier: 'constitutions-by-council-term', title: 'Council terms in constitutions' },
	{ identifier: 'forums-by-kind', title: 'Courts and forums by kind' },
	{ identifier: 'court-practice-by-kind', title: 'What nations’ courts publish' },
	{ identifier: 'courts-by-state', title: 'Nations with a court, by state' },
	{ identifier: 'provisions-by-method', title: 'Provisions by method' },
	{ identifier: 'provisions-by-dispute', title: 'Provisions by kind of dispute' },
	{ identifier: 'provisions-by-state', title: 'Provisions by state' },
	{ identifier: 'opinions-on-dispute-resolution-by-decade', title: 'Tribal court opinions on peacemaking, mediation and arbitration, by decade' },
	{ identifier: 'gaming-records-by-kind', title: 'Nations with each kind of federal gaming record' },
	{ identifier: 'compacts-by-decision', title: 'What the Department of the Interior did with each compact document' },
	{ identifier: 'compacts-by-period', title: 'Compact documents listed, by five-year period' },
	{ identifier: 'compacts-by-state', title: 'Compact documents by state' },
	{ identifier: 'compacts-by-dispute-step', title: 'Gaming compacts: steps in the dispute clause' },
	{ identifier: 'compacts-by-arbitration', title: 'Gaming compacts: does a dispute with the state go to binding arbitration?' },
	{ identifier: 'public-law-280-status', title: 'Public Law 280' },
	{ identifier: 'expanded-jurisdiction', title: 'Expanded tribal jurisdiction' },
	{ identifier: 'agreements-by-kind', title: 'Agreements with states' },
	{ identifier: 'nations-by-recognition-status', title: 'Native nations by recognition status' },
	{ identifier: 'nations-by-recognition', title: 'Nations by recognition' },
	{ identifier: 'federal-recognition-by-basis', title: 'How federal recognition came about' },
	{ identifier: 'federal-list-sections', title: 'Federally recognized nations, Alaska and the contiguous 48 states' },
	{ identifier: 'without-federal-recognition', title: 'Nations without federal recognition: the federal record' },
	{ identifier: 'federally-recognized-by-state', title: 'Federally recognized nations by state' },
	{ identifier: 'state-recognized-by-state', title: 'State-recognized nations by state' },
	{ identifier: 'nations-by-bureau-region', title: 'Nations by Bureau of Indian Affairs region' },
	{ identifier: 'nations-by-health-service-area', title: 'Nations by Indian Health Service Area' },
	{ identifier: 'treaties-by-decade', title: 'Treaties by decade signed' },
	{ identifier: 'land-by-method', title: 'How land was first set aside' }
] as const;

export type DataChartIdentifier = (typeof dataChartList)[number]['identifier'];

/**
 * The topics Data and charts is split into (Trevor, Nov. 24, 2026: "create sub-pages for data and
 * charts, so we can have specialities into the charts and graphs, for our different topics"), in
 * alphabetical order so no one topic leads. Each topic has its own page, /nations/data/<topic>,
 * listing its charts in the order given.
 */
export const dataTopicList: { identifier: string; title: string; description: string; charts: readonly DataChartIdentifier[] }[] = [
	{
		identifier: 'cases',
		title: 'Cases',
		description: 'Supreme Court of the United States cases on this site and published tribal court opinions.',
		charts: ['supreme-court-cases-by-court', 'supreme-court-cases-by-vote', 'tribal-opinions-by-decade', 'tribal-opinions-by-topic', 'tribal-opinions-by-nation']
	},
	{
		identifier: 'constitutions-and-governance',
		title: 'Constitutions and governance',
		description: 'Nations’ constitutions and governing documents, and what the constitutions say.',
		charts: ['constitutions-by-status', 'constitutions-by-federal-act', 'governing-documents-by-kind', 'constitutions-by-voting-age', 'constitutions-by-council-term']
	},
	{
		identifier: 'courts-and-justice-systems',
		title: 'Courts and justice systems',
		description: 'Nations’ courts and forums and what their courts publish.',
		charts: ['forums-by-kind', 'court-practice-by-kind', 'courts-by-state']
	},
	{
		identifier: 'dispute-resolution',
		title: 'Dispute resolution',
		description: 'Dispute resolution provisions in nations’ own laws.',
		charts: ['provisions-by-method', 'provisions-by-dispute', 'provisions-by-state', 'opinions-on-dispute-resolution-by-decade']
	},
	{
		identifier: 'gaming',
		title: 'Gaming',
		description: 'Tribal-state gaming compacts, gaming ordinances and what the compacts say.',
		charts: ['gaming-records-by-kind', 'compacts-by-decision', 'compacts-by-period', 'compacts-by-state', 'compacts-by-dispute-step', 'compacts-by-arbitration']
	},
	{
		identifier: 'jurisdiction',
		title: 'Jurisdiction',
		description: 'Public Law 280, expanded tribal jurisdiction and agreements with states.',
		charts: ['public-law-280-status', 'expanded-jurisdiction', 'agreements-by-kind']
	},
	{
		identifier: 'recognition-and-federal-services',
		title: 'Recognition and federal services',
		description: 'How nations are recognized, and the federal regions and areas that serve them.',
		charts: ['nations-by-recognition-status', 'nations-by-recognition', 'federal-recognition-by-basis', 'federal-list-sections', 'without-federal-recognition', 'federally-recognized-by-state', 'state-recognized-by-state', 'nations-by-bureau-region', 'nations-by-health-service-area']
	},
	{
		identifier: 'treaties-and-land',
		title: 'Treaties and land',
		description: 'Treaties nations signed with the United States, and how their land was first set aside.',
		charts: ['treaties-by-decade', 'land-by-method']
	}
];

/** The titles of charts proposed for a topic but not drawn yet, for the mockup of the Data and charts index (Nov. 24, 2026). */
/** The address of a topic's page. */
export const dataTopicLink = (identifier: string): string => `/nations/data/${identifier}`;

/** The topic a chart is filed under. */
export function dataTopicOf(chartIdentifier: string): { identifier: string; title: string } {
	const topic = dataTopicList.find((candidate) => (candidate.charts as readonly string[]).includes(chartIdentifier));
	if (!topic) throw new Error(`No topic lists the chart ${chartIdentifier}`);
	return { identifier: topic.identifier, title: topic.title };
}

/** The trail above a page about one chart: Data and charts, its topic, and the chart on the topic's page. */
export function dataChartTrail(chart: { identifier: string; title: string }): { label: string; href: string }[] {
	const topic = dataTopicOf(chart.identifier);
	return [
		{ label: 'Nations', href: '/nations' },
		{ label: 'Data and charts', href: '/nations/data' },
		{ label: topic.title, href: dataTopicLink(topic.identifier) },
		{ label: chart.title, href: `${dataTopicLink(topic.identifier)}#${chart.identifier}` }
	];
}

/** A chart's identifier and title, for the chart's own definition. */
export function dataChartNamed(identifier: DataChartIdentifier): { identifier: string; title: string } {
	const found = dataChartList.find((chart) => chart.identifier === identifier);
	if (!found) throw new Error(`No chart ${identifier}`);
	return { identifier: found.identifier, title: found.title };
}

/** Where a chart's table is published. */
export function dataChartTableLink(identifier: string, extension: 'csv' | 'json' | 'xlsx'): string {
	return `/nations/data/tables/${identifier}.${extension}`;
}
