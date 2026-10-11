<script lang="ts" module>
	import type { SuiDatePickerProps } from './date-picker.svelte';

	/**
	 * `SuiDatePicker` props in date-time mode: the value is a local ISO
	 * date-time (`'2026-10-11T14:30'`), the field shows date AND time
	 * segments, and the popover pairs the calendar with a column of time
	 * slots (`step` minutes apart) — pick a day, then a time.
	 */
	export type SuiDateTimePickerProps = Omit<SuiDatePickerProps, 'mode'>;
</script>

<script lang="ts">
	import DatePicker from './date-picker.svelte';

	let { value = $bindable<string | undefined>(undefined), ...rest }: SuiDateTimePickerProps =
		$props();

	let picker = $state<ReturnType<typeof DatePicker> | null>(null);

	/** Programmatically validate (e.g. on submit). */
	export function validate(): string[] {
		return picker?.validate() ?? [];
	}

	/** Reset validation state. */
	export function reset(): void {
		picker?.reset();
	}
</script>

<DatePicker bind:this={picker} mode="datetime" bind:value {...rest} />
