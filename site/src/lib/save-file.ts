/**
 * Saves a file made in the browser to the reader's device under a name, as a download: a link to the file's contents is added, clicked and taken away again.
 *
 * The link goes in `within`, the page's body by default; inside an open dialog, pass the dialog, since the page behind it is inert. The file's temporary address is let go ten seconds later, once the browser has started the download.
 */
export function saveFile(contents: Blob, fileName: string, within: Element = document.body): void {
	const address = URL.createObjectURL(contents);
	const link = document.createElement('a');
	link.href = address;
	link.download = fileName;
	within.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(address), 10_000);
}
