/**
 * What one item of a collection holds as copies on this site, for its row in the collection's list (Trevor, Nov. 27,
 * 2026: "in statistics, we should denote documents and pages separately"): documents (PDFs, plain text, pictures), the
 * pages in those documents, and saved web pages. Pages are counted in PDFs (research/copy-pages.csv, written by
 * scripts/library/count_pages.py), as a saved web page or a text file has no printed pages.
 */
export interface Holding {
	documents: number;
	pages: number;
	webPages: number;
}
