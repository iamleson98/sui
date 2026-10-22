import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import {
	SuiCheckbox,
	SuiCombobox,
	SuiInput,
	SuiMultiSelect,
	SuiRadioGroup,
	SuiSelect,
	SuiSwitch,
	SuiTextarea,
	type SuiItem
} from '$lib/sui';
import { SUI_DISABLED_CONTROL, SUI_DISABLED_LABEL } from '$lib/sui/styles.js';

const items: SuiItem[] = [
	{ value: 'a', label: 'Alpha' },
	{ value: 'b', label: 'Beta' }
];

/** Every field: its label fades the same way when disabled, and only then. */
const fields = [
	['input', SuiInput, {}],
	['textarea', SuiTextarea, {}],
	['select', SuiSelect, { items }],
	['combobox', SuiCombobox, { items }],
	['multi-select', SuiMultiSelect, { items }],
	['switch', SuiSwitch, {}],
	['checkbox', SuiCheckbox, {}],
	['radio group', SuiRadioGroup, { items }]
] as const;

const faded = (el: Element | null) =>
	SUI_DISABLED_LABEL.split(' ').every((c) => el?.classList.contains(c));

describe('the disabled look is one look', () => {
	for (const [name, Field, props] of fields) {
		it(`${name}: the label fades only when disabled`, () => {
			const { unmount } = render(Field as never, { label: 'Field', ...props } as never);
			expect(faded(document.querySelector('[data-sui-label]'))).toBe(false);
			unmount();
			render(Field as never, { label: 'Field', disabled: true, ...props } as never);
			expect(faded(document.querySelector('[data-sui-label]'))).toBe(true);
		});
	}

	it('text fields fade their control box too', () => {
		for (const Field of [SuiInput, SuiTextarea]) {
			const { unmount } = render(Field as never, { label: 'Field', disabled: true } as never);
			const box = document.querySelector('[data-sui-control]');
			expect(SUI_DISABLED_CONTROL.split(' ').every((c) => box?.classList.contains(c))).toBe(true);
			unmount();
		}
	});
});

describe('a disabled multi-select', () => {
	it('does not open, is out of the tab order and offers no removal', async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		render(SuiMultiSelect, {
			label: 'Tags',
			items,
			value: ['a'],
			clearable: true,
			disabled: true
		});
		const trigger = screen.getByRole('combobox', { name: /tags/i });
		expect(trigger).toHaveAttribute('aria-disabled', 'true');
		expect(trigger).toHaveAttribute('tabindex', '-1');
		await user.click(trigger);
		expect(trigger).toHaveAttribute('aria-expanded', 'false');
		expect(document.querySelector('[data-sui-option]')).toBeNull();
		expect(document.querySelector('[data-sui-badge-remove]')).toBeNull();
		expect(document.querySelector('[data-sui-clear]')).toBeNull();
	});
});
