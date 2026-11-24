import { describe, expect, it } from 'vitest';
import { centsFromDollars, dollarsAfterTyping, dollarsWhileTyping, giftCents } from '#lib/sponsorship.ts';

describe('amounts of money', () => {
	it('reads dollars as people write them', () => {
		expect(centsFromDollars('25')).toBe(2500);
		expect(centsFromDollars('$1,250')).toBe(125_000);
		expect(centsFromDollars(' $ 12.5 ')).toBe(1250);
		expect(centsFromDollars('12.05')).toBe(1205);
		expect(centsFromDollars('0.99')).toBe(99);
		expect(centsFromDollars('10000')).toBe(1_000_000);
	});

	it('refuses numbers that are not money', () => {
		for (const text of ['', '1e3', '0x10', '0b101', '12.345', '-5', '+5', '1,25', '12,50.00', '1.2.3', '.50', '007', 'Infinity', 'NaN', '5 5', '1,0000'])
			expect(centsFromDollars(text), text).toBeNull();
	});

	it('takes gifts from $5 to $10,000', () => {
		expect(giftCents('4.99')).toBeNull();
		expect(giftCents('5')).toBe(500);
		expect(giftCents('10,000.00')).toBe(1_000_000);
		expect(giftCents('10000.01')).toBeNull();
	});

	it('keeps only what can be money while typing, and tidies it after', () => {
		expect(dollarsWhileTyping('$12abc.3456')).toBe('12.34');
		expect(dollarsWhileTyping('1e3')).toBe('13');
		expect(dollarsWhileTyping('-5.5.5')).toBe('5.55');
		expect(dollarsAfterTyping('1250')).toBe('1,250');
		expect(dollarsAfterTyping('12.5')).toBe('12.50');
		expect(dollarsAfterTyping('12.345')).toBe('12.345');
	});
});
