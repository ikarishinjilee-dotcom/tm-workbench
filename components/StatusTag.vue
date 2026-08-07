<template>
	<view class="tm-status-tag" :style="statusStyle">
		{{ statusLabel }}
	</view>
</template>

<script>
	import { getCustomerStatusOption } from '@/common/customer-status.js';

	// 客户状态标签：按状态渲染不同字体色/背景色。
	// 用 inline style 而非 scoped CSS，保证在 vk-data-table 的 v-slot、弹窗等任何父组件插槽内都能正确显示颜色。
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
					'tm-status-tag--initial': 'background:#f2f4f7;color:#667085;border:1px solid #d9e0e8;',
					'tm-status-tag--positive': 'background:#fff7e6;color:#b76e00;border:1px solid #f5c56b;',
					'tm-status-tag--difficult': 'background:#f5f0ff;color:#7048a8;border:1px solid #c8b4ee;',
					'tm-status-tag--refunded': 'background:#fff6ed;color:#c2611a;border:1px solid #f3c08a;',
					'tm-status-tag--invited': 'background:#ecf5ff;color:#2878c8;border:1px solid #9ac8fa;',
					'tm-status-tag--success': 'background:#edfff3;color:#18a058;border:1px solid #a8e5c0;',
					'tm-status-tag--danger': 'background:#fff1f1;color:#d93025;border:1px solid #f2a7a7;',
				};
				const base = 'display:inline-block;padding:0 8px;line-height:20px;font-size:12px;border-radius:3px;white-space:nowrap;';
				return base + (styleMap[className] || styleMap['tm-status-tag--initial']);
			}
		}
	};
</script>
