/**
 * Makes a profile picture in the browser (docs/contributor-profiles.md,
 * "Profile pictures"): cropped to a square from its middle and drawn again as
 * a JPEG, so the original photo, with its camera details and location, never
 * leaves the device. Without scripts the file is sent as it is, and the
 * server accepts it only if it is a small JPEG.
 */

/** Whether this browser can make the picture before it is sent. */
export function canSquarePictures(): boolean {
	return typeof createImageBitmap === 'function' && typeof DataTransfer === 'function';
}

/** The picture as a square JPEG of the given side, or null when the file cannot be opened as a picture. */
export async function squarePicture(file: File, side: number): Promise<File | null> {
	try {
		// Browsers turn the picture the right way up from its camera details here.
		const bitmap = await createImageBitmap(file);
		const crop = Math.min(bitmap.width, bitmap.height);
		const canvas = document.createElement('canvas');
		canvas.width = side;
		canvas.height = side;
		const context = canvas.getContext('2d');
		if (!context) return null;
		// A transparent picture gets a white background, as a JPEG cannot be transparent.
		context.fillStyle = 'white';
		context.fillRect(0, 0, side, side);
		context.imageSmoothingQuality = 'high';
		context.drawImage(bitmap, (bitmap.width - crop) / 2, (bitmap.height - crop) / 2, crop, crop, 0, 0, side, side);
		bitmap.close();
		const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
		return blob ? new File([blob], 'picture.jpg', { type: 'image/jpeg' }) : null;
	} catch {
		return null;
	}
}
