import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { CalendarDate, CalendarDateTime, Time } from '@internationalized/date';
import {
	SuiDateRangePicker,
	SuiDatePicker,
	SuiDateTimePicker,
	SuiTimePicker,
	createSuiForm,
	dateTimeToIso,
	dateToIso,
	focusFirstInvalid,
	formatTimeSlot,
	isoToDate,
	isoToDateTime,
	isoToTime,
	timeSlots,
	timeToIso
} from '$lib/sui';

const user = userEvent.setup({ pointerEventsCheck: 0 });

const segmentsText = (root: ParentNode, selector = '[data-sui-date-input]') =>
	(root.querySelector(selector)?.textContent ?? '').replace(/\s+/g, '');

describe('ISO helpers', () => {
	it('round-trip dates, times and date-times at the chosen precision', () => {
		expect(dateToIso(isoToDate('2026-10-11'))).toBe('2026-10-11');
		expect(timeToIso(isoToTime('14:30'))).toBe('14:30');
		expect(timeToIso(new Time(9, 5, 7), 'second')).toBe('09:05:07');
		expect(dateTimeToIso(isoToDateTime('2026-10-11T14:30'))).toBe('2026-10-11T14:30');
		expect(dateTimeToIso(new CalendarDate(2026, 1, 2))).toBe('2026-01-02T00:00');
		expect(dateTimeToIso(new CalendarDateTime(2026, 1, 2, 3, 4, 5), 'second')).toBe(
			'2026-01-02T03:04:05'
		);
	});

	it('map empty and invalid strings to undefined', () => {
		expect(isoToDate('')).toBeUndefined();
		expect(isoToDate('2026-13-40')).toBeUndefined();
		expect(isoToTime('25:00')).toBeUndefined();
		expect(isoToDateTime(undefined)).toBeUndefined();
	});

	it('builds slot lists within bounds and formats them per locale', () => {
		expect(timeSlots(30, '09:00', '10:30')).toEqual(['09:00', '09:30', '10:00', '10:30']);
		expect(timeSlots(60).length).toBe(24);
		expect(formatTimeSlot('14:30', 'en-US')).toBe('2:30 PM');
		expect(formatTimeSlot('14:30', 'de-DE')).toBe('14:30');
	});
});

