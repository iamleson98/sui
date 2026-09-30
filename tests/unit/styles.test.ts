import { describe, expect, it } from 'vitest';
import {
	SUI_CONTROL,
	SUI_SQUARE,
	SUI_ICON,
	SUI_LABEL,
	SUI_FIELD_CONTROL,
	SUI_FIELD_TEXT,
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
