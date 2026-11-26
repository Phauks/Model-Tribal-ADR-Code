import { describe, expect, it, vi } from 'vitest';
import { presidentOn } from '#lib/president-terms.ts';
import { sources } from '#lib/server/content.ts';
import { nationsCiting, orderNumber, orderPresident } from '#lib/server/law-facts.ts';
import { isLawRecord, recordName } from '#lib/server/law-records.ts';
import { formatSource } from '#lib/server/markdown.ts';
import { mediaLabel, servedMediaTypes } from '#lib/public-copies.ts';

vi.mock('virtual:source-citations', () => ({ sourceCitations: {} }));
vi.mock('virtual:essay-library', () => ({ essaysInGit: {}, essayBoxFacts: { cases: {}, laws: {} } }));

const jemez = 'executive-order-1906-12-19-537';

describe('An executive order’s page', () => {
	const orders = () => [...sources().values()].filter((record) => record.kind === 'executive-order');

	it('every executive order has one', () => {
		expect(orders().length).toBeGreaterThan(560);
		expect(orders().filter((record) => !isLawRecord(record)).map((record) => record.key)).toEqual([]);
	});

	it('gives the order’s number and the President who signed it', () => {
		const record = sources().get(jemez)!;
		expect(orderNumber(record)).toBe('537');
		expect(orderPresident(record)).toMatchObject({ name: 'Theodore Roosevelt', key: 'theodore-roosevelt' });
		expect(orderNumber(sources().get('executive-order-14053')!)).toBe('14053');
	});

	it('writes a date in its title as the style guide does', () => {
		expect(recordName(jemez).name).toBe('Executive Order No. 537 of Dec. 19, 1906');
	});

	it('lists the nation pages that cite it, with what each cites it for', () => {
		expect(nationsCiting(jemez)).toEqual([{ id: 'pueblo-of-jemez', name: 'Pueblo of Jemez', what: ['Jemez Pueblo additional lands, New Mexico'] }]);
	});

	it('serves the order’s saved text', () => {
		expect(servedMediaTypes.has('text/plain')).toBe(true);
		expect(mediaLabel('text/plain')).toBe('text');
	});

	it('names the President for every order with a full date', () => {
		const missing = orders().filter((record) => (record.citation.issued?.['date-parts']?.[0]?.length ?? 0) === 3 && !orderPresident(record));
		expect(missing.map((record) => record.key)).toEqual([]);
	});

	it('takes the President its record names over the one its date gives, where the record’s date is off', () => {
		// The database dates Exec. Order No. 8358 to 1925 from a date in its text; Franklin D. Roosevelt signed it in 1940.
		expect(orderPresident(sources().get('executive-order-8358')!)?.key).toBe('franklin-d-roosevelt');
	});
});

describe('Who was President on a day', () => {
	it('goes to the incoming President on inauguration day and to the successor on the day of the oath', () => {
		expect(presidentOn('1906-12-19')?.key).toBe('theodore-roosevelt');
		expect(presidentOn('1913-03-04')?.key).toBe('woodrow-wilson');
		expect(presidentOn('1913-03-03')?.key).toBe('william-h-taft');
		expect(presidentOn('1865-04-15')?.key).toBe('andrew-johnson');
		expect(presidentOn('1886-01-01')?.name).toBe('Grover Cleveland');
		expect(presidentOn('2025-02-01')?.key).toBe('donald-j-trump');
	});

	it('names nobody for a year alone or a day before 1789', () => {
		expect(presidentOn('1906')).toBeUndefined();
		expect(presidentOn('1788-12-31')).toBeUndefined();
	});
});

describe('A reference to a law with its own page', () => {
	it('links the law’s title to the page', () => {
		expect(formatSource(sources().get(jemez), jemez)).toContain(`<a class="source-page" href="/laws/${jemez}">`);
	});

	it('leaves a source without a page as it was', () => {
		const other = [...sources().values()].find((record) => record.kind === 'web-page')!;
		expect(formatSource(other, other.key)).not.toContain('source-page');
	});
});
