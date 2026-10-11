import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import {
	SuiCheckbox,
	SuiCombobox,
	SuiInput,
	SuiMultiSelect,
	SuiRadioGroup,
	SuiSelect,
	SuiSwitch,
	SuiTextarea,
	createSuiForm,
	cursorSource,
	type SuiItem,
	type SuiSource
} from '$lib/sui';
import NativeFormHarness from './harness/native-form-harness.svelte';
import StringsHarness from './harness/strings-harness.svelte';

/**
 * Production-hardening regressions for the form controls: hydration-safe
 * ids, native form data, required semantics, change callbacks, number
 * fields, async label memory, retries and localisable copy.
 */

const user = userEvent.setup({ pointerEventsCheck: 0 });

async function findOption(match: RegExp): Promise<HTMLElement> {
	return await waitFor(() => {
		const option = Array.from(document.querySelectorAll<HTMLElement>('[data-sui-option]')).find(
			(el) => match.test((el.textContent ?? '').trim())
		);
		if (!option) throw new Error(`option matching ${match} not found`);
		return option;
	});
}

describe('ids work without crypto.randomUUID (plain-HTTP / non-secure contexts)', () => {
	afterEach(() => vi.restoreAllMocks());

	it('renders every control and keeps label ↔ control association', () => {
		// crypto.randomUUID only exists in secure contexts (HTTPS, localhost)
		vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
			throw new TypeError('crypto.randomUUID is not a function');
		});
		const items = [{ value: 'a', label: 'A' }];
		render(SuiInput, { label: 'Email' });
		render(SuiTextarea, { label: 'Bio' });
		render(SuiCheckbox, { label: 'Accept' });
		render(SuiSwitch, { label: 'Notify' });
		render(SuiRadioGroup, { label: 'Plan', items });
		render(SuiSelect, { label: 'Role', items });
		render(SuiCombobox, { label: 'Country', items });
		render(SuiMultiSelect, { label: 'Tags', items });

		expect(screen.getByLabelText('Email')).toBeInTheDocument();
		expect(screen.getByLabelText('Bio')).toBeInTheDocument();
		expect(screen.getByRole('checkbox', { name: 'Accept' })).toBeInTheDocument();
		expect(screen.getByRole('switch', { name: 'Notify' })).toBeInTheDocument();
		expect(screen.getByRole('radiogroup', { name: 'Plan' })).toBeInTheDocument();
		expect(screen.getByRole('combobox', { name: 'Country' })).toBeInTheDocument();
		expect(screen.getByRole('combobox', { name: 'Tags' })).toBeInTheDocument();
	});

	it('generates distinct ids per instance', () => {
		render(SuiInput, { label: 'First' });
		render(SuiInput, { label: 'Second' });
		expect(screen.getByLabelText('First').id).not.toBe(screen.getByLabelText('Second').id);
	});
});

describe('native form data — every control posts under its field path', () => {
	it('collects all values with FormData, no explicit `name` props', () => {
		render(NativeFormHarness);
		const form = screen.getByTestId('native-form') as HTMLFormElement;
		const data = new FormData(form);
		expect(data.get('email')).toBe('ada@example.com');
		expect(data.get('bio')).toBe('Hi');
		expect(data.get('accept')).toBe('on');
		expect(data.get('notify')).toBe('on');
		expect(data.get('plan')).toBe('pro');
		expect(data.get('role')).toBe('admin');
		expect(data.get('country')).toBe('vn');
		expect(data.getAll('tags')).toEqual(['a', 'b']);
	});

	it('an explicit name wins over the field path', () => {
		const form = createSuiForm(z.object({ email: z.string() }));
		render(SuiInput, { field: form.fields.email, name: 'user[email]', label: 'Email' });
		expect(screen.getByLabelText('Email')).toHaveAttribute('name', 'user[email]');
	});
});

describe('required semantics are announced once, by the control', () => {
	it('select-family triggers carry aria-required; no duplicate "(required)" label text', () => {
		const items = [{ value: 'a', label: 'A' }];
		const { container } = render(SuiSelect, { label: 'Role', items, required: true });
		render(SuiCombobox, { label: 'Country', items, required: true });
		render(SuiMultiSelect, { label: 'Tags', items, required: true });
		for (const name of ['Role', 'Country', 'Tags']) {
			expect(screen.getByRole('combobox', { name })).toHaveAttribute('aria-required', 'true');
		}
		expect(container.querySelector('.sr-only')).toBeNull();
	});
});

