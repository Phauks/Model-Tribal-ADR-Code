/**
 * List prices of the models the source watch uses, in dollars per million
 * tokens, for the spend shown on the progress page. Through AI Gateway's
 * Unified Billing, Cloudflare passes the provider's prices through and
 * charges its fee when credits are bought, not per call
 * (https://developers.cloudflare.com/ai-gateway/features/unified-billing/),
 * so the credits a call uses are these prices.
 *
 * - Claude Haiku 5.5: Cloudflare's model catalog
 *   (https://developers.cloudflare.com/ai/models/anthropic/claude-haiku-5.5/),
 *   read Nov. 26, 2026: input $0.10, cached input $0.01, cache write $0.125,
 *   output $0.50 (short context).
 * - Claude Opus 5.5: Anthropic's pricing page
 *   (https://platform.claude.com/docs/en/about-claude/pricing), as cited in
 *   docs/source-watch.md: input $4, output $20. Its cached input ($0.40) and
 *   cache write ($5) are the project's own arithmetic from Anthropic's usual
 *   ratios (a tenth of input, and a quarter more than input), not a quoted price.
 */

export interface ModelPrice {
	input: number;
	cachedInput: number;
	cacheWrite: number;
	output: number;
}

export const modelPrices: Record<string, ModelPrice> = {
	'anthropic/claude-haiku-5.5': { input: 0.1, cachedInput: 0.01, cacheWrite: 0.125, output: 0.5 },
	'anthropic/claude-opus-5.5': { input: 4, cachedInput: 0.4, cacheWrite: 5, output: 20 }
};

export interface TokenUse {
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
}

/** What a call cost, in millionths of a dollar, or 0 for a model with no listed price. */
export function costMicrodollars(model: string, use: TokenUse): number {
	const price = modelPrices[model];
	if (!price) return 0;
	// Dollars per million tokens times tokens is microdollars.
	return Math.round(use.inputTokens * price.input + use.cacheReadTokens * price.cachedInput + use.cacheWriteTokens * price.cacheWrite + use.outputTokens * price.output);
}

export function dollars(microdollars: number): string {
	return `$${(microdollars / 1_000_000).toFixed(microdollars < 10_000 ? 4 : 2)}`;
}
