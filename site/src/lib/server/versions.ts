import { buildCommit } from 'virtual:build';
import contentVersion from '../../../../content/version.txt?raw';
import siteVersion from '../../../version.txt?raw';
import printVersion from '../../../../pdf/version.txt?raw';

export interface TrackVersions {
	content: string;
	site: string;
	print: string;
}

/**
 * The three version numbers are bundled into the Worker at build time, so
 * pages the Worker renders on request, such as "Page not found", the request
 * form and the co-author workspace, show them without reading files.
 */
export function trackVersions(): TrackVersions {
	return {
		content: contentVersion.trim(),
		site: siteVersion.trim(),
		print: printVersion.trim()
	};
}

/**
 * The version a review approves: the content version, and the commit the
 * site was built from when Workers Builds built it.
 */
export function reviewedVersion(): string {
	const content = `content ${trackVersions().content}`;
	return buildCommit ? `${content}, commit ${buildCommit.slice(0, 12)}` : content;
}
