// Words shown for glossary record values (schemas/glossary.schema.json).

export const usageLabels: Record<string, string> = {
	preferred: 'Preferred',
	acceptable: 'Acceptable',
	'context-only': 'Only in context',
	avoid: 'Avoid in this work’s own voice'
};

export const basisLabels: Record<string, string> = {
	source: 'Restates its sources',
	'project-analysis': 'Our own choice',
	'source-and-project-analysis': 'Its sources and our own choice'
};

export const statusLabels: Record<string, string> = {
	draft: 'Draft',
	adopted: 'Adopted',
	retired: 'Retired'
};
