<script lang="ts">
	let { value }: { value: number } = $props();
</script>

<div
	class="bg-muted h-1.5 w-full max-w-28 overflow-hidden rounded-full"
	role="progressbar"
	aria-valuenow={value}
	aria-valuemin={0}
	aria-valuemax={100}
	aria-label="Progress"
>
	<div class="bg-primary h-full rounded-full" style="width: {value}%"></div>
</div>
