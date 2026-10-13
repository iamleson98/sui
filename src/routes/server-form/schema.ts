import { z } from 'zod';

/** One schema — validated live in the browser AND authoritatively in the action. */
export const signupSchema = z.object({
	name: z.string().min(2, 'Enter at least 2 characters'),
	email: z.email('Enter an email like name@example.com'),
	plan: z.enum(['free', 'pro'], 'Choose a plan'),
	startDate: z.iso.date('Choose a start date'),
	accept: z.literal(true, { error: 'Please accept the terms' })
});
