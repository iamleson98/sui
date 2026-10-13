<script lang="ts">
	import { z } from 'zod';
	import { getLocalTimeZone, today } from '@internationalized/date';
	import Seo from '$lib/demo/seo.svelte';
	import Section from '$lib/demo/section.svelte';
	import CodeBlock from '$lib/demo/code-block.svelte';
	import {
		SuiDateRangePicker,
		SuiDatePicker,
		SuiDateTimePicker,
		SuiTimePicker,
		SuiDatePickerSkeleton
	} from '$lib/sui/date/index.js';
	import { SuiForm, createSuiForm } from '$lib/sui/form/index.js';
	import { SuiButton } from '$lib/sui/button/index.js';
	import PlaneIcon from '@lucide/svelte/icons/plane';

	const todayIso = today(getLocalTimeZone()).toString();
	const isWeekend = (iso: string) => [0, 6].includes(new Date(`${iso}T00:00`).getDay());

	// --- standalone pickers ---
	let delivery = $state<string | undefined>(undefined);
	let birthDate = $state<string | undefined>(undefined);
	let meeting = $state<string | undefined>('10:30');
	let startsAt = $state<string | undefined>(undefined);
	const sizes = ['sm', 'md', 'lg'] as const;

	// --- range picker ---
	let stay = $state<{ start?: string; end?: string } | undefined>(undefined);
	const addDays = (n: number) => {
		const d = new Date();
		d.setDate(d.getDate() + n);
		const pad = (v: number) => String(v).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	};
	const presets = [
		{ label: 'Next 7 days', range: () => ({ start: addDays(0), end: addDays(6) }) },
		{ label: 'Next 30 days', range: () => ({ start: addDays(0), end: addDays(29) }) }
	];
	const rangeCode = `<!-- value is { start, end } as ISO strings; only complete ranges are written back -->
<SuiDateRangePicker label="Stay" min={todayIso} {presets} clearable bind:value={stay} />

<!-- inside a form: a z.object({ start, end }) field -->
const schema = z.object({
  stay: z.object({
    start: z.iso.date('Choose a check-in'),
    end: z.iso.date('Choose a check-out')
  }).refine((r) => !r.start || !r.end || r.end >= r.start, 'Check-out is before check-in')
});
<SuiDateRangePicker field={form.fields.stay} label="Stay" required />`;

	// --- schema-driven booking form ---
	const bookingSchema = z
		.object({
			checkIn: z.iso.date('Choose a check-in date'),
			checkOut: z.iso.date('Choose a check-out date'),
			arrival: z.iso.time('Choose an arrival time'),
			flight: z.iso.datetime({ local: true, error: 'Choose your flight’s departure' }).optional()
		})
		// guard on both values: zod still runs object refinements when a field
		// only failed its format (an empty '' date), not just on valid input
		.refine((d) => !d.checkIn || !d.checkOut || d.checkOut > d.checkIn, {
			path: ['checkOut'],
			error: 'Check-out must be after check-in'
		});

	let booked = $state<z.output<typeof bookingSchema> | null>(null);
	const booking = createSuiForm(bookingSchema, {
		onsubmit: async (data) => {
			await new Promise((resolve) => setTimeout(resolve, 400));
			booked = data;
		}
	});

	const pickersCode = `<!-- scheduling: typed segments + calendar, weekends unavailable -->
<SuiDatePicker
  label="Delivery date"
  min={todayIso}
  isDateUnavailable={isWeekend}
  clearable
  bind:value={delivery}            <!-- '2026-10-14' -->
/>

<!-- memorable dates: typing only, no calendar (GOV.UK / USWDS) -->
<SuiDatePicker label="Date of birth" calendar={false} subText="For example, 27 3 1990" />

<!-- typed time + a slot dropdown (every 15 min, office hours) -->
<SuiTimePicker label="Meeting" step={15} min="09:00" max="17:30" bind:value={meeting} />

<!-- date AND time: calendar + a time column in one popover -->
<SuiDateTimePicker label="Starts at" step={30} bind:value={startsAt} />  <!-- '2026-10-14T09:30' -->`;

	const formCode = `const schema = z.object({
  checkIn: z.iso.date('Choose a check-in date'),
  checkOut: z.iso.date('Choose a check-out date'),
  arrival: z.iso.time('Choose an arrival time'),
  flight: z.iso.datetime({ local: true }).optional()
}).refine((d) => !d.checkIn || !d.checkOut || d.checkOut > d.checkIn, {
  path: ['checkOut'],
  error: 'Check-out must be after check-in'   // ISO dates compare as strings
});

const form = createSuiForm(schema, { onsubmit: (data) => book(data) });

<SuiForm {form}>
  <SuiDatePicker field={form.fields.checkIn} label="Check-in" min={todayIso} required />
  <SuiDatePicker field={form.fields.checkOut} label="Check-out" min={todayIso} required />
  <SuiTimePicker field={form.fields.arrival} label="Arrival" step={30} required />
  <SuiDateTimePicker field={form.fields.flight} label="Flight" clearable />
  <SuiButton type="submit">Book</SuiButton>
</SuiForm>`;
</script>

<Seo path="/date-time" />

<h1 class="mb-8 text-3xl font-bold tracking-tight">Date &amp; Time</h1>

<Section
	title="Pickers"
	description="Every field accepts typing — one keyboard-editable segment per unit, in the locale's order — and the calendar or time slots are a shortcut, never the only way in. Values are plain ISO strings, exactly what native date/time inputs produce."
