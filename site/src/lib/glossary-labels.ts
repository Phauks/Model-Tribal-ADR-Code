// Words shown for glossary record values (schemas/glossary.schema.json).

export const usageLabels: Record<string, string> = {
	preferred: 'Preferred',
	acceptable: 'Acceptable',
	'context-only': 'Only in context',
	avoid: 'Avoid in the project’s own voice'
};

export const basisLabels: Record<string, string> = {
	source: 'Restates its sources',
	'project-analysis': 'The project’s own choice',
	'source-and-project-analysis': 'Its sources and the project’s own choice'
};

export const statusLabels: Record<string, string> = {
	draft: 'Draft',
	adopted: 'Adopted',
	retired: 'Retired'
};
