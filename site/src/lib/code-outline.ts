/**
 * The shapes of a code's outline as pages and the side column show it: Title
 * 25 of the United States Code today, and meant for 25 C.F.R. and the model
 * codes later (Trevor chose on Nov. 27, 2026 to browse Title 25 with its
 * outline in the side column, design/title-25-navigation, option A, and said
 * its structure may become the basis for the model codes' navigation).
 *
 * Plain types only: shared by the server (src/lib/server/code-outline.ts),
 * the pages and the side column.
 */

/** Where a section stands in the current edition. */
export type SectionStatus = 'in force' | 'repealed' | 'moved' | 'omitted' | 'renumbered' | 'vacant' | 'reserved';

/** The word a status shows as, on a label that does not rely on color. */
export const statusLabels: Record<SectionStatus, string> = {
	'in force': 'In force',
	repealed: 'Repealed',
	moved: 'Moved',
	omitted: 'Omitted',
	renumbered: 'Renumbered',
	vacant: 'Vacant',
	reserved: 'Reserved'
};

/** One row of a code's outline in the side column: a subchapter that folds, or a section. */
export interface CodeTreeItem {
	/** "§ 5321", "§§ 212–228", "Subchapter I" */
	number: string;
	/** The section's heading, or the subchapter's name; for a run no longer in force, its status. */
	label: string;
	link?: string;
	/** Not in force: shown quieter. */
	gone?: boolean;
	/** The page being read. */
	current?: boolean;
	/** For a subchapter or part: how many of its sections are in force. */
	count?: number;
	/** For a subchapter or part: open when the page is in it. */
	open?: boolean;
	children?: CodeTreeItem[];
}

/** The outline the side column shows in place of a family's flat pages. */
export interface CodeTree {
	/** The box at the top that finds a section by number or words. */
	find: { label: string; link: string };
	items: CodeTreeItem[];
}

/** The page before or after, for the previous and next links. */
export interface Neighbor {
	/** "§ 5310", "Chapter 5" */
	number: string;
	heading: string;
	link: string;
}

/** One row of a chapter's contents on its page, under its subchapter or part. */
export interface ContentsRow {
	label: string;
	heading: string;
	link?: string;
	status: SectionStatus;
	/** The law that repealed it, where it moved, or why it was omitted, in the Code's own words. */
	note?: string;
	movedTo?: { label: string; link?: string };
}

export interface ContentsGroup {
	/** "Subchapter I", "Part A"; empty for the sections before the first subchapter. */
	label: string;
	heading: string;
	/** Its anchor on the chapter's page. */
	anchor?: string;
	inForce: number;
	/** A part within a subchapter: shown one step in. */
	part?: boolean;
	rows: ContentsRow[];
}
