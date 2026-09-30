import type { ZodType } from 'zod';
import { shouldValidate, suiValidate } from './zod.js';

/**
 * Per-field validation state shared by every sui form control.
 *
 * Tracks whether the user has interacted with the field yet (`touched`)
 * and holds the current error messages. Once a field is touched it keeps
 * re-validating on every change, giving instant feedback.
 */
export class SuiFieldState {
	errors = $state<string[]>([]);
	touched = $state(false);

	/**
	 * Runs validation (respecting `validateOn`) and stores the result.
	 * Any validated event marks the field as touched. Returns the
	 * resulting error messages.
	 */
	validate(
		value: unknown,
		schema: ZodType | undefined,
		event: 'change' | 'blur',
		validateOn: 'change' | 'blur' | 'both' | 'none' = 'both'
	): string[] {
		if (!schema) return this.errors;
		if (!shouldValidate(validateOn, event)) return this.errors;
		this.touched = true;
		this.errors = suiValidate(schema, value);
		return this.errors;
	}

	/**
	 * Validates regardless of configuration. Use for submit handlers.
	 */
	forceValidate(value: unknown, schema: ZodType | undefined): string[] {
		this.touched = true;
		this.errors = suiValidate(schema, value);
		return this.errors;
	}

	/** Replaces the error list externally (server-side errors etc.). */
	setErrors(errors: string[]): void {
		this.touched = true;
		this.errors = errors;
	}

	clear(): void {
		this.errors = [];
	}

	reset(): void {
		this.touched = false;
		this.errors = [];
	}
}
