<script lang="ts">
	import {
		type IconContent,
		TablerAlertCircle,
		TablerInfoCircle,
		TablerCheck,
		TablerHexagon
	} from '$lib/Icon/consts.js';
	import { Icon } from '$lib/Icon/index.js';
	import { Button } from '$lib/Button/index.js';
	import type { SocialVariant } from '$lib/utils/consts.js';
	import Modal from './modal.svelte';
	import { type ModalProps } from './types.js';

	type Props = Omit<ModalProps, 'hideHeader' | 'hideFooter' | 'header' | 'size' | 'onClose'> & {
		variant?: SocialVariant;
	};

	let {
		children,
		onOk,
		onCancel,
		okText = 'Ok',
		cancelText = 'Cancel',
		open,
		variant = 'warning'
	}: Props = $props();

	const VariantMap: Record<SocialVariant, { icon: IconContent; style: string }> = {
		success: {
			icon: TablerCheck,
			style: 'text-green-500'
		},
		error: {
			icon: TablerHexagon,
			style: 'text-red-500'
		},
		warning: {
			icon: TablerAlertCircle,
			style: 'text-orange-500'
		},
		info: {
			icon: TablerInfoCircle,
			style: 'text-blue-500'
		}
	};
</script>

<Modal header="" size="sm" hideFooter hideHeader {open} closeOnEscape closeOnOutsideClick>
	<div class={`${VariantMap[variant].style} flex justify-center py-2`}>
		<Icon icon={VariantMap[variant].icon} size="lg" />
	</div>

	<div class="flex justify-center text-center">
		{@render children()}
	</div>

	<div class="mt-5 flex justify-center gap-2">
		<Button size="sm" color={['success', 'info'].includes(variant) ? 'blue' : 'red'} onclick={onOk}>
			{okText}
		</Button>
		<Button
			size="sm"
			color={['success', 'info'].includes(variant) ? 'red' : 'blue'}
			onclick={onCancel}
		>
			{cancelText}
		</Button>
	</div>
</Modal>