describe('SuiDatePicker', () => {
	it('labels a segmented group and shows a bound ISO value in locale order', () => {
		const { container } = render(SuiDatePicker, { label: 'Start date', value: '2026-03-27' });
		expect(screen.getByRole('group', { name: /start date/i })).toBeInTheDocument();
		expect(segmentsText(container)).toBe('03/27/2026');

		const german = render(SuiDatePicker, { label: 'Datum', value: '2026-03-27', locale: 'de-DE' });
		expect(segmentsText(german.container)).toBe('27.03.2026');
	});

	it('typing digits into the segments emits an ISO date', async () => {
		const onValueChange = vi.fn();
		render(SuiDatePicker, { label: 'Start date', onValueChange });
		const [month] = screen.getAllByRole('spinbutton');
		month!.focus();
		await user.keyboard('03272026');
		await waitFor(() => expect(onValueChange).toHaveBeenLastCalledWith('2026-03-27'));
	});

	it('accepts a pasted ISO date as a whole value', async () => {
		const onValueChange = vi.fn();
		const { container } = render(SuiDatePicker, { label: 'Start date', onValueChange });
		const [month] = screen.getAllByRole('spinbutton');
		month!.focus();
		// jsdom has no ClipboardEvent/DataTransfer: hand a paste event a minimal clipboard
		const paste = new Event('paste', { bubbles: true, cancelable: true });
		Object.defineProperty(paste, 'clipboardData', { value: { getData: () => '2026-10-20' } });
		month!.dispatchEvent(paste);
		await waitFor(() => expect(onValueChange).toHaveBeenLastCalledWith('2026-10-20'));
		expect(segmentsText(container)).toBe('10/20/2026');
	});

	it('Android-style input (keydown 229 + beforeinput) still reaches the segments', async () => {
		const onValueChange = vi.fn();
		render(SuiDatePicker, { label: 'Start date', value: '2026-03-27', onValueChange });
		const [month] = screen.getAllByRole('spinbutton');
		month!.focus();
		// Gboard & co: the keydown carries no key, the character comes with beforeinput
		for (const digit of '11') {
			month!.dispatchEvent(
				new KeyboardEvent('keydown', { key: 'Unidentified', keyCode: 229, bubbles: true })
			);
			month!.dispatchEvent(
				new InputEvent('beforeinput', {
					data: digit,
					inputType: 'insertText',
					bubbles: true,
					cancelable: true
				})
			);
		}
		await waitFor(() => expect(onValueChange).toHaveBeenLastCalledWith('2026-11-27'));
	});

	it('multi-character inserts (IME commit, autofill) are typed through the segments', async () => {
		const onValueChange = vi.fn();
		render(SuiDatePicker, { label: 'Start date', onValueChange });
		const [month] = screen.getAllByRole('spinbutton');
		month!.focus();
		month!.dispatchEvent(
			new InputEvent('beforeinput', {
				data: '10202026',
				inputType: 'insertText',
				bubbles: true,
				cancelable: true
			})
		);
		await waitFor(() => expect(onValueChange).toHaveBeenLastCalledWith('2026-10-20'));
		// nothing raw leaked into the contenteditable segment
		expect(month!.textContent).toBe('10');
	});

	it('posts the ISO value under the field path (native form data)', () => {
		const form = createSuiForm(z.object({ startDate: z.iso.date() }), {
			initialValues: { startDate: '2026-10-11' }
		});
		const { container } = render(SuiDatePicker, { field: form.fields.startDate, label: 'Start' });
		const hidden = container.querySelector<HTMLInputElement>('input[name="startDate"]');
		expect(hidden?.value).toBe('2026-10-11');
	});

	it('validates with z.iso.date() through createSuiForm and focuses the first segment', async () => {
		const form = createSuiForm(z.object({ startDate: z.iso.date('Choose a start date') }));
		const { container } = render(SuiDatePicker, {
			field: form.fields.startDate,
			label: 'Start',
			required: true
		});
		expect(await form.handleSubmit()).toBe(false);
		await waitFor(() => expect(screen.getByText('Choose a start date')).toBeInTheDocument());
		expect(focusFirstInvalid(container)).toBe(true);
		expect(document.activeElement).toHaveAttribute('role', 'spinbutton');
	});

	it('memorable-date mode renders no calendar button', () => {
		render(SuiDatePicker, { label: 'Date of birth', calendar: false });
		expect(screen.queryByRole('button', { name: 'Open calendar' })).toBeNull();
	});

	it('offers "Today" only when today is selectable', async () => {
		render(SuiDatePicker, { label: 'Past only', max: '2000-01-01', value: '1999-12-31' });
		await user.click(screen.getByRole('button', { name: 'Open calendar' }));
		const today = await screen.findByRole('button', { name: 'Today' });
		expect(today).toBeDisabled();
	});

	it('clears to undefined', async () => {
		const onValueChange = vi.fn();
		render(SuiDatePicker, { label: 'Start', value: '2026-10-11', clearable: true, onValueChange });
		await user.click(screen.getByRole('button', { name: 'Clear selection' }));
		expect(onValueChange).toHaveBeenLastCalledWith(undefined);
	});
});

