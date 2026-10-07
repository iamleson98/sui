/**
 * Popup dismissal + blur contract shared by the select family
 * (select, combobox, multi-select).
 *
 * Two UX rules the family follows:
 *
 * 1. **Peeking is not answering.** Pointer-dismissing the option list
 *    (outside click, overlay tap, sheet drag) — or cancelling it with
 *    Escape — must not run blur validation: the user looked at the
 *    options and walked away, they never committed to the field. The
 *    error reveal (and its focus-ring-looking `aria-invalid` styling)
 *    would read as a stuck focus state. Genuine blurs — tabbing away,
 *    focus leaving the popup, submit — validate as usual.
 * 2. **Opening is not leaving.** When the popup opens and takes focus
 *    (combobox search input, mobile sheet), the trigger's blur event is
 *    an internal focus move, not the user finishing with the field.
 *
 * The class records the *cause* of a dismissal with a timestamp, and the
 * components consult it in their blur / close handlers. Focus returning
 * to the trigger after a keyboard dismissal still happens (a11y
 * contract); only validation timing changes.
 */

/** Why the popup last closed: `pointer` (peeked with a pointer), `keyboard` (Escape), or unknown. */
export type SuiDismissCause = 'pointer' | 'keyboard';

/**
 * How long after a dismissal cause is recorded it still explains a
 * close/blur. Popup closes fire within one task of their trigger event;
 * the window also absorbs sheet-drag exit animations. Anything later is
 * an unrelated blur and validates normally.
 */
const DISMISS_GRACE_MS = 1000;

export class SuiPopupDismiss {
	#cause: SuiDismissCause | null = null;
	#at = 0;

	/**
	 * An outside pointer press dismissed (or began dismissing) the popup:
	 * `onInteractOutside`, or any pointer contact on a drag-to-dismiss
	 * sheet (options taps included — a selection validates on change, so
	 * skipping the close-side blur validation loses nothing).
	 */
	pointer(): void {
		this.#cause = 'pointer';
		this.#at = performance.now();
	}

	/** Escape dismissed the popup. */
	keyboard(): void {
		this.#cause = 'keyboard';
		this.#at = performance.now();
	}

	/** The popup (re)opened — a fresh interaction cycle. */
	open(): void {
		this.#cause = null;
		this.#at = 0;
	}

	/**
	 * The last recorded dismissal cause, when it happened within the
	 * grace window; `null` otherwise (no dismissal, or a stale one).
	 */
	cause(): SuiDismissCause | null {
		if (this.#cause !== null && performance.now() - this.#at <= DISMISS_GRACE_MS) {
			return this.#cause;
		}
		return null;
	}

	/**
	 * True when a dismissal means the user was only peeking — validation
	 * triggered by this close/blur should be skipped for now.
	 */
	shouldSkipValidation(): boolean {
		return this.cause() !== null;
	}

	/**
	 * True when a trigger blur event must NOT validate: focus merely
	 * moved into the control's own popup (`event.relatedTarget` is inside
	 * `content`), or the popup was just dismissed by an outside pointer
	 * press — the blur is an artifact of the popup cycle, not the user
	 * leaving the field. A pointer cause is consumed by the blur it
	 * explains, so a later genuine blur validates normally.
	 */
	shouldSwallowBlur(event: FocusEvent, content: HTMLElement | null): boolean {
		const to = event.relatedTarget;
		if (to instanceof Node && content !== null && content.contains(to)) return true;
		if (this.cause() === 'pointer') {
			this.#cause = null;
			this.#at = 0;
			return true;
		}
		return false;
	}
}
