import { describe, expect, it } from 'vitest';
import { displayName } from '../src/lib/nation-labels.ts';
import { downloadFor } from '../src/lib/page-downloads.ts';

describe('downloadFor', () => {
	it('offers a nation page its record, and the map page nothing', () => {
		expect(downloadFor('/nations/cherokee-nation')?.link).toBe('/nations/cherokee-nation/record.json');
		expect(downloadFor('/nations/map')).toBeUndefined();
	});

	it('offers the index pages the list, and the glossary its terms', () => {
		expect(downloadFor('/nations/letter/n')?.link).toBe('/nations/nations.csv');
		expect(downloadFor('/nations/state/nv')?.link).toBe('/nations/nations.csv');
		expect(downloadFor('/glossary/native-nations')?.link).toBe('/glossary/terms.json');
		expect(downloadFor('/changelog')).toBeUndefined();
	});
});

describe('displayName', () => {
	it('leaves out the states a list adds after a comma', () => {
		expect(displayName('Navajo Nation, Arizona, New Mexico, & Utah')).toBe('Navajo Nation');
		expect(displayName('Confederated Tribes of the Goshute Reservation, Nevada and Utah')).toBe('Confederated Tribes of the Goshute Reservation');
		expect(displayName('Pueblo of Zia, New Mexico')).toBe('Pueblo of Zia');
	});

	it('keeps a state that is part of the name', () => {
		expect(displayName('Paiute Indian Tribe of Utah')).toBe('Paiute Indian Tribe of Utah');
		expect(displayName('Fort Mojave Indian Tribe of Arizona, California & Nevada')).toBe('Fort Mojave Indian Tribe of Arizona, California & Nevada');
		expect(displayName('Metlakatla Indian Community, Annette Island Reserve')).toBe('Metlakatla Indian Community, Annette Island Reserve');
	});
});
