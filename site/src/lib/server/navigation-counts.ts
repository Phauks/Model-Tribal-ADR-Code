/**
 * The counts beside the links in the section menus (src/lib/site-navigation.ts):
 * each collection's count from the Statistics page's registry
 * (src/lib/server/collections.ts), worked out once while the site is built,
 * plus the directory's courts by kind and the Gaming Commission's final
 * decisions, which the Courts and Cases menu links to on their own.
 * The Worker never counts: pages it renders show the menus without counts.
 */
import { collectionCounts, gamingCommissionFinalDecisionCount } from './collections.ts';
import { courtListings } from './courts.ts';
import { courtKindGroups, type NavigationCounts } from '../site-navigation.ts';

let counted: NavigationCounts | undefined;

export function navigationCounts(): NavigationCounts {
	if (counted) return counted;
	const kinds = courtListings().map((court) => court.kind);
	counted = {
		...Object.fromEntries(collectionCounts().map((collection) => [collection.identifier, collection.count])),
		...Object.fromEntries(Object.entries(courtKindGroups).map(([key, wanted]) => [key, kinds.filter((kind) => wanted.includes(kind)).length])),
		'gaming-commission-final-decisions': gamingCommissionFinalDecisionCount()
	};
	return counted;
}
