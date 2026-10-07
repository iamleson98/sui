<script lang="ts">
	let { value }: { value: number } = $props();
</script>

<div
	class="h-1.5 w-full max-w-28 overflow-hidden rounded-full bg-muted"
	role="progressbar"
	aria-valuenow={value}
	aria-valuemin={0}
	aria-valuemax={100}
	aria-label="Progress"
>
	<div class="h-full rounded-full bg-primary" style="width: {value}%"></div>
</div>