describe('change callbacks fire (native onchange cannot on button-based controls)', () => {
	it('checkbox and switch expose onCheckedChange', async () => {
		const onCheckbox = vi.fn();
		const onSwitch = vi.fn();
		render(SuiCheckbox, { label: 'Accept', onCheckedChange: onCheckbox });
		render(SuiSwitch, { label: 'Notify', onCheckedChange: onSwitch });
		await user.click(screen.getByRole('checkbox', { name: 'Accept' }));
		await user.click(screen.getByRole('switch', { name: 'Notify' }));
		expect(onCheckbox).toHaveBeenCalledWith(true);
		expect(onSwitch).toHaveBeenCalledWith(true);
	});

	it('radio group exposes a typed onValueChange', async () => {
		const onValueChange = vi.fn();
		render(SuiRadioGroup, {
			label: 'Plan',
			items: [
				{ value: 'free', label: 'Free' },
				{ value: 'pro', label: 'Pro' }
			],
			onValueChange
		});
		await user.click(screen.getByRole('radio', { name: /pro/i }));
		expect(onValueChange).toHaveBeenCalledWith('pro');
	});
});

describe('radio group blur validation', () => {
	const plans = [
		{ value: 'free', label: 'Free' },
		{ value: 'pro', label: 'Pro' }
	];

	it('validates when focus LEAVES the group (blur does not bubble from the options)', async () => {
		render(SuiRadioGroup, {
			label: 'Plan',
			items: plans,
			schema: z.enum(['free', 'pro'], 'Choose a plan')
		});
		render(SuiInput, { label: 'After' });
		screen.getAllByRole('radio')[0]!.focus();
		await user.tab(); // out of the group
		await waitFor(() => expect(screen.getByText('Choose a plan')).toBeInTheDocument());
	});

	it('marks the form field touched + revealed on group blur', async () => {
		const form = createSuiForm(z.object({ plan: z.enum(['free', 'pro'], 'Choose a plan') }));
		render(SuiRadioGroup, { label: 'Plan', items: plans, field: form.fields.plan });
		render(SuiInput, { label: 'After' });
		screen.getAllByRole('radio')[0]!.focus();
		await user.tab();
		await waitFor(() => expect(form.fields.plan.touched).toBe(true));
		expect(form.fields.plan.errors).toEqual(['Choose a plan']);
	});

	it('handles option values with spaces (ids are index-based)', async () => {
		render(SuiRadioGroup, {
			label: 'City',
			items: [
				{ value: 'New York', label: 'New York' },
				{ value: 'São Paulo', label: 'São Paulo' }
			]
		});
		await user.click(screen.getByText('São Paulo'));
		expect(screen.getByRole('radio', { name: 'São Paulo' })).toBeChecked();
		for (const radio of screen.getAllByRole('radio')) expect(radio.id).not.toMatch(/\s/);
	});
});

describe('type="number" fields hold numbers', () => {
	const schema = z.object({ age: z.number('Enter your age').int().min(18, 'Must be 18+') });

	it('feeds z.number() a number (undefined while empty) — no z.coerce needed', async () => {
		const form = createSuiForm(schema);
		render(SuiInput, { field: form.fields.age, label: 'Age', type: 'number' });
		const input = screen.getByLabelText('Age') as HTMLInputElement;

		await user.type(input, '42');
		expect(form.values.age).toBe(42);
		await user.clear(input);
		expect(form.values.age).toBeUndefined();
		await user.type(input, '17');
		input.blur();
		await waitFor(() => expect(form.fields.age.errors).toEqual(['Must be 18+']));
		await user.clear(input);
		// empty is "missing" — not 0 (z.coerce's trap)
		await waitFor(() => expect(form.fields.age.errors).toEqual(['Enter your age']));
	});

	it('shows programmatic numbers and resets cleanly', async () => {
		const form = createSuiForm(schema, { initialValues: { age: 30 } });
		render(SuiInput, { field: form.fields.age, label: 'Age', type: 'number' });
		const input = screen.getByLabelText('Age') as HTMLInputElement;
		expect(input.value).toBe('30');
		await user.clear(input);
		await user.type(input, '45');
		form.reset();
		await waitFor(() => expect(input.value).toBe('30'));
	});

	it('standalone schema validation sees a number too', async () => {
		render(SuiInput, {
			label: 'Quantity',
			type: 'number',
			schema: z.number('Enter a quantity').min(1, 'At least 1')
		});
		const input = screen.getByLabelText('Quantity');
		await user.type(input, '5');
		input.blur();
		await waitFor(() => expect(input).not.toHaveAttribute('aria-invalid'));
	});
});

