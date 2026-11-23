/**
 * The malware-scanning seam (site/SCANNING.md). A scanning provider looks at
 * a file's bytes and reports what it found as plain facts; the project's own
 * policy (verdict.ts) turns those facts into clean, flagged or "could not
 * scan". So the provider can be swapped (providers.ts) without changing what
 * any caller does with the answer.
 *
 * Adapted, with Trevor Goldsmith's permission as its owner, from the scan
 * port in his Magna Carta repository (packages/file-manager/src/scan-port.ts).
 */

/** How broad a YARA rule set is, from the YARA Forge packages: core is the narrowest. */
export type RuleTier = 'core' | 'extended' | 'full';

/** One YARA rule that matched, with what the project's policy needs to weigh it. */
export interface RuleMatch {
	ruleId: string;
	tier: RuleTier;
	score: number;
	/** A heuristic "suspicious" rule, which counts only at or above the policy's score floor. */
	isSuspicious: boolean;
}

/** The structural reasons the engine can give for flagging an archive. */
export const structuralReasons = ['decompression-bomb', 'archive-nesting', 'archive-entry-count'] as const;
export type StructuralReason = (typeof structuralReasons)[number];

/**
 * What a provider found, as facts and not a verdict. The scan engine in
 * site/scanner/engine returns exactly this JSON (src/raw.rs there).
 */
export interface RawScanResult {
	/** Which engine, rules and signatures looked, or null when there is no engine. */
	engineVersion: string | null;
	/** ClamAV: no signature matched, one did (named), or ClamAV could not answer. */
	clam: { state: 'clean' } | { state: 'infected'; signature: string } | { state: 'unavailable' };
	/** The engine's own look at the file's structure. */
	heuristic:
		| { kind: 'none' }
		| { kind: 'structural'; reason: StructuralReason }
		| { kind: 'encrypted' }
		| { kind: 'active-content' };
	matches: RuleMatch[];
	timings: { clamdMs: number; yaraMs: number };
}

export interface ScanRequestFacts {
	sizeBytes: number;
	/** The type found from the file's first bytes, when the caller knows it. */
	mediaType: string | null;
}

/** A scanning provider: reads the whole body and reports what it found. */
export interface ScanProvider {
	/** A short name kept with each result, such as "container" or "http". */
	readonly name: string;
	/** Throws ScanFaultError when no scan happened and trying again later may work. */
	scan(body: ReadableStream<Uint8Array>, facts: ScanRequestFacts): Promise<RawScanResult>;
}

/**
 * No scan happened and none can right now: the engine is asleep, down or
 * still starting. The file stays held and is tried again later. Never read
 * as clean.
 */
export class ScanFaultError extends Error {
	override readonly name = 'ScanFaultError';
}

/**
 * Checks a provider's answer against the shape above. Anything else is a
 * fault (tried again later), never a made-up result.
 */
export function readRawScanResult(value: unknown): RawScanResult {
	const fail = (what: string): never => {
		throw new ScanFaultError(`The scanning provider sent an answer this site cannot read (${what}).`);
	};
	if (!isRecord(value)) return fail('not an object');
	const { engineVersion, clam, heuristic, matches, timings } = value;
	if (engineVersion !== null && typeof engineVersion !== 'string') fail('engineVersion');

	if (!isRecord(clam)) return fail('clam');
	let clamFact: RawScanResult['clam'];
	if (clam.state === 'clean' || clam.state === 'unavailable') clamFact = { state: clam.state };
	else if (clam.state === 'infected' && typeof clam.signature === 'string' && clam.signature !== '') {
		clamFact = { state: 'infected', signature: clam.signature };
	} else return fail('clam.state');

	if (!isRecord(heuristic)) return fail('heuristic');
	let heuristicFact: RawScanResult['heuristic'];
	if (heuristic.kind === 'none' || heuristic.kind === 'encrypted' || heuristic.kind === 'active-content') {
		heuristicFact = { kind: heuristic.kind };
	} else if (heuristic.kind === 'structural' && structuralReasons.includes(heuristic.reason as StructuralReason)) {
		heuristicFact = { kind: 'structural', reason: heuristic.reason as StructuralReason };
	} else return fail('heuristic.kind');

	if (!Array.isArray(matches)) return fail('matches');
	const ruleMatches = matches.map((match): RuleMatch => {
		if (
			!isRecord(match) ||
			typeof match.ruleId !== 'string' ||
			(match.tier !== 'core' && match.tier !== 'extended' && match.tier !== 'full') ||
			typeof match.score !== 'number' ||
			typeof match.isSuspicious !== 'boolean'
		) {
			return fail('matches[]');
		}
		return { ruleId: match.ruleId, tier: match.tier, score: match.score, isSuspicious: match.isSuspicious };
	});

	if (!isRecord(timings) || typeof timings.clamdMs !== 'number' || typeof timings.yaraMs !== 'number') {
		return fail('timings');
	}
	return {
		engineVersion: (engineVersion as string | null) ?? null,
		clam: clamFact,
		heuristic: heuristicFact,
		matches: ruleMatches,
		timings: { clamdMs: timings.clamdMs, yaraMs: timings.yaraMs }
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
