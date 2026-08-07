<template>
	<text :class="['tm-status-tag', className]">{{ statusLabel }}</text>
</template>

<script>
	import { getCustomerStatusOption } from '@/common/customer-status.js';

	export default {
		name: 'StatusTag',
		props: {
			status: {
				type: String,
				default: '初步沟通'
			}
		},
		computed: {
			statusLabel() {
				return getCustomerStatusOption(this.status).label;
			},
			className() {
				return getCustomerStatusOption(this.status).className || 'tm-status-tag--initial';
			}
		}
	};
</script>
