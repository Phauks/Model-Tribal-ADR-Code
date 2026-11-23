/**
 * Turns a provider's facts (scan-port.ts) into the project's verdict on a
 * file: clean, flagged, or could not be scanned. The order of the checks
 * below is the policy; keep it.
 *
 * Adapted, with Trevor Goldsmith's permission as its owner, from his Magna
 * Carta repository (packages/file-manager/src/verdict.ts), with one project
 * policy instead of one per firm.
 */
import { ScanFaultError, type RawScanResult, type RuleMatch, type RuleTier } from './scan-port.ts';

export interface ScanPolicy {
	/** The broadest YARA tier whose matches count. */
	tier: RuleTier;
	/** A "suspicious" rule counts only at or above this score (0 to 100). */
	suspiciousScoreFloor: number;
}

/** The same defaults Magna Carta uses: the extended tier, suspicious rules from 75. */
export const projectScanPolicy: ScanPolicy = { tier: 'extended', suspiciousScoreFloor: 75 };

export type FileVerdict =
	| { verdict: 'clean'; activeContent: boolean }
	| { verdict: 'flagged'; reason: string }
	| { verdict: 'cannot-scan'; reason: 'encrypted' | 'limits-exceeded' | 'no-engine' };

function tierRank(tier: RuleTier): number {
	return tier === 'core' ? 0 : tier === 'extended' ? 1 : 2;
}

/** Whether a YARA match counts under the policy. */
export function matchCounts(match: RuleMatch, policy: ScanPolicy): boolean {
	if (tierRank(match.tier) > tierRank(policy.tier)) return false;
	return !match.isSuspicious || match.score >= policy.suspiciousScoreFloor;
}

/**
 * In order:
 * 1. ClamAV found a signature: flagged, with the signature's name. ClamAV's
 *    own "Heuristics.Limits.Exceeded" alerts are the exception: they mean it
 *    stopped before the end of a very large or deeply packed file. Unless a
 *    check below flags it, such a file could not be checked: held, but not
 *    called a virus.
 * 2. A YARA rule that counts matched: flagged, with the rule's name.
 * 3. The archive is built to attack a scanner (a zip bomb, deep nesting,
 *    too many entries): flagged.
 * 4. Locked with a password: cannot be scanned, so it stays held.
 * 5. ClamAV could not answer: no engine at all is "cannot scan"; an engine
 *    that is there but did not answer throws ScanFaultError to try again.
 * 6. Otherwise clean, noting active content (PDF scripts, Office macros).
 */
export function computeVerdict(raw: RawScanResult, policy: ScanPolicy = projectScanPolicy): FileVerdict {
	const stoppedAtLimits = raw.clam.state === 'infected' && raw.clam.signature.startsWith('Heuristics.Limits.Exceeded');
	if (raw.clam.state === 'infected' && !stoppedAtLimits) return { verdict: 'flagged', reason: raw.clam.signature };

	const counting = raw.matches.find((match) => matchCounts(match, policy));
	if (counting) return { verdict: 'flagged', reason: counting.ruleId };

	if (raw.heuristic.kind === 'structural') return { verdict: 'flagged', reason: raw.heuristic.reason };

	if (stoppedAtLimits) return { verdict: 'cannot-scan', reason: 'limits-exceeded' };

	if (raw.heuristic.kind === 'encrypted') return { verdict: 'cannot-scan', reason: 'encrypted' };

	if (raw.clam.state === 'unavailable') {
		if (raw.engineVersion === null) return { verdict: 'cannot-scan', reason: 'no-engine' };
		throw new ScanFaultError('The scan engine is running but ClamAV did not answer; trying again later.');
	}

	return { verdict: 'clean', activeContent: raw.heuristic.kind === 'active-content' };
}
