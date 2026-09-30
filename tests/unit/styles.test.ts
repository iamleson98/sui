import { describe, expect, it } from 'vitest';
import {
	SUI_CONTROL,
	SUI_SQUARE,
	SUI_ICON,
	SUI_LABEL,
	SUI_TEXTAREA,
	SUI_FIELD_CONTROL,
	SUI_FIELD_TRIGGER,
	SUI_FIELD_TEXT,
	SUI_CLEAR_PE,
	SUI_CLEAR_END,
	SUI_CLEAR_SIZE,
	SUI_CHEVRON_PIN,
	suiEffectiveVariant
} from '$lib/sui/styles';
import type { SuiFieldVariant, SuiSize } from '$lib/sui/types';

const SIZES: SuiSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];
const VARIANTS: SuiFieldVariant[] = ['info', 'success', 'warning', 'error'];

describe('SUI size maps', () => {
	it('every size has a control class with a height utility', () => {
		for (const size of SIZES) {
			expect(SUI_CONTROL[size]).toMatch(new RegExp(`\\bh-${{ xs: 6, sm: 8, md: 9, lg: 10, xl: 12 }[size]}\\b`));
		}
	});

	it('every size has padding and text utilities', () => {
		for (const size of SIZES) {
			expect(SUI_CONTROL[size]).toMatch(/px-\S+/);
			expect(SUI_CONTROL[size]).toMatch(/text-\S+/);
		}
	});

	it('square sizes match control heights', () => {
		for (const size of SIZES) {
			const height = SUI_CONTROL[size].match(/\bh-(\d+)\b/)![1];
			expect(SUI_SQUARE[size]).toBe(`size-${height}`);
		}
	});

	it('every size has icon, label and field classes', () => {
		for (const size of SIZES) {
			expect(SUI_ICON[size]).toBeTruthy();
			expect(SUI_LABEL[size]).toBeTruthy();
		}
	});
});

describe('SUI field variant maps', () => {
	it('defines control + text classes for every variant', () => {
		for (const variant of VARIANTS) {
			expect(SUI_FIELD_CONTROL[variant]).toMatch(/border-/);
			expect(SUI_FIELD_CONTROL[variant]).toMatch(/focus-within:ring-/);
			expect(SUI_FIELD_TEXT[variant]).toMatch(/text-/);
		}
	});

	it('info maps to blue, success to green, warning to amber, error to red', () => {
		expect(SUI_FIELD_CONTROL.info).toContain('blue');
		expect(SUI_FIELD_CONTROL.success).toContain('green');
		expect(SUI_FIELD_CONTROL.warning).toContain('amber');
		expect(SUI_FIELD_CONTROL.error).toContain('red');
	});
});

describe('SUI_FIELD_TRIGGER (button-like triggers)', () => {
	it('drives the focused look with focus-visible, not focus-within', () => {
		// triggers receive DOM focus back from bits-ui on close — only
		// keyboard focus may paint the focused look
		for (const variant of VARIANTS) {
			expect(SUI_FIELD_TRIGGER[variant]).toMatch(/focus-visible:border-/);
			expect(SUI_FIELD_TRIGGER[variant]).toMatch(/focus-visible:ring-/);
			expect(SUI_FIELD_TRIGGER[variant]).not.toMatch(/focus-within:/);
		}
	});

	it('keeps the same hues as the input variants', () => {
		expect(SUI_FIELD_TRIGGER.info).toContain('blue');
		expect(SUI_FIELD_TRIGGER.success).toContain('green');
		expect(SUI_FIELD_TRIGGER.warning).toContain('amber');
		expect(SUI_FIELD_TRIGGER.error).toContain('red');
	});
});

describe('SUI_TEXTAREA (multi-line wrapper metrics)', () => {
	it('never fixes the wrapper height — rows drive it', () => {
		for (const size of SIZES) {
			expect(SUI_TEXTAREA[size]).not.toMatch(/\bh-\d/);
			expect(SUI_TEXTAREA[size]).not.toMatch(/\bmin-h-\d/);
		}
	});

	it('adds no horizontal padding — the inner textarea owns it', () => {
		for (const size of SIZES) {
			expect(SUI_TEXTAREA[size]).not.toMatch(/\bp[se]-\S+/);
		}
	});
});

describe('SUI clear-button geometry', () => {
	it('positions the clear overlay left of the pinned chevron', () => {
		for (const size of SIZES) {
			// ✕ sits at 28px from the end edge for every size
			expect(SUI_CLEAR_END[size]).toBe('end-7');
		}
	});

	it('reserves enough end padding for ✕ + chevron on every size', () => {
		const reserve = { xs: 52, sm: 52, md: 56, lg: 56, xl: 56 } as Record<SuiSize, number>;
		for (const size of SIZES) {
			const pe = Number(SUI_CLEAR_PE[size].match(/pe-(\d+)/)![1]) * 4;
			const clear = Number(SUI_CLEAR_SIZE[size].match(/size-(\d+)/)![1]) * 4;
			// clear (20–24) + gap (4) + chevron (16) + gap (4) must fit
			expect(pe).toBeGreaterThanOrEqual(clear + 4 + 16 + 4);
			expect(pe).toBe(reserve[size]);
		}
	});

	it('pins the chevron to the trigger end edge while the overlay is visible', () => {
		expect(SUI_CHEVRON_PIN).toContain('[&>svg:last-of-type]:absolute');
		expect(SUI_CHEVRON_PIN).toContain('[&>svg:last-of-type]:end-2');
		expect(SUI_CHEVRON_PIN).toContain('[&>svg:last-of-type]:-translate-y-1/2');
	});
});

describe('suiEffectiveVariant', () => {
	it('returns the configured variant without errors', () => {
		expect(suiEffectiveVariant('success', [])).toBe('success');
		expect(suiEffectiveVariant('success', undefined)).toBe('success');
	});

	it('errors force the error variant regardless of configuration', () => {
		expect(suiEffectiveVariant('info', ['Required'])).toBe('error');
		expect(suiEffectiveVariant('success', ['a', 'b'])).toBe('error');
	});
});
