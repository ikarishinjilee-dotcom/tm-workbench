<template>
	<view :class="['customer-file-grid', { 'is-compact': compact }]">
		<view v-for="(file, index) in files" :key="index" class="customer-file-card">
			<view class="customer-file-card__preview" :class="fileClass(file)" @click="preview(file)">
				<view class="customer-file-card__type">{{ fileExt(file) }}</view>
				<image v-if="isImage(file) && !failedImages[fileUrl(file)]" class="customer-file-card__image"
					:src="fileUrl(file)" mode="aspectFill" @error="markImageFailed(file)"></image>
				<view v-else class="customer-file-card__icon">
					<text class="customer-file-card__fold"></text>
					<text class="customer-file-card__label">{{ fileIcon(file) }}</text>
				</view>
			</view>
			<view class="customer-file-card__info">
				<view class="customer-file-card__name" :title="fileName(file)">{{ fileName(file) }}</view>
				<view class="customer-file-card__meta"><text>{{ fileSize(file) }}</text><text>{{ fileDate(file) }}</text></view>
			</view>
			<view v-if="showDownload || showDelete" class="customer-file-card__actions">
				<el-button v-if="showDownload" type="text" size="mini" icon="el-icon-download" @click.stop="$emit('download', file)">下载</el-button>
				<el-button v-if="showDelete" type="text" size="mini" class="customer-file-card__delete" icon="el-icon-delete" @click.stop="$emit('remove', file, index)">删除</el-button>
			</view>
		</view>
		<el-dialog
			:visible.sync="previewVisible"
			append-to-body
			custom-class="customer-file-preview-dialog"
			width="82%"
			top="4vh"
			:show-close="true"
		>
			<view class="customer-file-preview-dialog__body">
				<image class="customer-file-preview-dialog__image" :src="previewUrl" mode="aspectFit"></image>
			</view>
		</el-dialog>
	</view>
</template>

<script>
	export default {
		name: 'CustomerFileGrid',
		props: {
			files: { type: Array, default: () => [] },
			showDownload: { type: Boolean, default: true },
			showDelete: { type: Boolean, default: false },
			compact: { type: Boolean, default: false },
		},
		data() {
			return { failedImages: {}, fallbackImages: {}, previewVisible: false, previewUrl: '' };
		},
		computed: {
			imageUrls() {
				return this.files.filter((file) => this.isImage(file) && this.fileUrl(file)).map((file) => this.fileUrl(file));
			},
		},
		methods: {
			originalFileUrl(file) {
				if (typeof file === 'string') return file;
				return file && (file.url || file.fileURL || file.fileID || file.file_id || file.tempFilePath || file.filePath) || '';
			},
			fileUrl(file) {
				const originalUrl = this.originalFileUrl(file);
				return this.fallbackImages[originalUrl] || originalUrl;
			},
			fileName(file) {
				const value = typeof file === 'string' ? file : file && (file.name || file.url || file.fileID || file.file_id || file.tempFilePath) || '';
				const name = value.split('?')[0].split('/').pop();
				try { return decodeURIComponent(name || '客户资料'); } catch (error) { return name || '客户资料'; }
			},
			fileExt(file) {
				const match = this.fileName(file).match(/\.([a-z0-9]+)$/i);
				return match ? match[1].toUpperCase() : 'FILE';
			},
			fileSize(file) {
				const size = typeof file === 'object' && file ? Number(file.size) : 0;
				if (!size) return '--';
				if (size < 1024) return `${size} B`;
				if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
				return `${(size / 1024 / 1024).toFixed(1)} MB`;
			},
			fileDate(file) {
				const value = typeof file === 'object' && file ? (file.uploaded_at || file.created_at) : 0;
				if (!value) return '--';
				const date = new Date(value);
				if (Number.isNaN(date.getTime())) return '--';
				return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
			},
			isImage(file) {
				return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(this.fileName(file));
			},
			fileClass(file) {
				const ext = this.fileExt(file).toLowerCase();
				if (['doc', 'docx'].includes(ext)) return 'is-word';
				if (['xls', 'xlsx'].includes(ext)) return 'is-excel';
				if (['ppt', 'pptx'].includes(ext)) return 'is-ppt';
				if (ext === 'pdf') return 'is-pdf';
				return 'is-file';
			},
			fileIcon(file) {
				const ext = this.fileExt(file).toLowerCase();
				if (['doc', 'docx'].includes(ext)) return 'W';
				if (['xls', 'xlsx'].includes(ext)) return 'X';
				if (['ppt', 'pptx'].includes(ext)) return 'P';
				if (ext === 'pdf') return 'PDF';
				return ext.toUpperCase() || 'FILE';
			},
			markImageFailed(file) {
				const originalUrl = this.originalFileUrl(file);
				if (originalUrl && originalUrl.includes('?') && !this.fallbackImages[originalUrl]) {
					this.$set(this.fallbackImages, originalUrl, originalUrl.split('?')[0]);
					return;
				}
				this.$set(this.failedImages, originalUrl, true);
			},
			preview(file) {
				if (!this.isImage(file) || !this.fileUrl(file)) return;
				this.previewUrl = this.fileUrl(file);
				this.previewVisible = true;
			},
		},
	};
