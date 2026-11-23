/**
 * The map views that shade each Census land area by a fact about the nations whose entries name it: Public Law 280, the Violence Against Women Act's special Tribal criminal jurisdiction, and the Indian Health Service Areas (Trevor, 2026-11-23: views such as Public Law 280 added to the map over time). The facts come from each nation's `jurisdiction` and `indian_health_service` entries (docs/data-model.md, "Jurisdiction and federal ties"); src/lib/server/nations-map.ts sorts each nation into one category, and the map and its drawn copy shade the nation's land areas with that category's map-class token.
 *
 * A category is a summary for a national map. The nation's page holds the facts behind it, each with its source and the state it applies in.
 *
 * Each view's categories, wording and table are defined once, in `shadedViewDefinitions` below; how a nation is sorted into a category is its rule in src/lib/server/nations-map.ts.
 */

export type ShadedMapView =
	| 'courts-and-peacemaking'
	| 'public-law-280'
	| 'violence-against-women-act'
	| 'other-jurisdiction-laws'
	| 'agreements-with-states'
	| 'gaming'
	| 'indian-health-service';

export const shadedMapViews: ShadedMapView[] = [
	'courts-and-peacemaking',
	'public-law-280',
	'violence-against-women-act',
	'other-jurisdiction-laws',
	'agreements-with-states',
	'gaming',
	'indian-health-service'
];

export function isShadedMapView(view: string): view is ShadedMapView {
	return (shadedMapViews as string[]).includes(view);
}

/** One category of a shaded view, and the map-class token (0 to 4) its areas are drawn with. */
export interface ShadeCategory {
	key: string;
	label: string;
	shade: number;
}

/**
 * How the courts view sums up a nation's justice institutions and dispute resolution forums (each record's `justice_institutions` and `dispute_resolution.forums`), in order of precedence. The table shows every kind the nation has; the map shows the first.
 *
 * 1. peacemaking: a peacemaking program or a traditional or customary forum, such as an elders' council or a circle.
 * 2. wellness: a healing to wellness court.
 * 3. court: a tribal court of any kind, including an intertribal court the nation shares.
 * 4. federal: only a Court of Indian Offenses, which the Bureau of Indian Affairs runs (25 C.F.R. part 11).
 */
export const courtCategories: ShadeCategory[] = [
	{ key: 'peacemaking', label: 'Peacemaking or a traditional forum', shade: 4 },
	{ key: 'wellness', label: 'Healing to wellness court', shade: 3 },
	{ key: 'court', label: 'Tribal court', shade: 2 },
	{ key: 'federal', label: 'Court of Indian Offenses only (federal)', shade: 1 }
];

/**
 * Federal laws on jurisdiction besides Public Law 280 and the Violence Against Women Act (each record's `jurisdiction` facts on the topics state-jurisdiction-statute, tribal-law-and-order-act-enhanced-sentencing and indian-child-welfare-act), in order of precedence. The table shows every one each nation has.
 */
export const otherJurisdictionLawCategories: ShadeCategory[] = [
	{ key: 'state-statute', label: 'State jurisdiction under another federal law, such as the Kansas Act or a land claims settlement', shade: 4 },
	{ key: 'child-welfare-reassumed', label: 'Reassumed jurisdiction under the Indian Child Welfare Act', shade: 3 },
	{ key: 'enhanced-sentencing', label: 'Longer sentences under the Tribal Law and Order Act', shade: 2 }
];

/** Agreements with a state, county, city or federal agency (each record's `jurisdiction_agreements`), in order of precedence. Most sources do not say whether an agreement is still in force. */
export const agreementCategories: ShadeCategory[] = [
	{ key: 'cross-deputization', label: 'Cross-deputization or law enforcement agreement', shade: 4 },
	{ key: 'child-welfare-agreement', label: 'Child welfare agreement', shade: 3 },
	{ key: 'tax-agreement', label: 'Tax agreement', shade: 2 },
	{ key: 'other', label: 'Other agreement', shade: 1 }
];

/**
 * Gaming under the Indian Gaming Regulatory Act (each record's `gaming` facts, and the gaming compacts and Secretarial Procedures in its document histories), in order of precedence. The table shows every one each nation has.
 *
 * 1. compact: a Class III compact with a state that the Secretary of the Interior approved or let take effect (25 U.S.C. § 2710(d)(8)), whether or not it has since expired or been replaced. A disapproved compact does not count.
 * 2. procedures: Class III gaming under Secretarial Procedures, issued in place of a compact (25 U.S.C. § 2710(d)(7)(B)(vii); 25 C.F.R. part 291).
 * 3. ordinance: a gaming ordinance the National Indian Gaming Commission approved (25 U.S.C. § 2710(b), (d)(1)(A)).
 * 4. operates: a source says the nation operates gaming, with none of the above recorded.
 */
