/**
 * bits-ui date/time segments are driven by `keydown`: each digit updates
 * the focused segment and auto-advances. Text that arrives WITHOUT usable
 * key presses would otherwise be lost or corrupt the segment:
 *
 * - pastes and multi-character inserts (IME commits, autofill, assistive
 *   tech, automation) — bits-ui lets those through, so the raw text lands
 *   inside the `contenteditable` segment;
 * - Android keyboards send `keydown` 229 / `"Unidentified"` followed by a
 *   one-character `beforeinput` — bits-ui blocks the character, but never
 *   learns which key it was, so the digit vanishes.
 *
 * This bridge (attached in the capture phase on the segment group) blocks
 * those inputs and replays their characters as `keydown`s on the focused
 * segment — through bits-ui's own logic, auto-advance included. A paste
 * that parses as a whole value (`2026-10-20`, `14:30`) is applied directly.
 */
export function segmentInputBridge(options: {
	/** A pasted string → `true` when it was understood and applied as a whole value. */
	onPaste?: (text: string) => boolean;
}) {
	let unidentifiedKey = false;
	/** True while we dispatch our own keydowns — they must not reset the flag above. */
	let replaying = false;

	const isSegment = (target: EventTarget | null): target is HTMLElement =>
		target instanceof HTMLElement &&
		target.hasAttribute('data-segment') &&
		target.getAttribute('data-segment') !== 'literal';

	/** Feed characters to whichever segment has focus (it moves as segments fill). */
	function replay(text: string) {
		replaying = true;
		try {
			for (const char of text) {
				if (!/^[0-9a-z]$/i.test(char)) continue; // separators: segments advance on their own
				const segment = document.activeElement;
				if (!isSegment(segment)) return;
				segment.dispatchEvent(
					new KeyboardEvent('keydown', { key: char, bubbles: true, cancelable: true })
				);
			}
		} finally {
			replaying = false;
		}
	}

	return {
		onkeydowncapture(event: KeyboardEvent) {
			if (replaying) return; // our own replay, not a key press
			unidentifiedKey = event.key === 'Unidentified' || event.keyCode === 229;
		},
		onbeforeinputcapture(event: InputEvent) {
			if (!isSegment(event.target)) return;
			const data = event.data ?? '';
			if (!data || (data.length === 1 && !unidentifiedKey)) return;
			event.preventDefault();
			unidentifiedKey = false;
			replay(data);
		},
		onpastecapture(event: ClipboardEvent) {
			if (!isSegment(event.target)) return;
			event.preventDefault();
			const text = event.clipboardData?.getData('text/plain').trim() ?? '';
			if (!text || options.onPaste?.(text)) return;
			replay(text);
		}
	};
}