describe('multi-select', () => {
	const people: SuiItem[] = [
		{ value: 'usr_1', label: 'Alice Johnson' },
		{ value: 'usr_2', label: 'Bob Smith' }
	];

	it('static search matches labels, not only values', async () => {
		render(SuiMultiSelect, { label: 'People', items: people });
		await user.click(screen.getByRole('combobox', { name: 'People' }));
		const input = document.querySelector('[data-sui-multi-select-input]') as HTMLInputElement;
		await user.type(input, 'alice');
		expect(await findOption(/alice johnson/i)).toBeInTheDocument();
		await waitFor(() => {
			const visible = Array.from(document.querySelectorAll('[data-sui-option]')).filter(
				(el) => !(el as HTMLElement).hidden && el.getAttribute('aria-hidden') !== 'true'
			);
			expect(visible.map((el) => el.textContent?.trim())).toEqual(['Alice Johnson']);
		});
	});

	it('options expose their checked state to assistive tech', async () => {
		render(SuiMultiSelect, { label: 'People', items: people, value: ['usr_2'] });
		await user.click(screen.getByRole('combobox', { name: 'People' }));
		expect(await findOption(/bob/i)).toHaveAttribute('aria-checked', 'true');
		expect(await findOption(/alice/i)).toHaveAttribute('aria-checked', 'false');
	});

	it('labels preloaded values from selectedItems', () => {
		const source: SuiSource<SuiItem> = cursorSource(async () => ({
			items: [{ value: 'usr_9', label: 'Someone else' }],
			nextCursor: null
		}));
		render(SuiMultiSelect, {
			label: 'People',
			source,
			value: ['usr_42'],
			selectedItems: [{ value: 'usr_42', label: 'Grace Hopper' }]
		});
		expect(document.querySelector('[data-sui-badge]')).toHaveTextContent('Grace Hopper');
	});
});

describe('async selects keep the selection label', () => {
	/** A searchable cursor source: every query returns its own page of users. */
	function userSource(calls: string[] = []): SuiSource<SuiItem> {
		return cursorSource(async ({ query }) => {
			calls.push(query);
			if (query === 'grace')
				return { items: [{ value: 'u-42', label: 'Grace Hopper' }], nextCursor: null };
			return {
				items: [
					{ value: 'u-1', label: 'Ada Lovelace' },
					{ value: 'u-2', label: 'Alan Turing' }
				],
				nextCursor: null
			};
		});
	}

	it('combobox: a value picked from a search keeps its label after reopening', async () => {
		const calls: string[] = [];
		render(SuiCombobox, { label: 'Owner', source: userSource(calls), searchDebounce: 0 });
		const trigger = screen.getByRole('combobox', { name: 'Owner' });
		await user.click(trigger);
		const input = document.querySelector('[data-sui-combobox-input]') as HTMLInputElement;
		await user.type(input, 'grace');
		await user.click(await findOption(/grace hopper/i));
		expect(trigger).toHaveTextContent('Grace Hopper');

		// reopening resets the search to page one — which lacks Grace
		await user.click(trigger);
		await waitFor(() => expect(calls.at(-1)).toBe(''));
		await findOption(/ada lovelace/i);
		expect(trigger).toHaveTextContent('Grace Hopper');
		expect(trigger).not.toHaveTextContent('u-42');
	});

	it('select / combobox: selectedItem labels an initial value that is not loaded yet', () => {
		render(SuiSelect, {
			label: 'Owner',
			source: userSource(),
			value: 'u-42',
			selectedItem: { value: 'u-42', label: 'Grace Hopper' }
		});
		render(SuiCombobox, {
			label: 'Reviewer',
			source: userSource(),
			value: 'u-42',
			selectedItem: { value: 'u-42', label: 'Grace Hopper' }
		});
		expect(screen.getByRole('combobox', { name: 'Owner' })).toHaveTextContent('Grace Hopper');
		expect(screen.getByRole('combobox', { name: 'Reviewer' })).toHaveTextContent('Grace Hopper');
	});
});

describe('failed source requests offer an explicit retry', () => {
	it('combobox: "Try again" reloads the page that failed', async () => {
		let fail = true;
		const source: SuiSource<SuiItem> = cursorSource(async () => {
			if (fail) throw new Error('503');
			return { items: [{ value: 'ok', label: 'Recovered' }], nextCursor: null };
		});
		render(SuiCombobox, { label: 'Owner', source, errorText: 'Could not load users' });
		await user.click(screen.getByRole('combobox', { name: 'Owner' }));
		const retry = await screen.findByRole('button', { name: 'Try again' });
		expect(screen.getByRole('alert')).toHaveTextContent('Could not load users');

		fail = false;
		await user.click(retry);
		expect(await findOption(/recovered/i)).toBeInTheDocument();
	});
});

describe('setSuiStrings — localisable built-in copy', () => {
	it('overrides defaults for its subtree, reactively', async () => {
		let lang = $state('fr');
		render(StringsHarness, {
			strings: () =>
				lang === 'fr'
					? { selectPlaceholder: 'Choisir…', clearAll: 'Tout effacer' }
					: { selectPlaceholder: 'Wählen…' }
		});
		const owner = screen.getByRole('combobox', { name: 'Owner' });
		expect(owner).toHaveTextContent('Choisir…');
		expect(screen.getByRole('button', { name: 'Tout effacer' })).toBeInTheDocument();

		lang = 'de';
		await waitFor(() => expect(owner).toHaveTextContent('Wählen…'));
		// keys a scope does not override fall through to the defaults
		expect(screen.getByRole('button', { name: 'Clear all' })).toBeInTheDocument();
	});
});
