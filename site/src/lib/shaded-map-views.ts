/**
 * The map views that shade each Census land area by a fact about the nations whose entries name it: Public Law 280, the Violence Against Women Act's special Tribal criminal jurisdiction, and the Indian Health Service Areas (Trevor, 2026-11-23: views such as Public Law 280 added to the map over time). The facts come from each nation's `jurisdiction` and `indian_health_service` entries (docs/data-model.md, "Jurisdiction and federal ties"); src/lib/server/nations-map.ts sorts each nation into one category, and the map and its drawn copy shade the nation's land areas with that category's map-class token.
 *
 * A category is a summary for a national map. The nation's page holds the facts behind it, each with its source and the state it applies in.
 */

export type ShadedMapView = 'courts-and-peacemaking' | 'public-law-280' | 'violence-against-women-act' | 'indian-health-service';

export const shadedMapViews: ShadedMapView[] = ['courts-and-peacemaking', 'public-law-280', 'violence-against-women-act', 'indian-health-service'];

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

/** What the legend calls land areas the view has no fact for. */
export const unrecordedLabels: Record<ShadedMapView, string> = {
	'courts-and-peacemaking': 'No court or forum recorded yet',
	'public-law-280': 'No Public Law 280 fact recorded yet',
	'violence-against-women-act': 'Not recorded as exercising it',
	'indian-health-service': 'No Area recorded yet'
};

/** The id of a row in a shaded view's table: a nation's row, or for the Indian Health Service view an Area's. */
export function shadedRowAnchor(view: ShadedMapView, key: string): string {
	return `${view}-${key
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')}`;
}
