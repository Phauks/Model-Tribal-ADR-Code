/**
 * A chart or table filling the screen (Trevor, Nov. 23, 2026): with the browser's own full screen where it has one, or filling the window where it has none (as on an iPhone) or refuses (as in a frame without permission). The component adds `class:filling-window` for the second case and styles it.
 */
export class FullScreen {
	/** The browser's own full screen is showing the element. */
	browserFullScreen = $state(false);
	/** The element fills the window by its own styles, in place of the browser's full screen. */
	fillingWindow = $state(false);
	readonly #element: () => HTMLElement | undefined;

	/** Takes the element to show full screen, as a function because it is bound after the component starts. */
	constructor(element: () => HTMLElement | undefined) {
		this.#element = element;
	}

	/** The element fills the screen either way. */
	get shown(): boolean {
		return this.browserFullScreen || this.fillingWindow;
	}

	/** Leaves full screen when it is shown, and enters it when it is not. */
	toggle = async (): Promise<void> => {
		if (this.shown) {
			if (document.fullscreenElement) await document.exitFullscreen();
			this.fillingWindow = false;
			return;
		}
		const element = this.#element();
		if (element?.requestFullscreen) {
			try {
				await element.requestFullscreen();
				return;
			} catch {
				// expected: refused: fill the window instead.
			}
		}
		this.fillingWindow = true;
	};

	/** Escape leaves the window. The browser's own full screen handles Escape itself. */
	leaveOnEscape(event: KeyboardEvent): void {
		if (this.fillingWindow && event.key === 'Escape') this.fillingWindow = false;
	}

	/** Follows the browser's full screen as it opens and closes; returns the function that stops. Call it from onMount. */
	follow(): () => void {
		const onChange = () => {
			this.browserFullScreen = document.fullscreenElement === this.#element();
		};
		document.addEventListener('fullscreenchange', onChange);
		return () => document.removeEventListener('fullscreenchange', onChange);
	}
}
