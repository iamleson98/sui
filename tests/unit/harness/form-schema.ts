import { z } from 'zod';

/**
 * Shared between the schema-form engine tests and the component harness so
 * both stay in lockstep with one schema.
 */
export const testSchema = z.object({
	name: z.string().min(2, 'Name must be at least 2 characters'),
	email: z.email('Enter a valid email'),
	role: z.enum(['admin', 'viewer'], 'Pick a role'),
	topics: z.array(z.string()).min(1, 'Select at least one topic'),
	accept: z.literal(true, { error: 'Please accept the terms' }),
	newsletter: z.boolean().default(true),
	address: z.object({
		city: z.string().optional()
	})
});

export type TestSchema = typeof testSchema;
