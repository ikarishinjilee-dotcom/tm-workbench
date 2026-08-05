<template>
	<view class="tm-status-tag" :class="statusClass">
		<el-tag size="mini" type="info">{{ statusLabel }}</el-tag>
	</view>
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
			statusClass() {
				return getCustomerStatusOption(this.status).className;
			}
		}
	};
</script>

<style lang="scss" scoped>
	.tm-status-tag {
		display: inline-block;
		white-space: nowrap;
		max-width: none;
		overflow: visible;
	}

	.tm-status-tag ::v-deep .el-tag {
		width: max-content;
		max-width: none;
		overflow: visible;
		text-overflow: clip;
		white-space: nowrap;
	}

	.tm-status-tag--initial ::v-deep .el-tag {
		border-color: #d9e0e8;
		background: #f2f4f7;
		color: #667085;
	}

	.tm-status-tag--positive ::v-deep .el-tag {
		border-color: #f5c56b;
		background: #fff7e6;
		color: #b76e00;
	}

	.tm-status-tag--difficult ::v-deep .el-tag {
		border-color: #c8b4ee;
		background: #f5f0ff;
		color: #7048a8;
	}

	.tm-status-tag--invited ::v-deep .el-tag {
		border-color: #9ac8fa;
		background: #ecf5ff;
		color: #2878c8;
	}

	.tm-status-tag--success ::v-deep .el-tag {
		border-color: #a8e5c0;
		background: #edfff3;
		color: #18a058;
	}

	.tm-status-tag--refunded ::v-deep .el-tag {
		border-color: #f3c08a;
		background: #fff6ed;
		color: #c2611a;
	}

	.tm-status-tag--danger ::v-deep .el-tag {
		border-color: #f2a7a7;
		background: #fff1f1;
		color: #d93025;
	}
</style>