export const gamingCategories: ShadeCategory[] = [
	{ key: 'compact', label: 'Class III compact with a state', shade: 4 },
	{ key: 'procedures', label: 'Secretarial Procedures in place of a compact', shade: 3 },
	{ key: 'ordinance', label: 'Gaming ordinance approved', shade: 2 },
	{ key: 'operates', label: 'Operates gaming (no ordinance or compact recorded)', shade: 1 }
];

/**
 * How the Public Law 280 view sums up a nation's facts, in order of precedence (a nation whose facts fit several takes the first):
 *
 * 1. returned: the state gave back some or all of its jurisdiction (retrocession), to the United States and the nation.
 * 2. mandatory: a mandatory state (18 U.S.C. § 1162(a), 28 U.S.C. § 1360(a)).
 * 3. optional: a state that took some or all jurisdiction under the optional sections, and has not repealed it.
 * 4. none: excepted from the statute, in a state that never took jurisdiction, consent not given, an assumption held invalid or repealed, or a state on neither of the Bureau of Indian Affairs' lists.
 */
export const publicLaw280Categories: ShadeCategory[] = [
	{ key: 'mandatory', label: 'State jurisdiction required by the statute', shade: 4 },
	{ key: 'returned', label: 'Some or all given back by the state (retrocession)', shade: 3 },
	{ key: 'optional', label: 'State chose to take some or all jurisdiction', shade: 2 },
	{ key: 'none', label: 'No state jurisdiction under Public Law 280', shade: 1 }
];

/** An implementation grant can fund planning, so it never counts as exercising (docs/data-model.md). */
export const violenceAgainstWomenActCategories: ShadeCategory[] = [
	{ key: 'exercising', label: 'Exercising special Tribal criminal jurisdiction', shade: 4 },
	{ key: 'implementation-grant', label: 'Federal grant to prepare (not counted as exercising)', shade: 2 }
];

/**
 * The Indian Health Service's twelve Areas, each given one of three shades that differ from its neighbors' (light, middle and dark, so neighbors never share a shade). Each Area's name is also written on the map, so the shade is never the only way to tell them apart.
 */
export const healthServiceAreaShades: Record<string, number> = {
	Alaska: 2,
	Albuquerque: 2,
	Bemidji: 2,
	Billings: 4,
	California: 4,
	'Great Plains': 1,
	Nashville: 1,
	Navajo: 4,
	'Oklahoma City': 4,
	Phoenix: 1,
	Portland: 2,
	Tucson: 4
};

/**
 * Everything the page says about one shaded view, kept in one place so a new view is one entry here and one rule in src/lib/server/nations-map.ts (site/DESIGN.md, section 11, "How to add a map view").
 */
export interface ShadedViewDefinition {
	/** The categories, in order of precedence. Left out when they come from the data, as the Indian Health Service view has one per Area. */
	categories?: ShadeCategory[];
	/** What the legend and tooltips call land areas the view has no fact for. */
	unrecorded: string;
	/** The note beside the map, before the notes on offices and insets. Plain text. */
	note: string;
	/** The table's caption. */
	caption: string;
	/** What the table lists: each nation with a fact, or each category, opening to its nations. */
	rows: 'nations' | 'categories';
	/** For a view where a nation can have several kinds at once: the header of each kind's Yes column, by category key. The map shades a nation by the first kind it has. */
	kindHeaders?: Record<string, string>;
	/** For a view with one category per nation: the header of the column that gives it. For a table of categories: the header of their column. */
	categoryHeader?: string;
	/** The part of a nation's page that has the view's facts and their sources, which each nation's name in the table goes to. */
	section: string;
	/** Whether each category's name is written on the map, at the middle of its land areas. */
	labels?: boolean;
	/** How the page's list of sources says the view uses each source. Left out when the sources are too many to list, and the table goes to each nation's own section instead. */
	sources?: { section: string; text: string };
}

