import { browser } from '$app/environment';

/**
 * App-wide theme state, shared by the demo-site header, the showcase
 * topbar and the sonner toaster.
 *
 * - persisted to `localStorage` under `sui-theme`
 * - falls back to the OS preference when nothing is stored
 * - the pre-hydration bootstrap script in `app.html` applies the class
 *   before first paint, this store takes over once hydrated.
 */
class ThemeStore {
	dark = $state(false);

	constructor() {
		if (browser) {
			const stored = localStorage.getItem('sui-theme');
			this.dark = stored
				? stored === 'dark'
				: window.matchMedia('(prefers-color-scheme: dark)').matches;
		}
	}

	toggle() {
		this.dark = !this.dark;
		if (browser) localStorage.setItem('sui-theme', this.dark ? 'dark' : 'light');
	}
}

export const theme = new ThemeStore();
