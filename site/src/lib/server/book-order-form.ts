/**
 * Reads what the book page sends when a reader asks for a price or places an
 * order (docs/book-orders.md), and turns it into Lulu's request shapes.
 */
import {
	bindings,
	choiceProblem,
	finishes,
	foilColors,
	inks,
	linenColors,
	papers,
	shippingLevels,
	type PrintChoice,
	type ShippingLevel
} from '#lib/book-order.ts';
import type { ShippingAddress } from './lulu.ts';

export interface BookOrderForm {
	choice: PrintChoice;
	shippingLevel: ShippingLevel;
	address: ShippingAddress;
	email?: string;
}

type Result = { ok: true; form: BookOrderForm } | { ok: false; problem: string };

function text(value: unknown, longest: number): string {
	return typeof value === 'string' ? value.trim().slice(0, longest) : '';
}

function oneOf<Value extends string>(value: unknown, allowed: readonly Value[]): Value | undefined {
	return allowed.find((candidate) => candidate === value);
}

/**
 * The prepared files for a choice: one interior per size, one cover per size
 * and binding. Case wrap and linen wrap share the hardcover cover. The print
 * build makes no coil-bound cover yet, so that set is never found and the
 * order page says the book is not ready in that binding.
 */
export function fileSetFor(choice: PrintChoice): string {
	const set = { paperback: 'paperback', caseWrap: 'hardcover', linenWrap: 'hardcover', coilBound: 'coil-bound' }[choice.binding];
	return `current/${choice.size}/${set}`;
}

export function readBookOrderForm(body: unknown, needsEmail: boolean): Result {
	if (!body || typeof body !== 'object') return { ok: false, problem: 'The order could not be read.' };
	const fields = body as Record<string, unknown>;
	const rawChoice = (fields.choice ?? {}) as Record<string, unknown>;
	const choice: PrintChoice = {
		size: text(rawChoice.size, 40),
		binding: oneOf(rawChoice.binding, bindings) ?? ('' as PrintChoice['binding']),
		ink: oneOf(rawChoice.ink, inks) ?? ('' as PrintChoice['ink']),
		paper: oneOf(rawChoice.paper, papers) ?? ('' as PrintChoice['paper']),
		finish: oneOf(rawChoice.finish, finishes) ?? ('' as PrintChoice['finish']),
		linenColor: oneOf(rawChoice.linenColor, linenColors),
		foilColor: oneOf(rawChoice.foilColor, foilColors)
	};
	const problem = choiceProblem(choice);
	if (problem) return { ok: false, problem };

	const shippingLevel = oneOf(fields.shippingLevel, shippingLevels);
	if (!shippingLevel) return { ok: false, problem: 'Choose how the book is shipped.' };

	const rawAddress = (fields.address ?? {}) as Record<string, unknown>;
	const address: ShippingAddress = {
		name: text(rawAddress.name, 100),
		street1: text(rawAddress.street1, 200),
		street2: text(rawAddress.street2, 200) || undefined,
		city: text(rawAddress.city, 100),
		state_code: text(rawAddress.stateCode, 10).toUpperCase() || undefined,
		postcode: text(rawAddress.postcode, 20),
		country_code: text(rawAddress.countryCode, 2).toUpperCase(),
		phone_number: text(rawAddress.phone, 30)
	};
	if (!/^[A-Z]{2}$/.test(address.country_code)) return { ok: false, problem: 'Choose a country.' };
	if (!address.city || !address.postcode) return { ok: false, problem: 'Enter the city and postal code.' };
	if (['US', 'CA'].includes(address.country_code) && !address.state_code) return { ok: false, problem: 'Enter the state or province.' };

	const form: BookOrderForm = { choice, shippingLevel, address };
	if (needsEmail) {
		// Lulu needs a name, street and telephone number to deliver a book.
		if (!address.name || !address.street1) return { ok: false, problem: 'Enter the name and street address.' };
		if (!address.phone_number) return { ok: false, problem: 'Enter a telephone number for the carrier.' };
		const email = text(fields.email, 200);
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, problem: 'Enter an email address for the receipt.' };
		form.email = email;
	}
	return { ok: true, form };
}

/** The address Lulu needs for a price: no name is required, and a placeholder telephone is accepted. */
export function addressForQuote(address: ShippingAddress): Omit<ShippingAddress, 'name'> {
	return {
		street1: address.street1 || 'Address for price',
		street2: address.street2,
		city: address.city,
		state_code: address.state_code,
		postcode: address.postcode,
		country_code: address.country_code,
		phone_number: address.phone_number || '0000000000'
	};
}
