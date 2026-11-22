// The sources a content record names, wherever in the record they are
// (used by a nation's sources download, src/routes/nations/[id]/sources.json).

/** Every source key a record names: a `source` or `…_source` field, or a `sources` list, at any depth. */
export function sourceKeys(value: unknown, found = new Set<string>()): Set<string> {
	if (Array.isArray(value)) {
		for (const item of value) sourceKeys(item, found);
	} else if (value && typeof value === 'object') {
		for (const [field, inner] of Object.entries(value)) {
			if ((field === 'source' || field.endsWith('_source')) && typeof inner === 'string') found.add(inner);
			else if (field === 'sources' && Array.isArray(inner)) {
				for (const key of inner) if (typeof key === 'string') found.add(key);
			} else sourceKeys(inner, found);
		}
	}
	return found;
}
