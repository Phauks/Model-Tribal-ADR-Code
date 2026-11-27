/**
 * The Census figures for the land areas a nation's page names (Trevor asked
 * on Nov. 27, 2026 for Census information in Key facts, and chose all eight
 * figures from the mockup in project files design/census-key-facts/).
 *
 * Each area shows the people the 2020 Census counted living there (the
 * resident-population facts in the nations' entries, from the redistricting
 * file) and seven figures from the American Community Survey's 2020-2024
 * five-year estimates (research/census/acs-2020-2024-native-areas.csv, from
 * scripts/tribes/acs_native_areas.py). Every survey figure shows its margin
 * of error at the Bureau's 90 percent confidence level. Counts and medians
 * carry the Bureau's own margins; a percentage worked out from two counts
 * carries the margin the Bureau's formula for a derived proportion gives
 * (U.S. Census Bureau, Understanding and Using American Community Survey
 * Data: What All Data Users Need to Know, ch. 8 (2020)). The figures describe
 * everyone living in an area, Native or not: an area is not a nation, and
 * none of them is a count of a nation's citizens.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../csv.ts';
import { repositoryRoot } from './content.ts';

/** The survey's figures file and its References entry. */
export const surveyFile = 'research/census/acs-2020-2024-native-areas.csv';
export const surveySource = 'census-american-community-survey-2020-2024-native-areas';

/** The survey's five years, as the line under an area's name says them. */
export const surveyYears = '2020–2024';

export type SurveyRow = Record<string, string>;

let surveyCache: Map<string, SurveyRow> | undefined;

/** The survey's figures for each area, by its four-character Census code. */
export function surveyRows(): Map<string, SurveyRow> {
	if (!surveyCache) {
		const rows = parseCsv(readFileSync(path.join(repositoryRoot, surveyFile), 'utf8').normalize('NFC'));
		surveyCache = new Map(rows.map((row) => [row.geographic_identifier, row]));
	}
	return surveyCache;
}

/** An estimate with its margin of error, both as numbers. */
export interface Estimate {
	value: number;
	margin?: number;
}

function number(row: SurveyRow, column: string): number | undefined {
	const text = row[column];
	if (text === undefined || text.trim() === '') return undefined;
	const value = Number(text);
	return Number.isFinite(value) ? value : undefined;
}

function estimate(row: SurveyRow, column: string): Estimate | undefined {
	const value = number(row, column);
	if (value === undefined) return undefined;
	const margin = number(row, `${column}_margin`);
	return { value, ...(margin === undefined ? {} : { margin }) };
}

/** The margin of a sum of estimates: the square root of the sum of their squared margins (ch. 8). */
export function sumMargin(margins: number[]): number {
	return Math.sqrt(margins.reduce((total, margin) => total + margin * margin, 0));
}

/**
 * A part as a percentage of a whole, with the margin the Bureau's formula for
 * a derived proportion gives: the square root of (part margin squared minus
 * the proportion squared times whole margin squared), over the whole. When the
 * value under the root is negative, the formula for a ratio is used instead
 * (a plus sign in place of the minus), as the Bureau directs.
 */
export function proportion(part: Estimate, whole: Estimate): Estimate | undefined {
	if (!whole.value) return undefined;
	const share = part.value / whole.value;
	if (part.margin === undefined || whole.margin === undefined) return { value: 100 * share };
	const under = part.margin ** 2 - share ** 2 * whole.margin ** 2;
	const root = Math.sqrt(under >= 0 ? under : part.margin ** 2 + share ** 2 * whole.margin ** 2);
	return { value: 100 * share, margin: (100 * root) / whole.value };
}

/** One figure under an area's name: its label, the value as shown and its margin as shown. */
export interface SurveyFigure {
	label: string;
	text: string;
	margin?: string;
}

const whole = (value: number) => Math.round(value).toLocaleString('en-US');
const tenths = (value: number) => (Math.round(value * 10) / 10).toFixed(1);
const dollars = (value: number) => `$${whole(value)}`;

/**
 * The seven survey figures for an area, in the order of the approved
 * mockup. A figure the survey leaves blank, as it does for the median income
 * of an area with too few households, is left out.
 */
export function surveyFigures(row: SurveyRow): SurveyFigure[] {
	const figures: SurveyFigure[] = [];
	const add = (label: string, value: Estimate | undefined, show: (value: number) => string, suffix = '') => {
		if (!value) return;
		figures.push({
			label,
			text: `${show(value.value)}${suffix}`,
			...(value.margin === undefined ? {} : { margin: show(value.margin) })
		});
	};
	const total = estimate(row, 'total_population');
	const native = estimate(row, 'american_indian_alaska_native_alone_or_in_combination');
	add('American Indian or Alaska Native', native && total ? proportion(native, total) : undefined, whole, '%');
	add('Median age', estimate(row, 'median_age'), tenths);
	add('Median household income', estimate(row, 'median_household_income'), dollars);
	const ratio = (part: string, of: string) => {
		const top = estimate(row, part);
		const bottom = estimate(row, of);
		return top && bottom ? proportion(top, bottom) : undefined;
	};
	add('Below the poverty level', ratio('below_poverty_level', 'poverty_status_known'), tenths, '%');
	add('Unemployed', ratio('unemployed', 'civilian_labor_force'), tenths, '%');
	const degrees = ['bachelors_degree', 'masters_degree', 'professional_degree', 'doctorate_degree'].map((column) => estimate(row, column));
	const adults = estimate(row, 'age_25_and_older');
	if (adults && degrees.every(Boolean)) {
		const known = degrees as Estimate[];
		const margins = known.map((degree) => degree.margin);
		const part: Estimate = {
			value: known.reduce((sum, degree) => sum + degree.value, 0),
			...(margins.every((margin) => margin !== undefined) ? { margin: sumMargin(margins as number[]) } : {})
		};
		add('Bachelor’s degree or more', proportion(part, adults), tenths, '%');
	}
	add('Households with broadband', ratio('broadband_any_type', 'households'), tenths, '%');
	return figures;
}

/** The survey's count of people living in an area, for an area the 2020 Census count is missing for. */
export function surveyPeople(row: SurveyRow): SurveyFigure | undefined {
	const total = estimate(row, 'total_population');
	if (!total) return undefined;
	return { label: 'People living there', text: whole(total.value), ...(total.margin === undefined ? {} : { margin: whole(total.margin) }) };
}

/** An area's name as the table builder's Area column shows it, without the states the Bureau ends it with. */
export function builderAreaName(row: SurveyRow): string {
	return row.name.replace(/, [A-Z]{2}(--[A-Z]{2})*$/, '');
}
