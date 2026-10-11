import {
	CalendarDate,
	CalendarDateTime,
	parseDate,
	parseDateTime,
	parseTime,
	Time,
	toCalendarDate,
	toCalendarDateTime,
	toTime,
	type DateValue
} from '@internationalized/date';

/**
 * sui date/time controls bind plain ISO 8601 strings — the formats native
 * `<input type="date|time|datetime-local">` use — so values validate with
 * `z.iso.date()` / `z.iso.time()` / `z.iso.datetime({ local: true })`,
 * serialise to JSON and post through `FormData` untouched:
 *
 * - date: `2026-10-11`
 * - time: `14:30` (or `14:30:05` with second granularity)
 * - date-time: `2026-10-11T14:30` (local, no time zone)
 *
 * These helpers convert between those strings and the
 * `@internationalized/date` values bits-ui works with. Invalid or empty
 * strings map to `undefined`.
 */

/** Precision of a time value. */
export type SuiTimeGranularity = 'minute' | 'second';

const pad = (n: number) => String(n).padStart(2, '0');

/** `'2026-10-11'` → `CalendarDate` (`undefined` when empty or invalid). */
export function isoToDate(iso: string | null | undefined): CalendarDate | undefined {
	if (!iso) return undefined;
	try {
		return parseDate(iso.slice(0, 10));
	} catch {
		return undefined;
	}
}

/** Any date value → `'2026-10-11'`. */
export function dateToIso(value: DateValue | null | undefined): string | undefined {
	return value ? toCalendarDate(value).toString() : undefined;
}

/** `'14:30'` / `'14:30:05'` → `Time` (`undefined` when empty or invalid). */
export function isoToTime(iso: string | null | undefined): Time | undefined {
	if (!iso) return undefined;
	try {
		return parseTime(iso);
	} catch {
		return undefined;
	}
}

/** A time (or date-time) value → `'14:30'` / `'14:30:05'`. */
export function timeToIso(
	value: Time | CalendarDateTime | null | undefined,
	granularity: SuiTimeGranularity = 'minute'
): string | undefined {
	if (!value) return undefined;
	const t = value instanceof Time ? value : toTime(value);
	const hm = `${pad(t.hour)}:${pad(t.minute)}`;
	return granularity === 'second' ? `${hm}:${pad(t.second)}` : hm;
}

/** `'2026-10-11T14:30'` → `CalendarDateTime` (`undefined` when empty or invalid). */
export function isoToDateTime(iso: string | null | undefined): CalendarDateTime | undefined {
	if (!iso) return undefined;
	try {
		return parseDateTime(iso);
	} catch {
		return undefined;
	}
}

/** A date or date-time value → `'2026-10-11T14:30'` (or with `:ss`). */
export function dateTimeToIso(
	value: DateValue | null | undefined,
	granularity: SuiTimeGranularity = 'minute'
): string | undefined {
	if (!value) return undefined;
	const dt =
		'hour' in value ? toCalendarDateTime(value) : toCalendarDateTime(value as CalendarDate);
	return `${toCalendarDate(dt).toString()}T${timeToIso(dt, granularity)}`;
}

/**
 * Times of day from `start` to `end` (inclusive) every `step` minutes —
 * `['09:00', '09:30', …]` — for slot lists.
 */
export function timeSlots(step: number, start = '00:00', end = '23:59'): string[] {
	const from = isoToTime(start) ?? new Time(0, 0);
	const to = isoToTime(end) ?? new Time(23, 59);
	const size = Math.max(1, Math.round(step));
	const out: string[] = [];
	for (
		let minutes = from.hour * 60 + from.minute;
		minutes <= to.hour * 60 + to.minute;
		minutes += size
	) {
		out.push(`${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`);
	}
	return out;
}

/** Formats an ISO time for display in a slot list (`'2:30 PM'` / `'14:30'`). */
export function formatTimeSlot(iso: string, locale: string, hourCycle?: 12 | 24): string {
	const t = isoToTime(iso);
	if (!t) return iso;
	const date = new Date(2000, 0, 1, t.hour, t.minute);
	return new Intl.DateTimeFormat(locale, {
		hour: 'numeric',
		minute: '2-digit',
		...(hourCycle ? { hourCycle: hourCycle === 12 ? 'h12' : 'h23' } : {})
	}).format(date);
}