</script>

<style lang="scss" scoped>
	.customer-file-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 12px;
	}

	.customer-file-card {
		min-width: 0;
		border: 1px solid #dbe5f2;
		border-radius: 6px;
		background: #fff;
		overflow: hidden;
	}

	.customer-file-card__preview {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 150px;
		background: #f4f7fb;
		cursor: pointer;
	}

	.customer-file-card__preview.is-excel { background: #eefaf3; }
	.customer-file-card__preview.is-word { background: #eef5ff; }
	.customer-file-card__preview.is-ppt { background: #fff5ed; }
	.customer-file-card__preview.is-pdf { background: #fff0f0; }

	.customer-file-card__type {
		position: absolute;
		top: 8px;
		right: 8px;
		z-index: 1;
		padding: 2px 5px;
		border-radius: 3px;
		background: #667085;
		color: #fff;
		font-size: 10px;
		font-weight: 700;
	}

	.customer-file-card__image {
		width: 100%;
		height: 100%;
	}

	.customer-file-card__icon {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 64px;
		height: 76px;
		border-radius: 4px;
		background: #66758d;
		color: #fff;
		font-size: 22px;
		font-weight: 700;
	}

	.customer-file-card__label { position: relative; z-index: 1; }
	.customer-file-card__preview.is-excel .customer-file-card__icon { background: #217346; }
	.customer-file-card__preview.is-word .customer-file-card__icon { background: #2b579a; }
	.customer-file-card__preview.is-ppt .customer-file-card__icon { background: #c65911; }
	.customer-file-card__preview.is-pdf .customer-file-card__icon { background: #d43838; }

	.customer-file-card__info { padding: 8px 10px 4px; }
	.customer-file-card__name { overflow: hidden; color: #344054; font-size: 13px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
	.customer-file-card__meta { display: flex; justify-content: space-between; gap: 8px; margin-top: 5px; color: #98a2b3; font-size: 11px; }
	.customer-file-card__actions { display: flex; justify-content: flex-end; gap: 8px; padding: 0 8px 7px; }
	.customer-file-card__delete { color: #f56c6c; }

	.customer-file-grid.is-compact {
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
	}

	.customer-file-grid.is-compact .customer-file-card__preview { height: 86px; }
	.customer-file-grid.is-compact .customer-file-card__info { padding: 6px 7px 5px; }
	.customer-file-grid.is-compact .customer-file-card__name { font-size: 11px; }
	.customer-file-grid.is-compact .customer-file-card__meta { font-size: 10px; }
	.customer-file-grid.is-compact .customer-file-card__type { top: 5px; right: 5px; padding: 1px 3px; font-size: 9px; }
	.customer-file-grid.is-compact .customer-file-card__icon { width: 42px; height: 52px; font-size: 16px; }
</style>

<style lang="scss">
/* 客户资料图片预览需要显示在客户详情弹窗之上。 */
.uni-image-viewer,
.uni-image-viewer-container,
.uni-image-viewer__wrapper,
.uni-image-viewer__mask,
.uni-image-viewer__content {
	z-index: 5000 !important;
}

.customer-file-preview-dialog.el-dialog {
	z-index: 6000 !important;
}

.customer-file-preview-dialog__body {
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 60vh;
	background: #111827;
}

.customer-file-preview-dialog__image {
	display: block;
	width: 100%;
	height: 72vh;
}
</style>
