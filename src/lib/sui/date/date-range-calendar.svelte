<script lang="ts">
	import { DateRangePicker } from 'bits-ui';
	import type { DateValue } from '@internationalized/date';
	import * as Calendar from '$lib/components/ui/range-calendar/index.js';
	import { cn } from '$lib/utils.js';

	/**
	 * The range-calendar panel of `SuiDateRangePicker`: bits-ui's connected
	 * range calendar in the shadcn range-calendar parts.
	 */
	let {
		placeholder = $bindable(),
		locale,
		class: className = ''
	}: {
		placeholder: DateValue | undefined;
		locale: string;
		class?: string;
	} = $props();
</script>

<DateRangePicker.Calendar
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
							captionLayout="label"
							months={undefined}
							monthFormat="long"
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
</DateRangePicker.Calendar>
