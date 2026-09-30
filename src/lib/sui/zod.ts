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

/** When a field should run its schema. */
export type SuiValidateOn = 'change' | 'blur' | 'both' | 'none';

export function shouldValidate(
	validateOn: SuiValidateOn,
	event: 'change' | 'blur'
): boolean {
	if (validateOn === 'none') return false;
	if (validateOn === 'both') return true;
	return validateOn === event;
}
