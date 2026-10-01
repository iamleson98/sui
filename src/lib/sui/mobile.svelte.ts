import { MediaQuery } from 'svelte/reactivity';

/**
 * Viewport width below which the select family renders its options in a
 * bottom-sheet drawer instead of an anchored popover — the platform-native
 * picker pattern on phones (thumb reach, no mid-screen floating panels).
 */
export const SUI_MOBILE_QUERY = '(max-width: 639px)';

/**
 * SSR-safe mobile check: `matches` is `false` during SSR/prerender (the
 * popover branch renders to HTML), then flips live on the client as the
 * viewport crosses the breakpoint — no hydration mismatch, no layout shift.
 */
export function suiMobileQuery(): MediaQuery {
	return new MediaQuery(SUI_MOBILE_QUERY);
}
