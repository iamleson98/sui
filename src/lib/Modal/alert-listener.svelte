<script lang="ts">
	import { ALERT_MODAL_STORE } from './alert-modal.js';
	import AlertModal from './alert-modal.svelte';
</script>

<AlertModal
	open={!!$ALERT_MODAL_STORE}
	onCancel={$ALERT_MODAL_STORE?.onCancel}
	onOk={$ALERT_MODAL_STORE?.onOk}
	variant={$ALERT_MODAL_STORE?.variant}
>
	{#if $ALERT_MODAL_STORE}
		{#if typeof $ALERT_MODAL_STORE.content === 'string'}
			{$ALERT_MODAL_STORE.content}
		{:else}
			{@render $ALERT_MODAL_STORE.content()}
		{/if}
	{/if}
</AlertModal>
