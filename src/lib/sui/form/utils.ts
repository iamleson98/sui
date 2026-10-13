import { tick } from 'svelte';

/**
 * Form-level helpers for the submit path.
 *
 * WCAG 3.3.1 / VA.gov pattern: when a submit fails validation, move focus
 * to the first invalid control so keyboard and screen-reader users land
 * on the problem instead of having to hunt for it.
 */

/**
 * Moves focus to the first focusable control inside an invalid sui field
 * (`[data-invalid]`). Works for every sui form control: the attribute sits
 * on the control wrapper (input, textarea), the trigger (select, combobox,
 * multi-select) or the field root (checkbox, radio group) — the first
 * focusable descendant wins.
 *
 * Returns `true` when a target was found and focused.
 *
 * Call AFTER the DOM has settled — in a submit handler, `await tick()`
 * between updating error state and calling this, so the fresh
 * `data-invalid` attributes are painted.
 */
export function focusFirstInvalid(root: ParentNode): boolean {
	// segmented date/time fields focus through their first segment
	// (`role="spinbutton"`), which precedes their calendar / clock button
	const candidates = root.querySelectorAll<HTMLElement>(
		'input, textarea, select, button, [role="combobox"], [role="spinbutton"]'
	);
	for (const el of candidates) {
		if (!el.closest('[data-invalid]')) continue;
		if (el.matches(':disabled, [aria-disabled="true"], [type="hidden"]')) continue;
		el.focus();
		return true;
	}
	return false;
}

/** The slice of a form instance the failed-submit focus logic reads. */
type FocusableForm = {
	focusOnSubmit: 'summary' | 'field' | 'none';
	errorSummary: { fieldId: string }[];
};

/**
 * Where focus lands after a failed submit (GOV.UK pattern), shared by
 * `<SuiForm>` and `suiEnhance`:
 *
 * 1. the error summary box (when rendered) — announcing the whole list;
 * 2. the form-error banner (when no field is invalid but it has content);
 * 3. the first invalid control — focused on desktop, scrolled to on touch
 *    devices, where focus would open the keyboard and hide the message.
 *
 * Honors `focusOnSubmit: 'field' | 'none'`.
 */
export async function focusFailedSubmit(
	formEl: HTMLFormElement,
	form: FocusableForm
): Promise<void> {
	if (form.focusOnSubmit === 'none') return;
	// let the DOM settle so fresh data-invalid attributes are painted
	await tick();
	const mobile = typeof matchMedia !== 'undefined' && matchMedia('(max-width: 639px)').matches;
	if (form.focusOnSubmit === 'summary') {
		let target: HTMLElement | null = formEl.querySelector('[data-sui-error-summary]');
		if (!target && form.errorSummary.length === 0) {
			const banner = formEl.querySelector<HTMLElement>('[data-sui-form-errors]');
			if (banner && (banner.textContent ?? '').trim().length > 0) target = banner;
		}
		if (target) {
			// focusing the box announces the whole problem list (a div with
			// tabindex="-1" opens no on-screen keyboard, so this is touch-safe)
			target.focus();
			if (mobile) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
			return;
		}
	}
	if (mobile) {
		formEl.querySelector('[data-invalid]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
	} else {
		focusFirstInvalid(formEl);
	}
}
