import { describe, expect, it } from 'vitest';
import { SUI_MOBILE_QUERY, suiMobileQuery } from '$lib/sui';

describe('suiMobileQuery', () => {
	it('targets phones but not tablets/desktop (below the sm breakpoint)', () => {
		// 639px = Tailwind's sm minus one pixel — matches the max-width:639px
		// breakpoint the select family uses to switch to bottom sheets
		expect(SUI_MOBILE_QUERY).toBe('(max-width: 639px)');
	});

	it('starts false (desktop/popover branch) and is SSR-safe', () => {
		// the test setup polyfills matchMedia with matches: false — the same
		// default the server render sees before hydration
		const query = suiMobileQuery();
		expect(query.current).toBe(false);
	});
});
