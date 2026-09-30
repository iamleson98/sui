import type { ZodType } from 'zod';

/**
 * Parses a value against a zod v4 schema and returns deduplicated,
 * user-facing error messages. Returns an empty array when the schema
 * is missing or the value is valid.
 */
export function suiValidate(schema: ZodType | undefined, value: unknown): string[] {
	if (!schema) return [];
	const result = schema.safeParse(value);
	if (result.success) return [];
	const messages: string[] = [];
	for (const issue of result.error.issues) {
		const message = issue.message || 'Invalid value';
		if (!messages.includes(message)) messages.push(message);
	}
	return messages;
}

/**
 * When a field should run its schema.
 *
 * - `'auto'` — validate on the first blur, then on every change once the
 *   field has been touched (the Baymard / react-hook-form `onTouched`
 *   pattern: never scold a user mid-keystroke, but keep feedback instant
 *   after the first attempt). Default for text-like controls.
 * - `'both'` — validate on change and blur. Default for discrete controls
 *   (select, combobox, multi-select, checkbox, radio, switch) where every
 *   interaction is a completed answer.
 * - `'change'` / `'blur'` — explicit single-event validation.
 * - `'none'` — only submit-time `validate()` runs the schema.
 */
export type SuiValidateOn = 'auto' | 'change' | 'blur' | 'both' | 'none';

export function shouldValidate(
	validateOn: SuiValidateOn,
	event: 'change' | 'blur',
	touched = false
): boolean {
	if (validateOn === 'none') return false;
	if (validateOn === 'both') return true;
	if (validateOn === 'auto') return event === 'blur' || touched;
	return validateOn === event;
}