export const shadedViewDefinitions: Record<ShadedMapView, ShadedViewDefinition> = {
	'courts-and-peacemaking': {
		categories: courtCategories,
		unrecorded: 'No court or forum recorded yet',
		note: 'Each nation’s land areas are shaded by the first of these it has: peacemaking or a traditional forum, a healing to wellness court, a tribal court, or only a Court of Indian Offenses, which the Bureau of Indian Affairs runs. The table shows every kind each nation has. A nation missing here may still have a court: the record is only as complete as its sources. Each nation’s page lists its courts and forums, with their sources. Select an area to go to its nation’s row.',
		caption: 'Nations with a court or forum recorded, and which kinds',
		rows: 'nations',
		kindHeaders: { peacemaking: 'Peacemaking or traditional forum', wellness: 'Wellness court', court: 'Tribal court', federal: 'Court of Indian Offenses' },
		section: 'courts-heading'
	},
	'public-law-280': {
		categories: publicLaw280Categories,
		unrecorded: 'No Public Law 280 fact recorded yet',
		note: 'Each nation’s land areas are shaded by one summary of its Public Law 280 facts. The summary is only a guide: what the state may do differs by subject, by state and over time, and some nations are in more than one state. Each nation’s page has the facts, the state each applies in and their sources. Nations with no land area on the map are still in the table. Select an area to go to its nation’s row.',
		caption: 'Nations with a Public Law 280 fact recorded, and a summary of what the facts say',
		rows: 'nations',
		categoryHeader: 'Summary',
		section: 'jurisdiction-heading',
		sources: { section: 'Public Law 280', text: 'each nation’s Public Law 280 facts, summed up in one category' }
	},
	'violence-against-women-act': {
		categories: violenceAgainstWomenActCategories,
		unrecorded: 'Not recorded as exercising it',
		note: 'Shaded areas belong to nations that sources record as exercising special Tribal criminal jurisdiction over non-Indians under the Violence Against Women Act (25 U.S.C. § 1304), or as holding a federal grant to prepare for it. A grant can pay for planning, so it is never counted as exercising. A nation missing here may still exercise it: the record is only as complete as its sources. Select an area to go to its nation’s row.',
		caption: 'Nations recorded as exercising special Tribal criminal jurisdiction, or holding a grant to prepare for it',
		rows: 'nations',
		categoryHeader: 'Status',
		section: 'jurisdiction-heading',
		sources: { section: 'Violence Against Women Act jurisdiction', text: 'nations exercising special Tribal criminal jurisdiction, and implementation grants' }
	},
	'other-jurisdiction-laws': {
		categories: otherJurisdictionLawCategories,
		unrecorded: 'None of these recorded',
		note: 'Each nation’s land areas are shaded by the first of these that applies to it: a federal law other than Public Law 280 that gives a state criminal or civil jurisdiction, such as the Kansas Act or a land claims settlement act; jurisdiction over child custody cases reassumed under the Indian Child Welfare Act (25 U.S.C. § 1918); or longer sentences under the Tribal Law and Order Act (25 U.S.C. § 1302(b)). The table shows every one each nation has. Each nation’s page has the facts and their sources. Select an area to go to its nation’s row.',
		caption: 'Nations under another federal law on jurisdiction, and which',
		rows: 'nations',
		kindHeaders: { 'state-statute': 'State jurisdiction under another law', 'child-welfare-reassumed': 'Child welfare jurisdiction reassumed', 'enhanced-sentencing': 'Enhanced sentencing' },
		section: 'jurisdiction-heading',
		sources: { section: 'Other jurisdiction laws', text: 'each nation’s facts on state jurisdiction under other federal laws, on reassumed child welfare jurisdiction and on enhanced sentencing' }
	},
	'agreements-with-states': {
		categories: agreementCategories,
		unrecorded: 'No agreement recorded yet',
		note: 'Each nation’s land areas are shaded by the first kind of agreement it has with a state, county, city or federal agency: cross-deputization or law enforcement, child welfare, tax, or another kind. Most sources do not say whether an agreement is still in force; each nation’s page gives the agreement, the other party, its date and its sources. Select an area to go to its nation’s row.',
		caption: 'Nations with an agreement recorded, and which kinds',
		rows: 'nations',
		kindHeaders: { 'cross-deputization': 'Cross-deputization', 'child-welfare-agreement': 'Child welfare', 'tax-agreement': 'Tax', other: 'Other' },
		section: 'jurisdiction-heading',
		sources: { section: 'Agreements with states', text: 'each nation’s agreements with a state, county, city or federal agency' }
	},
	gaming: {
		categories: gamingCategories,
		unrecorded: 'No gaming recorded yet',
		note: 'Each nation’s land areas are shaded by the first of these it has: a Class III gaming compact with a state that the Secretary of the Interior approved or let take effect, Secretarial Procedures issued in place of a compact, a gaming ordinance the National Indian Gaming Commission approved, or a source saying it operates gaming. A compact counts even if it has since expired or been replaced; a disapproved compact does not. The table shows every one each nation has. Each nation’s page lists its compacts and their versions. Select an area to go to its nation’s row.',
		caption: 'Nations with gaming recorded under the Indian Gaming Regulatory Act, and which kinds',
		rows: 'nations',
		kindHeaders: { compact: 'Class III compact', procedures: 'Secretarial Procedures', ordinance: 'Gaming ordinance', operates: 'Operates gaming' },
		section: 'law-heading',
		sources: { section: 'Gaming', text: 'each nation’s gaming compacts, gaming ordinances and whether it operates gaming' }
	},
	'indian-health-service': {
		unrecorded: 'No Area recorded yet',
		note: 'Each nation’s land areas are shaded by the Indian Health Service Area its entry names, and each Area’s name is written on the map. Neighboring Areas are given different shades. Select an area to go to its Area’s row, which lists its nations.',
		caption: 'Nations each Indian Health Service Area serves, as each nation’s entry records it',
		rows: 'categories',
		categoryHeader: 'Area',
		section: 'ties-heading',
		labels: true,
		sources: { section: 'Indian Health Service Areas', text: 'the Area that serves each nation' }
	}
};

/** The id of a row in a shaded view's table: a nation's row, or for the Indian Health Service view an Area's. */
export function shadedRowAnchor(view: ShadedMapView, key: string): string {
	return `${view}-${key
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')}`;
}
