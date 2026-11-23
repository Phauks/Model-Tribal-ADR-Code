/**
 * Nation names by page identifier, read in the browser from the list built
 * with the site (src/routes/nations/previews.json), for pages the Worker
 * renders, which do not carry the list themselves.
 */
let names: Promise<Map<string, string>> | undefined;

export function nationNames(): Promise<Map<string, string>> {
	names ??= fetch('/nations/previews.json')
		.then((response) => response.json() as Promise<{ nations: { id: string; name: string }[] }>)
		.then((list) => new Map(list.nations.map((nation) => [nation.id, nation.name])))
		.catch(() => {
			names = undefined;
			return new Map<string, string>();
		});
	return names;
}
