<script lang="ts">
	import { DatePicker } from 'bits-ui';
	import type { DateValue } from '@internationalized/date';
	import * as Calendar from '$lib/components/ui/calendar/index.js';
	import { cn } from '$lib/utils.js';

	/**
	 * The calendar panel inside a sui date / date-time picker popover: the
	 * picker's connected bits-ui calendar, dressed in the shadcn calendar
	 * parts so it matches the rest of the design system.
	 */
	let {
		placeholder = $bindable(),
		locale,
		captionLayout = 'label',
		class: className = ''
	}: {
		/** The month on display (bound to the picker root). */
		placeholder: DateValue | undefined;
		locale: string;
		/** `'dropdown'` adds month/year selects — quick jumps to distant dates. */
		captionLayout?: 'label' | 'dropdown';
		class?: string;
	} = $props();

	const monthFormat = $derived(captionLayout === 'dropdown' ? 'short' : 'long');
</script>

<!-- 32px day cells, 40px on touch screens (comfortable tap targets) -->
<DatePicker.Calendar
	data-sui-calendar
	class={cn(
		'group/calendar p-3 [--cell-radius:var(--radius-md)] [--cell-size:--spacing(8)] pointer-coarse:[--cell-size:--spacing(10)]',
		className
	)}
>
	{#snippet children({ months, weekdays })}
		<Calendar.Months>
			<Calendar.Nav>
				<Calendar.PrevButton />
				<Calendar.NextButton />
			</Calendar.Nav>
			{#each months as month, monthIndex (month)}
				<Calendar.Month>
					<Calendar.Header>
						<Calendar.Caption
							{captionLayout}
							months={undefined}
							{monthFormat}
							years={undefined}
							yearFormat="numeric"
							month={month.value}
							bind:placeholder
							{locale}
							{monthIndex}
						/>
					</Calendar.Header>
					<Calendar.Grid>
						<Calendar.GridHead>
							<Calendar.GridRow class="select-none">
								<!-- the locale's own narrow names (slicing "Monday" breaks other scripts) -->
								{#each weekdays as weekday, i (i)}
									<Calendar.HeadCell>{weekday}</Calendar.HeadCell>
								{/each}
							</Calendar.GridRow>
						</Calendar.GridHead>
						<Calendar.GridBody>
							{#each month.weeks as weekDates (weekDates)}
								<Calendar.GridRow class="mt-2 w-full">
									{#each weekDates as date (date)}
										<Calendar.Cell {date} month={month.value}>
											<Calendar.Day />
										</Calendar.Cell>
									{/each}
								</Calendar.GridRow>
							{/each}
						</Calendar.GridBody>
					</Calendar.Grid>
				</Calendar.Month>
			{/each}
		</Calendar.Months>
	{/snippet}
</DatePicker.Calendar>
