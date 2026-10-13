import { fail } from '@sveltejs/kit';
import { suiParseFormData } from '$lib/sui/index.js';
import { signupSchema } from './schema.js';
import type { Actions } from './$types';

// actions need a live server — opt out of the app-wide prerendering
export const prerender = false;

export const actions: Actions = {
	signup: async ({ request }) => {
		const parsed = suiParseFormData(signupSchema, await request.formData());
		if (!parsed.ok) return fail(400, { errors: parsed.errors, values: parsed.values });

		// business rule only the server can check
		if (parsed.data.email === 'taken@example.com') {
			return fail(400, {
				errors: { email: ['That email is already registered.'] },
				values: parsed.values
			});
		}
		return { saved: parsed.data };
	}
};
