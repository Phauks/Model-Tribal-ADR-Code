/**
 * What the masthead knows about following (site/DESIGN.md, section 6,
 * "Follow"): whether the reader follows the page they are on, and how many
 * updates they have not seen. Pages are built ahead of time, so the browser
 * asks the Worker (/following/state) once per page, and only when the
 * signed-in hint says someone is signed in (src/lib/signed-in-hint.ts). The
 * Follow button and the account button share this one answer.
 */
import { readFollowState, signedOutState, type FollowState } from './following.ts';
import { readSignedInHint } from './signed-in-hint.ts';
import { sendProblem } from './problem-reports.ts';

class FollowingState {
	/** The page the current answer is about. */
	address = $state('');
	current = $state<FollowState>(signedOutState);
	/** True while the first answer for a page is on its way. */
	loading = $state(false);
	private asked = '';

	/** Asks the Worker about a page, once per address. Signed-out readers ask nothing. */
	async refresh(address: string): Promise<void> {
		if (address === this.asked) return;
		this.asked = address;
		this.address = address;
		if (!readSignedInHint(document.cookie).signedIn) {
			this.current = signedOutState;
			return;
		}
		this.loading = true;
		try {
			const response = await fetch(`/following/state?address=${encodeURIComponent(address)}`, {
				headers: { accept: 'application/json' },
				cache: 'no-store'
			});
			const answer = response.ok ? readFollowState(await response.json()) : signedOutState;
			if (this.asked === address) this.current = answer;
		} catch (problem) {
			// Show the page as for a signed-out reader; offline is only noted (sendProblem).
			sendProblem(problem, { code: 'following.state' });
			if (this.asked === address) this.current = signedOutState;
		} finally {
			if (this.asked === address) this.loading = false;
		}
	}

	/** Follows or stops following a page. Returns a problem to show, or undefined. */
	async set(address: string, follow: boolean): Promise<string | undefined> {
		try {
			const response = await fetch('/following/state', {
				method: 'POST',
				headers: { 'content-type': 'application/json', accept: 'application/json' },
				body: JSON.stringify({ address, follow })
			});
			if (response.status === 401) {
				this.current = signedOutState;
				return 'Your sign-in has ended. Sign in again to follow pages.';
			}
			if (!response.ok) return (await response.text()).slice(0, 200) || 'The page could not be followed. Try again.';
			this.current = readFollowState(await response.json());
			return undefined;
		} catch {
			// expected: the reader is shown that the site could not be reached.
			return 'The site could not be reached. Check the connection and try again.';
		}
	}

	/** Forgets the answer, so the next page asks again (after signing in or out). */
	reset(): void {
		this.asked = '';
	}
}

export const followingState = new FollowingState();
