<template>
	<text class="tm-status-tag" :style="statusStyle">{{ statusLabel }}</text>
</template>

<script>
	import { getCustomerStatusOption } from '@/common/customer-status.js';

	// 客户状态标签：inline style + App.vue 全局 CSS 双保险。
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
			statusStyle() {
				const className = getCustomerStatusOption(this.status).className || 'tm-status-tag--initial';
				const styleMap = {
					'tm-status-tag--initial': 'display:inline-block;padding:0 8px;line-height:20px;font-size:12px;border-radius:3px;background:#f2f4f7;color:#667085;border:1px solid #d9e0e8;',
					'tm-status-tag--positive': 'display:inline-block;padding:0 8px;line-height:20px;font-size:12px;border-radius:3px;background:#fff7e6;color:#b76e00;border:1px solid #f5c56b;',
					'tm-status-tag--difficult': 'display:inline-block;padding:0 8px;line-height:20px;font-size:12px;border-radius:3px;background:#f5f0ff;color:#7048a8;border:1px solid #c8b4ee;',
					'tm-status-tag--refunded': 'display:inline-block;padding:0 8px;line-height:20px;font-size:12px;border-radius:3px;background:#fff6ed;color:#c2611a;border:1px solid #f3c08a;',
					'tm-status-tag--invited': 'display:inline-block;padding:0 8px;line-height:20px;font-size:12px;border-radius:3px;background:#ecf5ff;color:#2878c8;border:1px solid #9ac8fa;',
					'tm-status-tag--success': 'display:inline-block;padding:0 8px;line-height:20px;font-size:12px;border-radius:3px;background:#edfff3;color:#18a058;border:1px solid #a8e5c0;',
					'tm-status-tag--danger': 'display:inline-block;padding:0 8px;line-height:20px;font-size:12px;border-radius:3px;background:#fff1f1;color:#d93025;border:1px solid #f2a7a7;',
				};
				return styleMap[className] || styleMap['tm-status-tag--initial'];
			}
		}
	};
</script>