describe('SuiTimePicker', () => {
	it('shows a bound ISO time and offers slots within min/max', async () => {
		const { container } = render(SuiTimePicker, {
			label: 'Meeting',
			value: '10:30',
			step: 30,
			min: '09:00',
			max: '11:00'
		});
		expect(segmentsText(container, '[data-sui-time-input]')).toBe('10:30AM');

		await user.click(screen.getByRole('button', { name: 'Choose a time' }));
		const list = await screen.findByRole('listbox', { name: 'Choose a time' });
		const options = within(list).getAllByRole('option');
		expect(options.map((o) => o.textContent?.trim())).toEqual([
			'9:00 AM',
			'9:30 AM',
			'10:00 AM',
			'10:30 AM',
			'11:00 AM'
		]);
		expect(within(list).getByRole('option', { name: '10:30 AM' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
	});

	it('picking a slot emits the ISO time and closes the list', async () => {
		const onValueChange = vi.fn();
		render(SuiTimePicker, { label: 'Meeting', step: 60, onValueChange });
		await user.click(screen.getByRole('button', { name: 'Choose a time' }));
		const list = await screen.findByRole('listbox');
		await user.click(within(list).getByRole('option', { name: '2:00 PM' }));
		expect(onValueChange).toHaveBeenLastCalledWith('14:00');
		await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
	});

	it('uses a 24-hour clock where the locale does', () => {
		const { container } = render(SuiTimePicker, { label: 'Zeit', value: '14:30', locale: 'de-DE' });
		expect(segmentsText(container, '[data-sui-time-input]')).toBe('14:30');
	});
});

describe('SuiDateTimePicker', () => {
	it('shows date and time segments for a local ISO date-time', () => {
		const { container } = render(SuiDateTimePicker, {
			label: 'Starts at',
			value: '2026-10-14T09:30'
		});
		expect(segmentsText(container)).toBe('10/14/2026,09:30AM');
	});

	it('a time slot keeps the chosen day and sets the time', async () => {
		const onValueChange = vi.fn();
		render(SuiDateTimePicker, {
			label: 'Starts at',
			value: '2026-10-14T00:00',
			step: 30,
			onValueChange
		});
		await user.click(screen.getByRole('button', { name: 'Open calendar' }));
		const list = await screen.findByRole('listbox', { name: 'Choose a time' });
		await user.click(within(list).getByRole('option', { name: '9:30 AM' }));
		expect(onValueChange).toHaveBeenLastCalledWith('2026-10-14T09:30');
	});
});

describe('SuiDateRangePicker', () => {
	it('shows a bound ISO range as two segment groups', () => {
		const { container } = render(SuiDateRangePicker, {
			label: 'Stay',
			value: { start: '2026-10-11', end: '2026-10-14' }
		});
		expect(segmentsText(container, '[data-sui-date-input]')).toBe('10/11/2026–10/14/2026');
	});

	it('only commits complete ranges — a half-typed range never validates mid-selection', async () => {
		const onValueChange = vi.fn();
		render(SuiDateRangePicker, { label: 'Stay', onValueChange });
		const segments = screen.getAllByRole('spinbutton');
		segments[0]!.focus();
		await user.keyboard('10112026');
		await waitFor(() => expect(segments[3]).toBeInTheDocument());
		expect(onValueChange).not.toHaveBeenCalled(); // start only

		await user.keyboard('10142026');
		await waitFor(() =>
			expect(onValueChange).toHaveBeenLastCalledWith({ start: '2026-10-11', end: '2026-10-14' })
		);
	});

	it('presets set the whole range and clearing empties it', async () => {
		const onValueChange = vi.fn();
		render(SuiDateRangePicker, {
			label: 'Period',
			clearable: true,
			presets: [{ label: 'Q4', range: () => ({ start: '2026-10-01', end: '2026-12-31' }) }],
			onValueChange
		});
		await user.click(screen.getByRole('button', { name: 'Open calendar' }));
		await user.click(await screen.findByRole('button', { name: 'Q4' }));
		expect(onValueChange).toHaveBeenLastCalledWith({ start: '2026-10-01', end: '2026-12-31' });

		await user.click(screen.getByRole('button', { name: 'Clear selection' }));
		expect(onValueChange).toHaveBeenLastCalledWith({ start: undefined, end: undefined });
	});

	it('works as a createSuiForm field (z.object({ start, end })) and posts dotted names', async () => {
		const form = createSuiForm(
			z.object({
				stay: z
					.object({
						start: z.iso.date('Choose a check-in'),
						end: z.iso.date('Choose a check-out')
					})
					.refine((r) => !r.start || !r.end || r.end >= r.start, 'Check-out is before check-in')
			}),
			{ initialValues: { stay: { start: '2026-10-14', end: '2026-10-11' } } }
		);
		const { container } = render(SuiDateRangePicker, { field: form.fields.stay, label: 'Stay' });
		expect(container.querySelector<HTMLInputElement>('input[name="stay.start"]')?.value).toBe(
			'2026-10-14'
		);
		expect(container.querySelector<HTMLInputElement>('input[name="stay.end"]')?.value).toBe(
			'2026-10-11'
		);
		expect(await form.handleSubmit()).toBe(false);
		await waitFor(() =>
			expect(screen.getByText('Check-out is before check-in')).toBeInTheDocument()
		);
	});
});