>
	<div class="grid max-w-3xl gap-6 sm:grid-cols-2">
		<div class="flex flex-col gap-2">
			<SuiDatePicker
				label="Delivery date"
				subText="Weekdays only, from today."
				min={todayIso}
				isDateUnavailable={isWeekend}
				clearable
				bind:value={delivery}
			/>
			<span class="text-xs text-muted-foreground"
				>Bound value: <code class="rounded bg-muted px-1">{delivery ?? 'undefined'}</code></span
			>
		</div>
		<div class="flex flex-col gap-2">
			<SuiDatePicker
				label="Date of birth"
				calendar={false}
				max={todayIso}
				subText="For example, 27 3 1990 — memorable dates are typed, no calendar."
				bind:value={birthDate}
			/>
			<span class="text-xs text-muted-foreground"
				>Bound value: <code class="rounded bg-muted px-1">{birthDate ?? 'undefined'}</code></span
			>
		</div>
		<div class="flex flex-col gap-2">
			<SuiTimePicker
				label="Meeting"
				subText="Office hours — pick a 15-minute slot or type any time."
				step={15}
				min="09:00"
				max="17:30"
				clearable
				bind:value={meeting}
			/>
			<span class="text-xs text-muted-foreground"
				>Bound value: <code class="rounded bg-muted px-1">{meeting ?? 'undefined'}</code></span
			>
		</div>
		<div class="flex flex-col gap-2">
			<SuiDateTimePicker
				label="Starts at"
				subText="Pick a day, then a time."
				min={todayIso}
				clearable
				bind:value={startsAt}
			/>
			<span class="text-xs text-muted-foreground"
				>Bound value: <code class="rounded bg-muted px-1">{startsAt ?? 'undefined'}</code></span
			>
		</div>
		<SuiDatePicker
			label="Archive date"
			subText="Month/year dropdowns jump across decades."
			captionLayout="dropdown"
			startIcon={PlaneIcon}
		/>
	</div>
	<div class="mt-8">
		<CodeBlock code={pickersCode} />
	</div>
</Section>

<Section
	title="Date range"
	description="One field for a stay, a report period or a booking window. Both ends are typed or picked in a two-month calendar; half-picked ranges never validate mid-selection, and presets jump straight to common periods."
>
	<div class="grid max-w-3xl gap-6 sm:grid-cols-2">
		<div class="flex flex-col gap-2">
			<SuiDateRangePicker
				label="Stay"
				subText="Pick check-in and check-out."
				min={todayIso}
				{presets}
				clearable
				bind:value={stay}
			/>
			<span class="text-xs text-muted-foreground"
				>Bound value:
				<code class="rounded bg-muted px-1" data-testid="range-value"
					>{stay?.start ?? '…'} → {stay?.end ?? '…'}</code
				></span
			>
		</div>
	</div>
	<div class="mt-8">
		<CodeBlock code={rangeCode} />
	</div>
</Section>

<Section
	title="Forms"
	description="ISO strings validate with zod's z.iso.date() / z.iso.time() / z.iso.datetime (local: true), compare as plain strings in refinements, and post through FormData untouched."
>
	<div class="grid gap-6 lg:grid-cols-[1fr_18rem]">
		<SuiForm form={booking} class="grid max-w-xl gap-5 sm:grid-cols-2" showFormErrors>
			<SuiDatePicker field={booking.fields.checkIn} label="Check-in" min={todayIso} required />
			<SuiDatePicker field={booking.fields.checkOut} label="Check-out" min={todayIso} required />
			<SuiTimePicker field={booking.fields.arrival} label="Arrival" step={30} required />
			<SuiDateTimePicker field={booking.fields.flight} label="Flight (optional)" clearable />
			<div class="sm:col-span-2">
				<SuiButton type="submit" loading={booking.isSubmitting}>Book</SuiButton>
			</div>
		</SuiForm>
		<div class="rounded-lg border bg-muted/30 p-4 text-sm">
			<p class="mb-2 font-medium">Parsed result</p>
			<!-- a scrollable region must be keyboard-reachable (WCAG 2.1.1) -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<pre tabindex="0" class="overflow-x-auto text-xs" data-testid="booking-result">{booked
					? JSON.stringify(booked, null, 2)
					: 'Submit the form to see the parsed values.'}</pre>
		</div>
	</div>
	<div class="mt-8">
		<CodeBlock code={formCode} />
	</div>
</Section>

<Section
	title="Locales"
	description="Segment order, separators, month names and the 12/24-hour clock follow the locale — per field (the locale prop) or app-wide through setSuiStrings."
>
	<div class="grid max-w-3xl gap-6 sm:grid-cols-3">
		<SuiDatePicker label="en-US" locale="en-US" value="2026-03-27" />
		<SuiDatePicker label="de-DE" locale="de-DE" value="2026-03-27" />
		<SuiDatePicker label="ja-JP" locale="ja-JP" value="2026-03-27" />
		<SuiTimePicker label="en-US (12h)" locale="en-US" value="14:30" />
		<SuiTimePicker label="de-DE (24h)" locale="de-DE" value="14:30" />
		<SuiDateTimePicker label="en-GB" locale="en-GB" value="2026-03-27T14:30" />
	</div>
</Section>

<Section title="Sizes & skeletons" description="The shared size scale and size-matched skeletons.">
	<div class="grid max-w-3xl gap-4 sm:grid-cols-3">
		{#each sizes as size (size)}
			<SuiDatePicker {size} label="Size {size}" value="2026-10-11" />
		{/each}
		{#each sizes as size (size)}
			<SuiDatePickerSkeleton {size} label={true} />
		{/each}
	</div>
</Section>
