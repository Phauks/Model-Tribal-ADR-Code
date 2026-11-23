import { profileStatusLabels } from '#lib/contributors.ts';
import { emailChoiceLabels } from '#lib/following.ts';
import { accountSettingsCopy, signedInDevices } from '#lib/server/account-pages.ts';
import { profileBySubject } from '#lib/server/contributor-profiles.ts';
import { settingsFor } from '#lib/server/following.ts';
import { sponsorsManagedBy } from '#lib/server/sponsors.ts';
import { requireAccount, storage } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

/** One line about each Account page, so the overview says where things stand. */
export const load: PageServerLoad = async (event) => {
	const account = requireAccount(event);
	const { database } = storage(event);
	const [profile, devices, follow, settingsCopy, sponsorships] = await Promise.all([
		profileBySubject(database, account.subject),
		signedInDevices(database, account.subject, event.locals.session?.tokenHash),
		settingsFor(database, account.subject),
		accountSettingsCopy(database, account.subject),
		sponsorsManagedBy(database, account.subject)
	]);
	const hasPassword = event.locals.session?.account.hasPassword ?? false;
	return {
		summaries: {
			profile: profile
				? `${profileStatusLabels[profile.status]}.${profile.confirmedVersion ? ` Your credit uses version ${profile.confirmedVersion}.` : ''}${profile.hasUnconfirmedChanges ? ' You have changes to check and confirm.' : ''}`
				: 'Not started. Tell us about yourself if you would like to help write the code.',
			security: `${hasPassword ? 'Password set.' : 'No password; you sign in with a code.'} Signed in on ${devices.length} ${devices.length === 1 ? 'device' : 'devices'}.`,
			email: emailChoiceLabels[follow.email] + '.',
			sponsorship:
				sponsorships.length === 0
					? 'For organizations that give to the project.'
					: `You manage ${sponsorships.map((sponsor) => sponsor.name).join(', ')}.`,
			data: 'Download a copy of what the project keeps about you, or delete your account.'
		},
		settingsEverywhere: Boolean(settingsCopy)
	};
};
