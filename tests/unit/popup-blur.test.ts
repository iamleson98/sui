import { describe, it, expect, vi } from 'vitest';
import { SuiPopupDismiss } from '$lib/sui/popup-blur.js';

function blurEvent(relatedTarget: Node | null): FocusEvent {
	return new FocusEvent('blur', { relatedTarget, bubbles: false });
}

describe('SuiPopupDismiss', () => {
	it('starts quiet — no dismissal cause recorded', () => {
		const guard = new SuiPopupDismiss();
		expect(guard.cause()).toBeNull();
		expect(guard.shouldSkipValidation()).toBe(false);
	});

	it('records a pointer cause within the grace window', () => {
		const guard = new SuiPopupDismiss();
		guard.pointer();
		expect(guard.cause()).toBe('pointer');
		expect(guard.shouldSkipValidation()).toBe(true);
	});

	it('records a keyboard cause and lets the last cause win', () => {
		const guard = new SuiPopupDismiss();
		guard.pointer();
		guard.keyboard();
		expect(guard.cause()).toBe('keyboard');
		// Escape dismissals skip close-side validation too, but unlike a
		// pointer dismissal they must not swallow a later trigger blur
		expect(guard.shouldSkipValidation()).toBe(true);
	});

	it('clears the cause when the popup reopens', () => {
		const guard = new SuiPopupDismiss();
		guard.pointer();
		guard.open();
		expect(guard.cause()).toBeNull();
	});

	it('expires a stale cause after the grace window', () => {
		const guard = new SuiPopupDismiss();
		guard.pointer();
		// simulate time passing beyond the 1s window
		const now = performance.now();
		const spy = vi.spyOn(performance, 'now').mockReturnValue(now + 10_000);
		try {
			expect(guard.cause()).toBeNull();
			expect(guard.shouldSkipValidation()).toBe(false);
		} finally {
			spy.mockRestore();
		}
	});

	it('swallows a blur whose focus moved into the control popup', () => {
		const guard = new SuiPopupDismiss();
		const content = document.createElement('div');
		const input = document.createElement('input');
		content.appendChild(input);

		expect(guard.shouldSwallowBlur(blurEvent(input), content)).toBe(true);
	});

	it('does not swallow a blur into an unrelated element', () => {
		const guard = new SuiPopupDismiss();
		const content = document.createElement('div');
		const elsewhere = document.createElement('input');

		expect(guard.shouldSwallowBlur(blurEvent(elsewhere), content)).toBe(false);
	});

	it('swallows a plain blur right after a pointer dismissal — and consumes the cause', () => {
		const guard = new SuiPopupDismiss();
		guard.pointer();
		const content = document.createElement('div');

		expect(guard.shouldSwallowBlur(blurEvent(null), content)).toBe(true);
		// one dismissal explains one blur — the next genuine blur validates
		expect(guard.shouldSwallowBlur(blurEvent(null), content)).toBe(false);
	});

	it('leaves a plain blur alone when no pointer dismissal happened', () => {
		const guard = new SuiPopupDismiss();
		const content = document.createElement('div');

		expect(guard.shouldSwallowBlur(blurEvent(null), content)).toBe(false);
	});
});
