import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { z, ZodError } from 'zod';
import { createSuiSubmitter } from '$lib/sui/form/submit.svelte.js';
import SubmitterHarness from './harness/submitter-harness.svelte';

const user = userEvent.setup({ pointerEventsCheck: 0 });

const schema = z.object({
	name: z.string().min(2, 'Name must be at least 2 characters'),
	role: z.enum(['admin', 'viewer'], 'Pick a role'),
	topics: z.array(z.string()).min(1, 'Select at least one topic'),
	accept: z.literal(true, { error: 'Please accept the terms' })
});

function setup(onvalid: (data: unknown) => void | Promise<void>) {
	const submit = createSuiSubmitter(schema, {
		onvalid: onvalid as (data: z.output<typeof schema>) => void | Promise<void>
	});
	const rendered = render(SubmitterHarness, { submit });
	return { submit, ...rendered };
}

/** Options render in a portal — poll for the [data-sui-option] node. */
async function findOption(match: RegExp): Promise<HTMLElement> {
	return await waitFor(() => {
		const item = Array.from(document.querySelectorAll('[data-sui-option]')).find((el) =>
			match.test((el.textContent ?? '').trim())
		);
		if (!item) throw new Error(`option matching ${match} not found`);
		return item as HTMLElement;
	});
}

async function fillValid() {
	await user.type(screen.getByLabelText('Name'), 'Ada Lovelace');
	await user.click(screen.getByRole('button', { name: 'Role' }));
	await user.click(await findOption(/^Admin$/));
	await user.click(screen.getByRole('combobox', { name: /topics/i }));
	await user.click(await findOption(/^Svelte$/));
	await user.click(screen.getByLabelText('Accept the terms'));
}

describe('createSuiSubmitter', () => {
	it('collects registered values, parses the schema and hands typed data to onvalid', async () => {
		const onvalid = vi.fn();
		const { submit } = setup(onvalid);
		await fillValid();

		await fireEvent.submit(screen.getByRole('button', { name: 'Submit' }).closest('form')!);

		await waitFor(() => expect(onvalid).toHaveBeenCalled());
		expect(onvalid).toHaveBeenCalledWith({
			name: 'Ada Lovelace',
			role: 'admin',
			topics: ['svelte'],
			accept: true
		});
		expect(submit.submitCount).toBe(1);
	});

	it('distributes issues onto the matching fields and focuses the first invalid', async () => {
		const onvalid = vi.fn();
		setup(onvalid);
		await fireEvent.submit(screen.getByRole('button', { name: 'Submit' }).closest('form')!);

		await waitFor(() => {
			expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument();
			expect(screen.getByText('Pick a role')).toBeInTheDocument();
			expect(screen.getByText('Select at least one topic')).toBeInTheDocument();
			expect(screen.getByText('Please accept the terms')).toBeInTheDocument();
		});
		// WCAG 3.3.1: keyboard/screen-reader users land on the first problem
		expect(document.activeElement).toBe(screen.getByLabelText('Name'));
		expect(onvalid).not.toHaveBeenCalled();
	});

	it('clears only the edited field, without re-submitting', async () => {
		setup(vi.fn());
		await fireEvent.submit(screen.getByRole('button', { name: 'Submit' }).closest('form')!);
		await waitFor(() =>
			expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument()
		);

		await user.type(screen.getByLabelText('Name'), 'Ada Lovelace');

		await waitFor(() =>
			expect(screen.queryByText('Name must be at least 2 characters')).toBeNull()
		);
		expect(screen.getByText('Pick a role')).toBeInTheDocument();
	});

	it('maps a ZodError thrown from onvalid back onto fields', async () => {
		const onvalid = vi.fn(() => {
			throw new ZodError([
				{
					code: 'custom' as const,
					input: undefined,
					path: ['role'],
					message: 'That role needs approval'
				}
			]);
		});
		setup(onvalid);
		await fillValid();
		await fireEvent.submit(screen.getByRole('button', { name: 'Submit' }).closest('form')!);

		await waitFor(() => expect(screen.getByText('That role needs approval')).toBeInTheDocument());
	});

	it('collects root refine issues as form errors and reports them via oninvalid', async () => {
		const refined = z
			.object({
				name: z.string().min(2, 'Name must be at least 2 characters')
			})
			.refine(() => false, { message: 'Root-level problem' });
		const oninvalid = vi.fn();
		const submit = createSuiSubmitter(refined, { onvalid: vi.fn(), oninvalid });
		render(SubmitterHarness, { submit });
		await user.type(screen.getByLabelText('Name'), 'Ada Lovelace');
		await fireEvent.submit(screen.getByRole('button', { name: 'Submit' }).closest('form')!);

		await waitFor(() => expect(oninvalid).toHaveBeenCalled());
		expect(submit.formErrors).toContain('Root-level problem');
		// nothing matched the root path — no field claims it
		expect(screen.queryByText('Root-level problem')).toBeNull();
	});

	it('tracks isSubmitting across an async onvalid', async () => {
		let release: () => void = () => {};
		const gate = new Promise<void>((r) => (release = r));
		const { submit } = setup(() => gate);
		await fillValid();
		await fireEvent.submit(screen.getByRole('button', { name: 'Submit' }).closest('form')!);

		expect(submit.isSubmitting).toBe(true);
		release();
		await waitFor(() => expect(submit.isSubmitting).toBe(false));
	});
});
