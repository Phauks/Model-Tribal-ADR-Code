/**
 * Checks on a new password before it is saved (site/COLLABORATION.md, "How
 * sign-in works"; NIST SP 800-63B-4, section 3.1.1.2).
 *
 * NIST asks sites to refuse passwords that are too short and passwords on a
 * blocklist: ones that have leaked in breaches, that are common, or that come
 * from the context, such as the site's name or the person's address. It asks
 * that "the entire password" be compared, "not substrings or words that might
 * be contained therein", and that no other rules be made about which kinds of
 * characters to mix.
 *
 * Leaked passwords are checked with Have I Been Pwned's Pwned Passwords range
 * service (haveibeenpwned.com/API/v3, "Searching by range"). Only the first
 * five characters of the password's SHA-1 hash leave the Worker, and the
 * answer is padded with made-up entries, so neither Have I Been Pwned nor
 * anyone watching learns the password or whether it was found. If the service
 * cannot be reached, the password is allowed and the miss is logged: a slow
 * outside service should not stop someone from choosing a password.
 */
import { passwordLength, passwordMaximumLength, passwordMinimumLength } from './sign-in-secrets.ts';

type Fetch = typeof fetch;

/** The address of the range service. */
export const pwnedPasswordsRange = 'https://api.pwnedpasswords.com/range/';

/** Letters and digits only, in lower case, for comparing a whole password with a blocked word. */
function bare(text: string): string {
	return text
		.normalize('NFKC')
		.toLocaleLowerCase('en-US')
		.replace(/[^\p{L}\p{N}]/gu, '');
}

/** Whole passwords refused because they come from this site, whatever their spacing or capitals. */
const siteWords = [
	'tribal law project',
	'triballawproject',
	'model tribal adr code',
	'tribal adr code',
	'model tribal code',
	'model tribal adr',
	'tribal dispute resolution',
	'alternative dispute resolution',
	'peacemaking code',
	'peacemaking peacemaking'
].map(bare);

async function sha1Hex(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0'))
		.join('')
		.toUpperCase();
}

/**
 * How many times Have I Been Pwned has seen this password in breaches: 0 if
 * never, or undefined if the service could not be asked.
 */
export async function timesBreached(password: string, fetcher: Fetch = fetch): Promise<number | undefined> {
	const hash = await sha1Hex(password.normalize('NFC'));
	const prefix = hash.slice(0, 5);
	const suffix = hash.slice(5);
	try {
		const response = await fetcher(`${pwnedPasswordsRange}${prefix}`, {
			headers: { 'add-padding': 'true', 'user-agent': 'model-tribal-adr-code-password-check' },
			signal: AbortSignal.timeout(4000)
		});
		if (!response.ok) throw new Error(`Pwned Passwords answered ${response.status}`);
		for (const line of (await response.text()).split('\n')) {
			const [lineSuffix, count] = line.trim().split(':');
			if (lineSuffix === suffix) return Number(count) || 0;
		}
		return 0;
	} catch (problem) {
		console.warn('Could not check a new password against Pwned Passwords', problem);
		return undefined;
	}
}

/** Why a new password cannot be used, or nothing if it can. */
export async function newPasswordProblem(password: string, email: string, fetcher: Fetch = fetch): Promise<string | undefined> {
	const length = passwordLength(password);
	if (length < passwordMinimumLength) {
		return `Use at least ${passwordMinimumLength} characters (this one has ${length}). Three or four unrelated words make a strong password that is easy to remember.`;
	}
	if (length > passwordMaximumLength) return `Use at most ${passwordMaximumLength} characters.`;

	const whole = bare(password);
	const address = email.trim();
	const blocked = [bare(address), bare(address.split('@')[0] ?? ''), ...siteWords].filter(Boolean);
	if (blocked.includes(whole)) {
		return 'Do not use your email address or the name of this site as your password. Choose something only you would think of.';
	}
	if (new Set([...whole]).size <= 2) {
		return 'Do not use one or two characters over and over. Three or four unrelated words work well.';
	}

	const seen = await timesBreached(password, fetcher);
	if (seen) {
		return 'This password has turned up in data breaches, so attackers try it early. Choose another one.';
	}
	return undefined;
}
