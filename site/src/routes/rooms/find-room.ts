import { error } from '@sveltejs/kit';
import { can } from '#lib/permissions.ts';
import { isRoomIdentifier } from '#lib/video-rooms.ts';
import type { SignedInAccount } from '#lib/server/contributor-profiles.ts';
import type { SignedInPerson } from '#lib/server/people.ts';
import { roomByIdentifier, type StandaloneRoom, isStandalone } from '#lib/server/video-rooms.ts';
import type { D1Database } from '@cloudflare/workers-types/index.ts';

/**
 * A room of its own at this address. An event's room lives on the event's
 * page instead, so its address here answers "not found".
 */
export async function findRoom(database: D1Database, identifier: string): Promise<StandaloneRoom> {
	const room = isRoomIdentifier(identifier) ? await roomByIdentifier(database, identifier) : undefined;
	if (!room || !isStandalone(room)) error(404, 'There is no room at this address.');
	return room;
}

/**
 * Whether this person hosts this room: the people who run events host every
 * room, and whoever made a room hosts it while they may still start rooms.
 */
export function hostsRoom(room: Pick<StandaloneRoom, 'createdBy'>, person: SignedInPerson | undefined, account: SignedInAccount | undefined): boolean {
	if (!person) return false;
	if (can(person, 'manage-events')) return true;
	return Boolean(account && room.createdBy === account.subject && can(person, 'host-video-rooms'));
}
