/**
 * The live editing Worker, tribal-law-project-live: it holds the
 * EssayRoom Durable Objects (src/lib/server/live/essay-room.ts) and nothing
 * else. It has no public address; the website reaches the rooms through its
 * essayRooms binding (wrangler.jsonc in the folder above), after checking
 * who is connecting.
 */
export { EssayRoom } from '../src/lib/server/live/essay-room.ts';

export default {
	async fetch(): Promise<Response> {
		return new Response('Nothing is served here. Live editing opens from the website’s workspace.', {
			status: 404,
			headers: { 'content-type': 'text/plain; charset=utf-8' }
		});
	}
};
