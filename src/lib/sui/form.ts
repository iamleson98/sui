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
 *
 * ```svelte
 * <form
 *   onsubmit={(e) => {
 *     e.preventDefault();
 *     if (!validateAll()) { await tick(); focusFirstInvalid(e.currentTarget); }
 *   }}
 * />
 * ```
 */
export function focusFirstInvalid(root: ParentNode): boolean {
        const candidates = root.querySelectorAll<HTMLElement>(
                'input, textarea, select, button, [role="combobox"]'
        );
        for (const el of candidates) {
                if (!el.closest('[data-invalid]')) continue;
                if (el.matches(':disabled, [aria-disabled="true"], [type="hidden"]')) continue;
                el.focus();
                return true;
        }
        return false;
}
