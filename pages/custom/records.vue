<template>
	<view class="page-body">
		<view class="vk-page-card vk-page-search-card">
			<vk-data-table-query v-model="query.formData" :columns="visibleQueryColumns" :span="4" :collapse-rows="1"
				:collapse-default-expand="true" @search="search">
			<template v-slot:_add_time_range="{ form }">
				<el-date-picker
					v-model="form._add_time_range"
					type="datetimerange"
					range-separator="至"
					start-placeholder="开始时间"
					end-placeholder="结束时间"
					value-format="timestamp"
					:picker-options="createdTimePickerOptions"
					class="customer-created-time-range"
				></el-date-picker>
			</template>
			</vk-data-table-query>
		</view>

		<view class="vk-page-card">
			<view class="vk-page-card-toolbar">
				<view class="vk-page-card-title">{{ showDeleted ? '已删除客户信息' : '客户信息管理' }}</view>
				<view class="vk-page-card-actions">
					<el-button v-if="isAdmin" :size="$global.size" :icon="showDeleted ? 'el-icon-menu' : 'el-icon-delete'" @click="toggleDeletedView">
						{{ showDeleted ? '客户信息管理' : '已删除客户信息' }}
					</el-button>
					<el-button :size="$global.size" icon="el-icon-download" @click="exportCustomers">导出Excel</el-button>
					<el-button v-if="canManageCustomers" :size="$global.size" icon="el-icon-upload2" :loading="importingCustomers" @click="chooseCustomerImportFile">导入Excel</el-button>
					<el-button v-if="canManageCustomers" :size="$global.size" icon="el-icon-document-copy" @click="downloadCustomerImportTemplate">下载导入模板</el-button>
					<el-button v-if="canManageCustomers" type="primary" :size="$global.size" icon="el-icon-plus" @click="add">{{ primaryActionText }}</el-button>
					<el-button :size="$global.size" icon="el-icon-refresh" @click="refresh">刷新</el-button>
				</view>
			</view>
			<view class="vk-page-card-table">
				<vk-data-table ref="table" :action="table.action" :columns="visibleTableColumns" :query-form-param="query"
					:right-btns="table.rightBtns" :custom-right-btns="table.customRightBtns" :row-no="true" :pagination="true" :top="0"
					@detail="showDetail" @update="update" @delete="remove" @row-click="openDetailFromRow">
					<template v-slot:parent_name="{ row }">
						<view :class="['customer-name-cell', { 'is-starred': row.is_starred }]">
							<text class="customer-name-text">{{ row.parent_name || '未命名客户' }}</text>
						</view>
					</template>
					<template v-slot:status="{ row }">
						<text class="tm-status-tag" :style="getRowStatusStyle(row.status)">{{ getRowStatusLabel(row.status) }}</text>
					</template>
					<template v-slot:is_deleted="{ row }">
						<el-tag v-if="row.is_deleted" type="danger" size="mini">已删除</el-tag>
					</template>
					<template v-slot:wechat_added="{ row }">
						<el-tag :type="row.wechat_added ? 'success' : 'info'" size="mini">
							<i :class="row.wechat_added ? 'el-icon-chat-dot-round' : 'el-icon-chat-line-round'"></i>
							{{ formatWechatAddedLabel(row.wechat_added) }}
						</el-tag>
					</template>
				</vk-data-table>
			</view>
		</view>

		<vk-data-dialog custom-class="customer-profile-dialog" v-model="form.show" :title="form.title" width="980px"
			top="3vh" mode="form" :close-on-click-modal="false" :destroy-on-close="true">
			<view class="customer-tabs customer-tab-switch">
				<el-button-group>
					<el-button size="small" :type="activeCustomerTab === 'info' ? 'primary' : 'default'" @click="activeCustomerTab = 'info'">信息</el-button>
					<el-button size="small" :type="activeCustomerTab === 'progress' ? 'primary' : 'default'" @click="activeCustomerTab = 'progress'">进度</el-button>
					<el-button size="small" :type="activeCustomerTab === 'signing' ? 'primary' : 'default'" @click="activeCustomerTab = 'signing'">签单</el-button>
					<el-button size="small" :type="activeCustomerTab === 'materials' ? 'primary' : 'default'" @click="activeCustomerTab = 'materials'">资料</el-button>
				</el-button-group>
				<view class="customer-tabs__actions">
					<view v-if="canAssignConsultantInForm" class="customer-tabs__consultant">
						<text class="customer-tabs__consultant-label">咨询师</text>
						<el-select v-model="form.data.consultant_id" size="small" filterable placeholder="请选择咨询师" :disabled="isLeadProviderConsultantLocked(form.data)">
							<el-option v-for="item in consultantOptions" :key="item.value" :label="item.label" :value="item.value"></el-option>
						</el-select>
					</view>
					<el-button v-if="form.data._id && canEditWorkflow" plain type="warning" size="small" icon="el-icon-sort" @click="openTransferFromForm">转移客户</el-button>
				</view>
			</view>
			<view v-if="activeCustomerTab === 'info'" class="customer-tab-content">
				<view v-if="form.data._id && form.data.followup_records && form.data.followup_records.length" class="status-sync-hint">
					当前状态由最新进度自动同步，如需调整请前往“进度”添加或编辑进度记录。
					<el-button v-if="canEditWorkflow" type="text" size="mini" @click="activeCustomerTab = 'progress'">去进度</el-button>
				</view>
					<vk-data-form ref="customerForm" v-model="form.data" :rules="visibleFormRules" :action="form.action" :form-type="form.type"
						:columns="visibleFormColumns" label-width="110px" :need-alert="false" :auto-close="true" @success="success"></vk-data-form>
			</view>
			<view v-else-if="activeCustomerTab === 'progress'" class="customer-tab-content">
					<view class="followup-panel">
						<view class="followup-panel__header">
							<view class="followup-panel__title"><text class="followup-panel__line"></text>进度记录</view>
							<el-button v-if="canEditWorkflow" type="primary" size="mini" icon="el-icon-plus" :disabled="!form.data._id"
								@click="openFollowup">添加进度</el-button>
						</view>
						<view v-if="!form.data._id" class="followup-empty">请先保存客户资料，再添加进度</view>
						<view v-else-if="!form.data.followup_records || !form.data.followup_records.length" class="followup-empty">暂无进度记录，点击右上角添加进度</view>
						<view v-else class="followup-list">
							<view v-for="(record, index) in form.data.followup_records" :key="record._id || index" class="followup-item">
								<view class="followup-item__dot"></view>
								<view class="followup-item__body">
									<view class="followup-item__meta">
										<view class="followup-item__time">{{ formatFollowupTime(record.contact_time) }}</view>
										<status-tag :status="record.status"></status-tag>
										<view class="followup-item__operator">{{ formatFollowupOperator(record) }}</view>
									</view>
									<view v-if="isTransferRecord(record)" class="followup-item__content followup-transfer-content">
										咨询师：<text class="followup-transfer-name followup-transfer-name--from">{{ transferConsultants(record).from }}</text>
										<text> 变更为 </text><text class="followup-transfer-name followup-transfer-name--to">{{ transferConsultants(record).to }}</text>
									</view>
							<view v-else-if="isSystemRecord(record)" class="followup-item__content followup-system-content"><text>{{ systemRecordPrefix(record) }}</text><text :class="systemRecordAction(record) === 'delete' ? 'followup-system-action--delete' : 'followup-system-action--restore'">{{ systemRecordAction(record) === 'delete' ? '删除' : '恢复' }}</text></view>
							<view v-else class="followup-item__content">{{ record.content }}</view>
								</view>
						<view class="followup-item__actions">
							<el-button v-if="canEditFollowupRecord(record)" type="text" size="mini" @click="editFollowup(record, index)">编辑</el-button>
							<el-button v-if="canEditWorkflow && !isSystemRecord(record) && !isTransferRecord(record)" type="text" size="mini" class="followup-delete" @click="removeFollowup(record, index)">删除</el-button>
								</view>
							</view>
						</view>
					</view>
			</view>
			<view v-else-if="activeCustomerTab === 'signing'" class="customer-tab-content signing-content">
				<view class="signing-panel">
					<view class="signing-panel__title"><text class="followup-panel__line"></text>签单信息</view>
					<view v-if="!canEditWorkflow" class="signing-panel__hint">当前角色可查看签单信息，但不能编辑。</view>
					<view v-else-if="!isSigningEditable(form.data)" class="signing-panel__hint">客户状态为“已签单”后才可以编辑签单信息，当前内容仍会保留。</view>
					<view class="signing-fields">
						<view class="signing-field">
							<view class="signing-field__label">签单省份</view>
							<el-select v-model="form.data.signing_province" :disabled="!canEditWorkflow || !isSigningEditable(form.data)" placeholder="请选择签单省份" filterable>
								<el-option v-for="item in signingProvinceOptions" :key="item.value" :label="item.label" :value="item.value"></el-option>
							</el-select>
						</view>
						<view class="signing-field">
							<view class="signing-field__label">签单城市</view>
							<el-input v-model="form.data.signing_city" :disabled="!canEditWorkflow || !isSigningEditable(form.data)" placeholder="请输入签单城市"></el-input>
						</view>
						<view class="signing-field">
							<view class="signing-field__label">合同金额</view>
							<el-input v-model="form.data.contract_amount" :disabled="!canEditWorkflow || !isSigningEditable(form.data)" placeholder="请输入合同金额" @input="filterContractAmount"></el-input>
						</view>
						<view class="signing-field signing-field--full">
							<view class="signing-field__label">合同主要内容</view>
							<el-input v-model="form.data.contract_content" :disabled="!canEditWorkflow || !isSigningEditable(form.data)" type="textarea" :rows="8" placeholder="请输入合同主要内容"></el-input>
						</view>
					</view>
				</view>
			</view>
			<view v-else class="customer-tab-content materials-content">
				<view class="materials-panel">
					<view class="materials-panel__title"><text class="followup-panel__line"></text>客户资料</view>
					<view class="materials-panel__tips">可上传客户相关图片、合同、成绩单等文件，单个客户最多保存 30 份资料。</view>
					<view v-if="canEditWorkflow" class="materials-panel__upload">
						<vk-data-upload v-model="form.data.attachments" :limit="30" upload-type="file" list-type="text"
							accept=".jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf" button-text="上传资料"
							:file-size="20" size-unit="MB" :show-file-list="false" :http-request="uploadMaterialFile"></vk-data-upload>
					</view>
					<view v-if="materialFiles.length" class="materials-panel__files">
						<customer-file-grid :files="materialFiles" :show-download="true" :show-delete="canEditWorkflow"
							@download="downloadMaterial" @remove="removeMaterial"></customer-file-grid>
					</view>
					<view v-if="!canEditWorkflow" class="materials-panel__empty">当前角色可查看客户资料，但不能上传或删除。</view>
					<view v-if="!form.data._id" class="materials-panel__empty">保存客户资料后，上传的文件才会与客户绑定。</view>
				</view>
			</view>
			<view class="customer-profile-footer">
				<el-button :disabled="form.submitting" @click="closeCustomerDialog">关闭</el-button>
				<el-button type="primary" :loading="form.submitting" :disabled="form.submitting" @click="submitCustomerDialog">确定</el-button>
			</view>
		</vk-data-dialog>

		<vk-data-dialog custom-class="customer-detail-dialog" v-model="detail.show" title="" width="calc(100vw - 250px)"
			top="2vh" :close-on-click-modal="false" :destroy-on-close="true">
			<view class="customer-detail-shell">
				<view class="customer-detail-heading">客户详情</view>
				<view class="customer-detail-profile">
					<view class="customer-detail-profile__identity">
						<view class="customer-detail-profile__name">{{ detail.data.parent_name || '未命名客户' }}</view>
						<status-tag :status="detail.data.status"></status-tag>
						<el-tag v-if="detail.data.is_deleted" type="danger" size="mini">已删除</el-tag>
						<view v-if="detail.data.wechat_added" class="customer-detail-wechat"><el-tag type="success" size="mini"><i class="el-icon-chat-dot-round"></i> 已加微信</el-tag></view>
						<view v-if="isAdmin || isLeadProviderRole" class="customer-detail-consultant"><i class="el-icon-user"></i> 咨询师：{{ detail.data.consultant_name || '未分配' }}</view>
					</view>
					<view v-if="!detail.data.is_deleted && canManageCustomers" class="customer-detail-profile__actions">
						<el-button plain type="primary" icon="el-icon-edit" @click="editFromDetail">{{ isLeadProviderRole ? '编辑信息' : '编辑资料' }}</el-button>
						<el-button v-if="canStarCustomers" plain :class="['detail-focus-action', { 'is-starred': detail.data.is_starred }]"
							:icon="detail.data.is_starred ? 'el-icon-star-on' : 'el-icon-star-off'" @click="toggleStar(detail.data)">
							{{ detail.data.is_starred ? '取消重点' : '设为重点' }}
						</el-button>
						<el-button v-if="canEditWorkflow" plain type="warning" icon="el-icon-sort" @click="openTransfer(detail.data)">转移客户</el-button>
						<el-button v-if="canEditWorkflow" plain type="danger" icon="el-icon-delete" @click="removeFromDetail">删除客户</el-button>
					</view>
					<view v-else-if="isAdmin" class="customer-detail-profile__actions">
						<el-button plain type="danger" icon="el-icon-warning-outline" @click="hardDeleteFromDetail">彻底删除</el-button>
					</view>
				</view>
				<view class="customer-detail-tabs">
					<view :class="['customer-detail-tab', { 'is-active': detail.activeTab === 'info' }]" @click="detail.activeTab = 'info'">信息</view>
					<view :class="['customer-detail-tab', { 'is-active': detail.activeTab === 'progress' }]" @click="detail.activeTab = 'progress'">进度</view>
					<view :class="['customer-detail-tab', { 'is-active': detail.activeTab === 'signing' }]" @click="detail.activeTab = 'signing'">签单</view>
					<view :class="['customer-detail-tab', { 'is-active': detail.activeTab === 'materials' }]" @click="detail.activeTab = 'materials'">资料</view>
				</view>

				<view v-if="detail.activeTab === 'info'" class="customer-detail-view">
					<view class="customer-detail-summary">
						<view class="customer-detail-summary__item"><i class="el-icon-phone"></i><view><text>联系电话</text><strong>{{ detail.data.contact_phone || '未填写' }}</strong></view></view>
						<view class="customer-detail-summary__item is-green"><vk-data-icon class="customer-detail-wechat-icon" name="vk-icon-weixin" :size="22" color="#24db5a"></vk-data-icon><view><text>微信号</text><strong>{{ detail.data.wechat || '未填写' }}</strong></view></view>
						<view class="customer-detail-summary__item"><i class="el-icon-sell"></i><view><text>线索来源</text><strong>{{ formatSourceLabel(detail.data.source) || '未填写' }}</strong></view></view>
						<view class="customer-detail-summary__item is-orange"><i class="el-icon-money"></i><view><text>线索成本</text><strong>{{ formatClueCost(detail.data.clue_cost) }} 元</strong></view></view>
						<view class="customer-detail-summary__item customer-detail-summary__item--time"><i class="el-icon-time"></i><view><text>创建时间</text><strong><text>{{ formatDetailDate(detail.data._add_time) }}</text><text>{{ formatDetailClock(detail.data._add_time) }}</text></strong></view></view>
						<view class="customer-detail-summary__item is-wide"><i class="el-icon-location"></i><view><text>所在地区</text><strong>{{ formatDetailRegion(detail.data.region) || '未填写' }}</strong></view></view>
					</view>
					<view class="customer-detail-layout">
						<view class="customer-detail-main">
							<view class="customer-detail-card">
								<view class="customer-detail-card__title"><i></i>基础信息</view>
								<view class="customer-detail-fields">
									<view class="customer-detail-field"><i class="el-icon-s-custom"></i><span>状态</span><status-tag :status="detail.data.status"></status-tag></view>
									<view class="customer-detail-field"><i class="el-icon-link"></i><span>线索来源</span><strong>{{ formatSourceLabel(detail.data.source) || '未填写' }}</strong></view>
									<view class="customer-detail-field"><i class="el-icon-user"></i><span>家长姓名</span><strong>{{ detail.data.parent_name || '未填写' }}</strong></view>
									<view class="customer-detail-field"><i class="el-icon-money"></i><span>线索成本/元</span><strong>{{ formatClueCost(detail.data.clue_cost) }}</strong></view>
									<view class="customer-detail-field"><i class="el-icon-phone"></i><span>联系电话</span><strong>{{ detail.data.contact_phone || '未填写' }}</strong></view>
									<view class="customer-detail-field"><i class="el-icon-location"></i><span>所在地区</span><strong>{{ formatDetailRegion(detail.data.region) || '未填写' }}</strong></view>
									<view class="customer-detail-field"><i class="el-icon-success"></i><span>是否加微信</span><el-tag :type="detail.data.wechat_added ? 'success' : 'info'" size="mini"><i :class="detail.data.wechat_added ? 'el-icon-chat-dot-round' : 'el-icon-chat-line-round'"></i> {{ detail.data.wechat_added ? '已加' : '未加' }}</el-tag></view>
									<view class="customer-detail-field"><i class="el-icon-document"></i><span>详细地址</span><strong>{{ detail.data.detail_address || '未填写' }}</strong></view>
									<view class="customer-detail-field"><i class="el-icon-chat-dot-round"></i><span>微信号</span><strong>{{ detail.data.wechat || '未填写' }}</strong></view>
									<view class="customer-detail-field"><i class="el-icon-time"></i><span>创建时间</span><strong>{{ formatDetailTime(detail.data._add_time) }}</strong></view>
								</view>
							</view>
							<view class="customer-detail-card">
								<view class="customer-detail-card__title"><i></i>学生信息</view>
								<view class="customer-detail-fields customer-detail-fields--student">
									<view class="customer-detail-field"><i class="el-icon-user"></i><span>孩子姓名</span><strong>{{ detail.data.child_name || '未填写' }}</strong></view>
									<view class="customer-detail-field"><i class="el-icon-school"></i><span>孩子年级</span><strong>{{ detail.data.child_grade || '未填写' }}</strong></view>
								</view>
								<view class="customer-detail-text-row"><span>孩子学习情况</span><strong>{{ detail.data.study_status || '未填写' }}</strong></view>
							</view>
							<view class="customer-detail-card">
								<view class="customer-detail-card__title"><i></i>意向信息</view>
								<view class="customer-detail-regions"><span>意向地区</span><view><el-tag v-for="region in (detail.data.intended_regions || [])" :key="region" size="small" type="primary">{{ region }}</el-tag><em v-if="!(detail.data.intended_regions || []).length">未填写</em></view></view>
								<view class="customer-detail-text-row"><span>详细城市</span><strong>{{ detail.data.intended_region_remark || '未填写' }}</strong></view>
							</view>
							<view class="customer-detail-card">
								<view class="customer-detail-card__title"><i></i>备注信息</view>
								<view class="customer-detail-text-row"><span>备注内容</span><strong>{{ detail.data.remark || '未填写' }}</strong></view>
							</view>
						</view>
						<view class="customer-detail-side">
							<view class="customer-detail-card">
								<view class="customer-detail-side-title"><view><i></i>最近进度</view><el-button type="text" @click="handleDetailCommand('progress')">查看全部<i class="el-icon-arrow-right"></i></el-button></view>
								<view v-if="detail.data.followup_records && detail.data.followup_records.length" class="customer-detail-recent">
									<view class="customer-detail-recent__dot"></view><view><view class="customer-detail-recent__meta">{{ formatFollowupTime(detail.data.followup_records[0].contact_time) }} <status-tag :status="detail.data.followup_records[0].status"></status-tag></view><strong v-if="isTransferRecord(detail.data.followup_records[0])" class="followup-transfer-content">咨询师：<text class="followup-transfer-name followup-transfer-name--from">{{ transferConsultants(detail.data.followup_records[0]).from }}</text><text> 变更为 </text><text class="followup-transfer-name followup-transfer-name--to">{{ transferConsultants(detail.data.followup_records[0]).to }}</text></strong><strong v-else-if="isSystemRecord(detail.data.followup_records[0])" class="followup-system-content"><text>{{ systemRecordPrefix(detail.data.followup_records[0]) }}</text><text :class="systemRecordAction(detail.data.followup_records[0]) === 'delete' ? 'followup-system-action--delete' : 'followup-system-action--restore'">{{ systemRecordAction(detail.data.followup_records[0]) === 'delete' ? '删除' : '恢复' }}</text></strong><strong v-else>{{ detail.data.followup_records[0].content }}</strong></view>
								</view>
								<view v-else class="customer-detail-empty">暂无进度记录</view>
								<el-button class="customer-detail-card__link" type="text" @click="handleDetailCommand('progress')">查看全部进度记录</el-button>
							</view>
							<view class="customer-detail-card">
								<view class="customer-detail-side-title"><view><i></i>资料概览</view><span>共 {{ detailFiles.length }} 份资料</span></view>
								<customer-file-grid :files="detailFiles.slice(0, 5)" :show-download="false" :show-delete="false" :compact="true"></customer-file-grid>
								<view v-if="!detailFiles.length" class="customer-detail-empty">暂无客户资料</view>
								<el-button class="customer-detail-card__link" type="text" @click="handleDetailCommand('materials')">查看全部资料</el-button>
							</view>
						</view>
					</view>
				</view>
				<view v-else-if="detail.activeTab === 'progress'" class="customer-detail-tab-panel"><view class="followup-panel"><view class="followup-panel__header"><view class="followup-panel__title"><text class="followup-panel__line"></text>进度记录</view><el-button v-if="!detail.data.is_deleted && canEditWorkflow" type="primary" size="mini" icon="el-icon-plus" @click="addFollowupFromDetail">新增进度</el-button></view><view v-for="(record, index) in detail.data.followup_records || []" :key="record._id || index" class="followup-item"><view class="followup-item__dot"></view><view class="followup-item__body"><view class="followup-item__meta"><view class="followup-item__time">{{ formatFollowupTime(record.contact_time) }}</view><status-tag :status="record.status"></status-tag><view class="followup-item__operator">{{ formatFollowupOperator(record) }}</view></view><view v-if="isTransferRecord(record)" class="followup-item__content followup-transfer-content">咨询师：<text class="followup-transfer-name followup-transfer-name--from">{{ transferConsultants(record).from }}</text><text> 变更为 </text><text class="followup-transfer-name followup-transfer-name--to">{{ transferConsultants(record).to }}</text></view><view v-else-if="isSystemRecord(record)" class="followup-item__content followup-system-content"><text>{{ systemRecordPrefix(record) }}</text><text :class="systemRecordAction(record) === 'delete' ? 'followup-system-action--delete' : 'followup-system-action--restore'">{{ systemRecordAction(record) === 'delete' ? '删除' : '恢复' }}</text></view><view v-else class="followup-item__content">{{ record.content }}</view></view><view class="followup-item__actions"><el-button v-if="canEditFollowupRecord(record) && !detail.data.is_deleted" type="text" size="mini" @click="editFollowupFromDetail(record)">编辑</el-button><el-button v-if="canEditWorkflow && !detail.data.is_deleted && !isSystemRecord(record) && !isTransferRecord(record)" type="text" size="mini" class="followup-delete" @click="removeFollowupFromDetail(record, index)">删除</el-button></view></view><view v-if="!(detail.data.followup_records || []).length" class="followup-empty">暂无进度记录</view></view></view>
				<view v-else-if="detail.activeTab === 'signing'" class="customer-detail-tab-panel signing-detail-panel"><view class="customer-detail-card"><view class="customer-detail-card__title"><i></i>签单信息</view><view v-if="!isSigningEditable(detail.data)" class="signing-panel__hint">客户状态为“已签单”时可编辑，当前状态下签单内容只读。</view><view class="customer-detail-fields signing-detail-fields"><view class="customer-detail-field"><i class="el-icon-location"></i><span>签单省份</span><strong>{{ detail.data.signing_province || '未填写' }}</strong></view><view class="customer-detail-field"><i class="el-icon-map-location"></i><span>签单城市</span><strong>{{ detail.data.signing_city || '未填写' }}</strong></view><view class="customer-detail-field"><i class="el-icon-money"></i><span>合同金额</span><strong>{{ detail.data.contract_amount || '未填写' }}</strong></view><view class="customer-detail-text-row"><span>合同主要内容</span><strong>{{ detail.data.contract_content || '未填写' }}</strong></view></view></view></view>
				<view v-else class="customer-detail-tab-panel"><view class="customer-detail-card customer-detail-materials-panel"><view class="customer-detail-card__title"><i></i>客户资料</view><customer-file-grid :files="detailFiles" :show-download="true" :show-delete="false" @download="downloadMaterial"></customer-file-grid><view v-if="!detailFiles.length" class="customer-detail-empty">暂无客户资料</view></view></view>
			</view>
		</vk-data-dialog>

		<vk-data-dialog v-model="transfer.show" title="转移客户" width="520px" top="20vh" mode="form"
			:close-on-click-modal="false" :destroy-on-close="true">
			<vk-data-form v-model="transfer.form.data" :rules="transfer.form.rules" :action="transfer.form.action"
				:form-type="transfer.form.type" :columns="transfer.form.columns" label-width="100px" :need-alert="false"
				:auto-close="true" @success="transferSuccess"></vk-data-form>
		</vk-data-dialog>

		<vk-data-dialog v-model="followup.show" :title="followup.form.type === 'update' ? '编辑进度' : '添加进度'" width="560px" top="18vh"
			mode="form" :close-on-click-modal="false" :destroy-on-close="true">
			<vk-data-form v-model="followup.form.data" :rules="followup.form.rules" :action="followup.form.action"
				:form-type="followup.form.type" :columns="followup.form.columns" label-width="90px" :need-alert="false"
				:auto-close="true" @success="followupSuccess"></vk-data-form>
		</vk-data-dialog>
	</view>
</template>

<script>
	import StatusTag from '@/components/StatusTag.vue';
	import CustomerFileGrid from '@/components/CustomerFileGrid.vue';
	import { customerStatusOptions, normalizeCustomerStatus, getCustomerStatusOption, applyCustomerStatusOptions } from '@/common/customer-status.js';
	let vk = uni.vk;
	const statusOptions = customerStatusOptions;
	const postConvertedStatusValues = ['converted', 'refunded'];
	const adminRoleKeys = ['admin', 'super_admin', 'administrator'];
	const importHeaderFieldMap = {
		'家长姓名': 'parent_name',
		'姓名': 'parent_name',
		'客户姓名': 'parent_name',
		'创建时间': '_add_time',
		'状态': 'status',
		'咨询师ID': 'consultant_id',
		'咨询师': 'consultant_name',
		'线索来源': 'source',
		'线索成本': 'clue_cost',
		'线索成本/元': 'clue_cost',
		'联系电话': 'contact_phone',
		'手机号': 'contact_phone',
		'手机号码': 'contact_phone',
		'是否加微信': 'wechat_added',
		'微信号': 'wechat',
		'微信': 'wechat',
		'详细地址': 'detail_address',
		'孩子姓名': 'child_name',
		'孩子年级': 'child_grade',
		'孩子学习情况': 'study_status',
		'意向地区': 'intended_regions',
		'详细城市': 'intended_region_remark',
		'最近进度': 'progress',
		'备注': 'remark',
		'备注内容': 'remark',
		'签单省份': 'signing_province',
		'签单城市': 'signing_city',
		'合同金额': 'contract_amount',
		'合同主要内容': 'contract_content',
	};
	const yesValues = ['是', '已加', '已加微信', 'yes', 'y', 'true', '1'];
	const noValues = ['否', '未加', '未加微信', 'no', 'n', 'false', '0'];
	const wechatAddedOptions = [
		{ value: true, label: '已加微信' },
		{ value: false, label: '未加微信' }
	];
	const starredOptions = [
		{ value: true, label: '重点客户' },
		{ value: false, label: '普通客户' }
	];
	// 线索来源使用稳定编码，显示名称可以独立调整，不参与业务判断
	const sourceOptions = [
		{ value: 'live_teacher_zhou', label: '直播（周老师）' },
		{ value: 'wechat_channels_promotion', label: '视频号线索' },
		{ value: 'douyin_promotion', label: '抖音线索' },
		{ value: 'old_customer', label: '老客户' },
		{ value: 'customer_referral', label: '客户转介绍' },
		{ value: 'other', label: '其他来源' }
	];
	const paidSourceValues = ['wechat_channels_promotion', 'douyin_promotion'];
	const legacySourceValueMap = {
		'直播（周老师）': 'live_teacher_zhou',
		'视频号线索': 'wechat_channels_promotion',
		'抖音线索': 'douyin_promotion',
		wechat_channels: 'wechat_channels_promotion',
		douyin: 'douyin_promotion',
		'老客户': 'old_customer',
		'客户转介绍': 'customer_referral',
		'其他': 'other'
	};
	const normalizeSourceValue = (value) => legacySourceValueMap[value] || value;
	const sourceLabelMap = sourceOptions.reduce((map, item) => {
		map[item.value] = item.label;
		return map;
	}, {});
	const hiddenSourceValues = new Set(
		(sourceOptions || []).filter((item) => item.enabled === false).map((item) => item.value)
	);
	const sourceImportValueMap = sourceOptions.reduce((map, item) => {
		map[item.label] = item.value;
		map[item.value] = item.value;
		return map;
	}, {});
	// 历史兼容：早期历史客户可能保存 source='live'，前端需能渲染为"直播来源"以保证可读性。
	sourceLabelMap.live = '直播来源';
	const formatSourceLabel = (value) => {
		const normalized = normalizeSourceValue(value);
		const baseLabel = sourceLabelMap[normalized] || value || '';
		if (!baseLabel) return '';
		// 直播老师账号被冻结/封禁时，给来源标签追加"（已隐藏）"提示，便于识别历史来源但不再可选。
		return hiddenSourceValues.has(normalized) ? `${baseLabel}（已隐藏）` : baseLabel;
	};
	const formatStatusLabel = (value) => getCustomerStatusOption(value).label || value || '';
	const formatWechatAddedLabel = (value) => [true, 1, 'true', '1'].includes(value) ? '已加微信' : '未加微信';
	const formatFollowupRecordTime = (value) => {
		if (!value) return '';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return String(value);
		const pad = (number) => String(number).padStart(2, '0');
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
	};
	const getFollowupRecordTime = (record = {}) => {
		const fields = [record.contact_time, record.update_time, record.create_time, record._add_time];
		for (const value of fields) {
			if (!value) continue;
			const time = new Date(value).getTime();
			if (!Number.isNaN(time)) return time;
			const numericValue = Number(value);
			if (Number.isFinite(numericValue) && numericValue > 0) return numericValue;
		}
		return 0;
	};
	const formatFollowupOperatorForExport = (record = {}) => {
		if (record.last_operator_name) return `编辑人：${record.last_operator_name}`;
		if (record.operator_name) return `记录人：${record.operator_name}`;
		if (record.consultant_name) return `记录人：${record.consultant_name}`;
		return '';
	};
	const formatCustomerFollowups = (value, row = {}) => {
		const records = Array.isArray(row.followup_records) ? row.followup_records : [];
		if (!records.length) return value || '';
		return [...records].sort((a, b) => getFollowupRecordTime(b) - getFollowupRecordTime(a)).map((record, index) => {
			const parts = [];
			const time = formatFollowupRecordTime(record.contact_time || record.update_time || record.create_time);
			if (time) parts.push(time);
			if (record.status) parts.push(formatStatusLabel(record.status));
			const content = String(record.content || '').trim();
			const operator = formatFollowupOperatorForExport(record);
			const mainText = [parts.join(' '), content].filter(Boolean).join('：');
			return `${index + 1}. ${mainText}${operator ? `（${operator}）` : ''}`;
		}).filter(Boolean).join('\n');
	};
	const roleSourceScopeMap = {
		live_teacher: ['live_teacher_zhou'],
		'直播老师': ['live_teacher_zhou'],
		traffic_teacher: ['wechat_channels_promotion', 'douyin_promotion'],
		'投流老师': ['wechat_channels_promotion', 'douyin_promotion']
	};
	const fuzzyRoleSourceScopeList = [
		{ keywords: ['直播'], sources: ['live_teacher_zhou'] },
		{ keywords: ['投流'], sources: ['wechat_channels_promotion', 'douyin_promotion'] }
	];
	const leadProviderIdentityKeywords = ['直播', '投流', '视频号', '抖音'];
	const isConsultantOptionCandidate = (item = {}) => {
		if (!item || !item._id || item.status === 1 || item.allow_login_background === false) return false;
		const values = [
			item.username,
			item.nickname,
			item.realname,
			...(Array.isArray(item.role) ? item.role : [item.role]),
			...(Array.isArray(item.roles) ? item.roles : [item.roles]),
			...(Array.isArray(item.role_id) ? item.role_id : [item.role_id]),
			...(Array.isArray(item.roleIds) ? item.roleIds : [item.roleIds])
		].flatMap((value) => {
			if (!value) return [];
			if (typeof value === 'object') return [value.role_id, value.value, value.role_name, value.name].filter(Boolean);
			return [value];
		});
		return !values.some((value) => leadProviderIdentityKeywords.some((keyword) => String(value).includes(keyword)));
	};
	// 地址组件只接受每一级都带 code/name 的对象，兼容历史字符串和不完整数据。
	const normalizeRegionForForm = (region) => {
		if (!region || typeof region !== 'object' || Array.isArray(region)) return {};
		const normalized = {};
		['province', 'city', 'area'].forEach((level) => {
			const item = region[level];
			if (item && typeof item === 'object' && item.code) {
				normalized[level] = {
					code: item.code,
					name: item.name || item.label || ''
				};
			}
		});
		return normalized;
	};
	const intendedRegionOptions = ['黑龙江', '吉林', '辽宁', '新疆', '内蒙古', '重庆', '海南', '西藏', '青海', '宁夏'].map((value) => ({
		value,
		label: value
	}));
	const signingProvinceOptions = ['黑龙江', '吉林', '辽宁', '重庆', '海南', '内蒙古', '新疆', '青海', '宁夏', '西藏', '北京', '天津', '河北', '山西', '上海', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '广西', '四川', '贵州', '云南', '陕西', '甘肃', '香港', '澳门', '台湾'].map((value) => ({
		value,
		label: value
	}));
	const tableWidth = (normal, compact) => {
		try {
			return uni.getSystemInfoSync().windowWidth <= 600 ? compact : normal;
		} catch (error) {
			return normal;
		}
	};

	export default {
		components: {
			StatusTag,
			CustomerFileGrid
		},
		data() {
			return {
				activeCustomerTab: 'info',
				signingProvinceOptions,
				showDeleted: false,
				accessProfile: {
					loaded: false,
					is_admin: false,
					is_lead_provider: false,
					visible_sources: [],
					source_options: [],
					source_options: [],
					role_keys: [],
				},
				consultantOptions: [],
				materialFiles: [],
				importingCustomers: false,
				routeCustomerId: '',
				routeAddOpened: false,
				routeSource: '',
				routeSource: '',
				detail: {
					show: false,
					data: {},
					activeTab: 'info'
				},
				detailFiles: [],
				transfer: {
					show: false,
					form: {
						action: 'business/custom2.transfer',
						type: 'add',
						data: {},
						rules: {
							target_consultant_id: [{ required: true, message: '请选择目标咨询师', trigger: 'change' }],
						},
						columns: [{
							key: 'target_consultant_id',
							title: '目标咨询师',
							type: 'select',
							span: 24,
							data: [],
							placeholder: '请选择目标咨询师',
						}],
					},
				},
				table: {
					action: 'business/custom2.getList',
					columns: [{
							key: 'parent_name',
							title: '家长姓名',
							type: 'text',
							width: tableWidth(120, 92)
						},
						{
							key: '_add_time',
							title: '创建时间',
							type: 'time',
							width: tableWidth(150, 118),
							valueFormat: 'yyyy-MM-dd hh:mm'
						},

						{
							key: 'consultant_name',
							title: '咨询师',
							type: 'text',
							width: tableWidth(110, 82)
						},
						{
							key: 'status',
							title: '状态',
							type: 'text',
							width: tableWidth(150, 132),
							formatter: (value) => formatStatusLabel(value)
						},
						{
							key: 'is_deleted',
							title: '删除状态',
							type: 'text',
							width: tableWidth(90, 78),
							formatter: (value) => value ? '已删除' : '正常'
						},
						{
							key: 'source',
							title: '线索来源',
							type: 'text',
							width: tableWidth(130, 100),
							formatter: (value) => this.formatSourceLabel(value)
						},
						{
							key: 'clue_cost',
							title: '线索成本/元',
							type: 'money',
							width: tableWidth(120, 96)
						},
						{
							key: 'contact_phone',
							title: '联系电话',
							type: 'text',
							width: tableWidth(140, 112)
						},
						{
							key: 'wechat_added',
							title: '是否加微信',
							width: tableWidth(110, 92)
						},
						{
							key: 'wechat',
							title: '微信号',
							type: 'text',
							width: tableWidth(130, 100)
						},
						{
							key: 'region',
							title: '所在地区',
							type: 'address',
							width: tableWidth(180, 130)
						},
						{
							key: 'detail_address',
							title: '详细地址',
							type: 'text',
							width: tableWidth(180, 130)
						},
						{
							key: 'child_name',
							title: '孩子姓名',
							type: 'text',
							width: tableWidth(110, 90)
						},
						{
							key: 'child_grade',
							title: '孩子年级',
							type: 'text',
							width: tableWidth(110, 90)
						},
						{
							key: 'study_status',
							title: '孩子学习情况',
							type: 'textarea',
							width: tableWidth(180, 140)
						},
						{
							key: 'intended_regions',
							title: '意向地区',
							type: 'checkbox',
							width: tableWidth(180, 140),
							data: intendedRegionOptions
						},
						{
							key: 'intended_region_remark',
							title: '详细城市',
							type: 'text',
							width: tableWidth(180, 140)
						},
						{
							key: 'progress',
							title: '进度记录',
							type: 'textarea',
							width: tableWidth(320, 220),
							formatter: (value, row) => formatCustomerFollowups(value, row)
						},
						{
							key: 'remark',
							title: '备注',
							type: 'textarea',
							width: tableWidth(180, 140)
						},
					],
					rightBtns: [{
						mode: 'update',
						show: (row) => this.canManageCustomers && !row.is_deleted,
					}, {
						mode: 'delete',
						show: (row) => this.canEditWorkflow && !row.is_deleted,
					}],
					customRightBtns: [{
						title: '详情',
						type: 'default',
						icon: 'el-icon-document',
						onClick: (item) => this.showDetail({ item }),
					}, {
						title: '恢复',
						type: 'success',
						icon: 'el-icon-refresh-left',
						show: () => this.isAdmin && this.showDeleted,
						onClick: (item) => this.restore(item),
					}],
				},
				query: {
					formData: {},
					columns: [{
							key: 'consultant_id',
							title: '咨询师',
							type: 'select',
							placeholder: '请选择咨询师',
							mode: '==',
							data: [],
						}, {
							key: 'parent_name',
							title: '家长姓名',
							type: 'text',
							placeholder: '请输入家长姓名、孩子姓名或联系电话',
							mode: '%%'
						},
						{
							key: 'child_name',
							title: '孩子姓名',
							type: 'text',
							placeholder: '请输入孩子姓名',
							mode: '%%'
						},
						{
							key: 'contact_phone',
							title: '联系电话',
							type: 'text',
							placeholder: '请输入联系电话',
							mode: '%%'
						},
						{
							key: 'status',
							title: '状态',
							type: 'select',
							placeholder: '请选择状态',
							mode: '==',
							data: statusOptions
						},
						{
							key: '_add_time_range',
							title: '创建时间',
							type: 'daterange',
							placeholder: '选择创建时间范围',
							mode: '[]',
							valueFormat: 'yyyy-MM-dd HH:mm:ss'
						},
						{
							key: 'source',
							title: '线索来源',
							type: 'select',
							placeholder: '请选择线索来源',
							mode: '==',
							data: sourceOptions
						},
						{
							key: 'is_starred',
							title: '是否重点客户',
							type: 'select',
							placeholder: '请选择是否重点',
							mode: '==',
							data: starredOptions
						},
						{
							key: 'clue_cost',
							title: '线索成本',
							type: 'money',
							placeholder: ['最低成本', '最高成本'],
							range: true,
							mode: '[]'
						},
						{
							key: 'wechat_added',
							title: '是否加微信',
							type: 'select',
							placeholder: '请选择是否加微信',
							mode: '==',
							data: wechatAddedOptions
						},
					],
				},
				form: {
					show: false,
					title: '',
					type: 'add',
					action: 'business/custom2.save',
					data: {},
					submitting: false,
					skipConvertedStatusPrompt: false,
					convertedStatusConfirmed: false,
					rules: {
						parent_name: [{
							required: true,
							message: '请输入家长姓名',
							trigger: 'blur'
						}],
						contact_phone: [{
								pattern: /^1\d{10}$/,
								message: '请输入11位手机号码',
								trigger: 'blur'
							},
						],
						status: [{
							required: true,
							message: '请选择状态',
							trigger: 'change'
						}],
						_add_time: [{
							required: true,
							message: '请选择创建时间',
							trigger: 'change'
						}],
						wechat: [{
							pattern: /^[A-Za-z][A-Za-z0-9_-]{5,19}$/,
							message: '微信号需为字母开头的6-20位字母、数字、下划线或连字符',
							trigger: 'blur'
						}],
						consultant_id: [{
							required: true,
							message: '请选择咨询师',
							trigger: 'change'
						}],
					},
					columns: [{
							key: '__section_basic',
							title: '基础信息',
							type: 'bar-title'
						},
						{
							key: 'status',
							title: '状态',
							type: 'select',
							span: 12,
							data: statusOptions,
							placeholder: '请选择状态',
							// 客户创建后只能通过新增或编辑进度记录变更状态。
							disabled: (data) => Boolean(data._id)
						},
						{
							key: '_add_time',
							title: '创建时间',
							type: 'date',
							dateType: 'datetime',
							span: 12,
							placeholder: '请选择创建时间',
							valueFormat: 'yyyy-MM-dd HH:mm:ss'
						},
						{
							key: 'source',
							title: '线索来源',
							type: 'select',
							span: 12,
							data: sourceOptions,
							placeholder: '请选择线索来源'
						},
						{
							key: 'clue_cost',
							title: '线索成本/元',
							type: 'money',
							span: 12,
							placeholder: '请输入成本',
							disabled: (data) => !paidSourceValues.includes(data.source)
						},
						{
							key: 'parent_name',
							title: '家长姓名',
							type: 'text',
							span: 12,
							placeholder: '请输入家长姓名'
						},
						{
							key: 'contact_phone',
							title: '联系电话',
							type: 'text',
							span: 12,
							placeholder: '请输入联系电话'
						},
						{
							key: 'wechat_added',
							title: '是否加微信',
							type: 'switch',
							span: 12,
							activeValue: true,
							inactiveValue: false,
							activeText: '已加',
							inactiveText: '未加',
							activeColor: '#18a058',
							inactiveColor: '#a3a3a3'
						},
						{
							key: 'wechat',
							title: '微信号',
							type: 'text',
							span: 12,
							placeholder: '请输入微信号'
						},
						{
							key: 'region',
							title: '所在地区',
							type: 'address',
							span: 12,
							level: 3,
							props: { checkStrictly: true },
							placeholder: '请选择省/市/区'
						},
						{
							key: 'detail_address',
							title: '详细地址',
							type: 'text',
							span: 24,
							placeholder: '请输入详细地址'
						},
						{
							key: '__section_student',
							title: '学生信息',
							type: 'bar-title'
						},
						{
							key: 'child_name',
							title: '孩子姓名',
							type: 'text',
							span: 12,
							placeholder: '请输入孩子姓名'
						},
						{
							key: 'child_grade',
							title: '孩子年级',
							type: 'text',
							span: 12,
							placeholder: '请输入孩子年级'
						},
						{
							key: 'study_status',
							title: '孩子学习情况',
							type: 'textarea',
							span: 24,
							autosize: {
								minRows: 3,
								maxRows: 6
							}
						},
						{
							key: '__section_intent',
							title: '意向信息',
							type: 'bar-title'
						},
						{
							key: 'intended_regions',
							title: '意向地区',
							type: 'checkbox',
							span: 24,
							data: intendedRegionOptions,
							placeholder: '请选择意向地区'
						},
						{
							key: 'intended_region_remark',
							title: '详细城市',
							type: 'text',
							span: 24,
							placeholder: '请输入详细城市'
						},
						{
							key: '__section_remark',
							title: '备注',
							type: 'bar-title'
						},
						{
							key: 'remark',
							title: '备注内容',
							type: 'textarea',
							span: 24,
							autosize: {
								minRows: 3,
								maxRows: 6
							}
						},
					],
				},
				followup: {
					show: false,
					editingIndex: -1,
					skipConvertedStatusPrompt: false,
					form: {
						action: 'business/custom2.addFollowup',
						type: 'add',
						data: {},
						rules: {
							contact_time: [{ required: true, message: '请选择沟通时间', trigger: 'change' }],
							status: [{ required: true, message: '请选择进度状态', trigger: 'change' }],
							content: [],
						},
						columns: [{
							key: 'contact_time',
							title: '沟通时间',
							type: 'date',
							dateType: 'datetime',
							span: 24,
							valueFormat: 'yyyy-MM-dd HH:mm:ss',
							placeholder: '请选择沟通时间',
							pickerOptions: {
								disabledDate(time) {
									return time.getTime() > Date.now();
								},
							},
						}, {
							key: 'status',
							title: '状态',
							type: 'select',
							span: 24,
							data: statusOptions,
							placeholder: '请选择进度状态',
						}, {
							key: 'content',
							title: '沟通内容',
							type: 'textarea',
							span: 24,
							autosize: { minRows: 5, maxRows: 10 },
							placeholder: '请输入本次沟通内容',
						}],
					},
				},
			};
		},
		computed: {
			createdTimePickerOptions() {
				const startOfDay = (date) => {
					const value = new Date(date);
					value.setHours(0, 0, 0, 0);
					return value;
				};
				const endOfDay = (date) => {
					const value = new Date(date);
					value.setHours(23, 59, 59, 999);
					return value;
				};
				const shiftDay = (date, offset) => {
					const value = new Date(date);
					value.setDate(value.getDate() + offset);
					return value;
				};
				const getWeekStart = (date) => {
					const value = startOfDay(date);
					const day = value.getDay() || 7;
					value.setDate(value.getDate() - day + 1);
					return value;
				};
				const getMonthStart = (date) => {
					const value = startOfDay(date);
					value.setDate(1);
					return value;
				};
				const getYearStart = (date) => {
					const value = startOfDay(date);
					value.setMonth(0, 1);
					return value;
				};
				const rangeShortcut = (text, getRange) => ({
					text,
					onClick(picker) {
						const range = getRange(new Date());
						picker.$emit('pick', range);
					},
				});
				return {
					shortcuts: [
						rangeShortcut('今日-上午', (now) => [startOfDay(now), new Date(new Date(now).setHours(11, 59, 59, 999))]),
						rangeShortcut('今日-下午', (now) => [new Date(new Date(now).setHours(12, 0, 0, 0)), endOfDay(now)]),
						rangeShortcut('今日', (now) => [startOfDay(now), endOfDay(now)]),
						rangeShortcut('本周', (now) => [getWeekStart(now), endOfDay(now)]),
						rangeShortcut('本月', (now) => [getMonthStart(now), endOfDay(now)]),
						rangeShortcut('昨日', (now) => [startOfDay(shiftDay(now, -1)), endOfDay(shiftDay(now, -1))]),
						rangeShortcut('上周', (now) => [shiftDay(getWeekStart(now), -7), endOfDay(shiftDay(getWeekStart(now), -1))]),
						rangeShortcut('上月', (now) => {
							const currentMonth = getMonthStart(now);
							const previousMonth = new Date(currentMonth);
							previousMonth.setMonth(previousMonth.getMonth() - 1);
							return [previousMonth, endOfDay(new Date(currentMonth.getTime() - 1))];
						}),
						rangeShortcut('本年', (now) => [getYearStart(now), endOfDay(now)]),
					],
				};
			},
			visibleQueryColumns() {
				return this.query.columns
					.filter((column) => this.canViewConsultantFilter || column.key !== 'consultant_id')
					.map((column) => {
						if (column.key !== 'source') return column;
						return {
							...column,
							data: this.availableSourceOptions,
						};
					});
			},
			visibleTableColumns() {
				return this.showDeleted ? this.table.columns : this.table.columns.filter((column) => column.key !== 'is_deleted');
			},
			userRoles() {
				if (this.accessProfile.loaded && Array.isArray(this.accessProfile.role_keys) && this.accessProfile.role_keys.length) {
					return this.accessProfile.role_keys;
				}
				const userInfo = (this.$store && this.$store.state && this.$store.state.$user && this.$store.state.$user.userInfo) || {};
				let roleValue = userInfo.role || userInfo.roles || userInfo.role_id || userInfo.roleIds || [];
				if (typeof roleValue === 'string') {
					try {
						roleValue = JSON.parse(roleValue);
					} catch (error) {
						roleValue = roleValue.split(',').map((item) => item.trim()).filter(Boolean);
					}
				}
				const roles = Array.isArray(roleValue) ? roleValue : [roleValue];
				return roles.flatMap((role) => typeof role === 'string' ? [role] : [role && role.role_id, role && role.value, role && role.role_name, role && role.name].filter(Boolean)).filter(Boolean);
			},
			isAdmin() {
				if (this.accessProfile.loaded) return Boolean(this.accessProfile.is_admin);
				return this.userRoles.some((role) => adminRoleKeys.includes(role));
			},
			currentLiveTeacherSourceOption() {
				const userInfo = (this.$store && this.$store.state && this.$store.state.$user && this.$store.state.$user.userInfo) || {};
				const isLiveTeacher = this.userRoles.some((role) => ['live_teacher', 'zhibo', '直播老师'].some((keyword) => String(role).includes(keyword)));
				const uid = userInfo._id || userInfo.uid || userInfo.user_id || '';
				const name = userInfo.nickname || userInfo.realname || userInfo.username || '';
				if (!isLiveTeacher || !uid || !name) return null;
				return { value: `live_teacher_${uid}`, label: `直播（${name}）`, aliases: [`live_teacher_${uid}`, `直播（${name}）`], is_dynamic: true };
			},
			leadProviderSources() {
				if (this.accessProfile.loaded) return Array.from(new Set([...(this.accessProfile.visible_sources || []), ...((this.currentLiveTeacherSourceOption && this.currentLiveTeacherSourceOption.aliases) || [])]));
				if (this.isAdmin) return [];
				const set = new Set();
				this.userRoles.forEach((role) => {
					(roleSourceScopeMap[role] || []).forEach((source) => set.add(source));
					fuzzyRoleSourceScopeList.forEach((config) => {
						if (config.keywords.some((keyword) => String(role).includes(keyword))) {
							config.sources.forEach((source) => set.add(source));
						}
					});
				});
				return Array.from(set);
			},
			isLeadProviderRole() {
				if (this.accessProfile.loaded) return Boolean(this.accessProfile.is_lead_provider);
				// 权限接口尚未返回时，仅按历史角色名称兜底，不能因为来源范围而误判咨询师。
				return this.userRoles.some((role) => ['直播', '投流', 'live_teacher', 'zhibo', 'traffic_teacher'].some((keyword) => String(role).includes(keyword)));
			},
			canAssignConsultantInForm() {
				return this.isLeadProviderRole || (this.isAdmin && this.form.type === 'add');
			},
			canViewConsultantFilter() {
				return this.isAdmin || this.isLeadProviderRole;
			},
			availableSourceOptions() {
				// 来源下拉严格使用线索管理返回的配置，旧版静态数组只用于兼容历史数据展示和导入。
				const currentSource = this.form.data && this.form.data.source;
				const options = (this.accessProfile.loaded ? (this.accessProfile.source_options || []) : [])
					// “live”只用于角色权限匹配，不是客户实际来源，不能出现在客户表单中。
					.filter((item) => item.value !== 'live')
					.filter((item) => item.enabled !== false || item.value === currentSource)
					.filter((item, index, list) => list.findIndex((candidate) => candidate.value === item.value) === index);
				// 直播老师新增客户时，当前账号的动态来源属于“直播来源”范围，允许作为实际保存值。
				if (this.isLeadProviderRole && this.currentLiveTeacherSourceOption && !options.some((item) => item.value === this.currentLiveTeacherSourceOption.value)) {
					options.push(this.currentLiveTeacherSourceOption);
				}
				// 编辑历史客户时，当前动态来源必须保留，否则 el-select 会直接显示内部编码。
				if (String(currentSource || '').startsWith('live_teacher_') && !options.some((item) => item.value === currentSource)) {
					options.push({ value: currentSource, label: this.formatSourceLabel(currentSource), aliases: [currentSource] });
				}
				if (this.isAdmin || !this.isLeadProviderRole) return options;
				return options.filter((item) => this.leadProviderSources.includes(item.value) || (item.aliases || []).some((alias) => this.leadProviderSources.includes(alias)));
			},
			visibleFormColumns() {
				const columns = this.form.columns
					.filter((column) => this.canEditWorkflow || !['__section_signing', '__section_materials'].includes(column.key))
					.map((column) => {
						if (column.key === 'source') {
							return {
								...column,
								data: this.availableSourceOptions,
								disabled: Boolean(column.disabled || (this.form.data._id && !this.isAdmin)),
							};
						}
						if (column.key === 'wechat_added') {
							return {
								...column,
								disabled: this.isLeadProviderRole,
							};
						}
						return { ...column };
					});
				if (!this.canAssignConsultantInForm) return columns;
				return columns.filter((column) => column.key !== 'consultant_id');
			},
			visibleFormRules() {
				if (this.canAssignConsultantInForm) return this.form.rules;
				const rules = { ...this.form.rules };
				delete rules.consultant_id;
				return rules;
			},
			canEditWorkflow() {
				return !this.isLeadProviderRole;
			},
			canStarCustomers() {
				return this.canManageCustomers;
			},
			primaryActionText() {
				return this.isLeadProviderRole ? '分发客户' : '新增客户';
			},
			canManageCustomers() {
				return true;
			}
		},
		watch: {
			'form.data.source'(value) {
				if (!paidSourceValues.includes(value)) {
					this.form.data.clue_cost = '';
				}
			},
			'$route.query.customer_id'() {
				this.handleRouteCustomer();
			},
			'$route.query.customerId'() {
				this.handleRouteCustomer();
			},
			'$route.query.id'() {
				this.handleRouteCustomer();
			},
			'$route.query.action'() {
				this.handleRouteCustomer();
			},
			'followup.form.data.status'(value, oldValue) {
				this.confirmConvertedFollowupStatus(value, oldValue);
			},
		},
		onLoad(options = {}) {
			vk = this.vk;
			this.handleRouteCustomer(options);
			this.loadAccessProfile();
		},
		onShow() {
			this.handleRouteCustomer();
		},
		beforeDestroy() {
			if (this.customerImportInput && this.customerImportInput.parentNode) {
				this.customerImportInput.removeEventListener('change', this.handleCustomerImportFileChange);
				this.customerImportInput.parentNode.removeChild(this.customerImportInput);
			}
		},
		methods: {
			canEditFollowupRecord(record = {}) {
				if (!this.canEditWorkflow || this.isSystemRecord(record) || this.isTransferRecord(record)) return false;
				if (this.isAdmin) return true;
				return !postConvertedStatusValues.includes(normalizeCustomerStatus(record.status));
			},
			getRouteOptions(options = {}) {
				const routeQuery = this.$route && this.$route.query ? this.$route.query : {};
				const currentPage = typeof getCurrentPages === 'function' ? getCurrentPages().slice(-1)[0] : null;
				const pageOptions = currentPage && currentPage.options ? currentPage.options : {};
				return { ...pageOptions, ...routeQuery, ...options };
			},
			handleRouteCustomer(options = {}) {
				const routeOptions = this.getRouteOptions(options);
				if (routeOptions.source) {
					this.routeSource = String(routeOptions.source);
					this.query.formData.source = this.routeSource;
				} else if (this.routeSource) {
					this.routeSource = '';
					if (this.query.formData.source) this.query.formData.source = '';
				}
				const routeAction = routeOptions.action || routeOptions.open || '';
				if (routeAction === 'add' || routeAction === 'new') {
					this.routeCustomerId = '';
					if (this.routeAddOpened) return;
					this.routeAddOpened = true;
					this.$nextTick(() => this.add());
					return;
				}
				this.routeAddOpened = false;
				const customerId = routeOptions.customer_id || routeOptions.customerId || routeOptions.id || '';
				if (!customerId) {
					this.routeCustomerId = '';
					return;
				}
				if (customerId === this.routeCustomerId) return;
				this.routeCustomerId = customerId;
				this.openCustomerFromRoute(customerId);
			},
			clearRouteCustomerQuery() {
				const routeKeys = ['customer_id', 'customerId', 'id', 'action', 'open'];
				this.routeCustomerId = '';
				this.routeAddOpened = false;

				// 清理当前路由对象中的一次性参数，避免页面再次激活时重复打开详情。
				if (this.$route && this.$route.query) {
					routeKeys.forEach((key) => {
						if (this.$delete) this.$delete(this.$route.query, key);
						else delete this.$route.query[key];
					});
				}

				// 只改地址栏，不触发后台标签页路由重建，避免关闭弹窗后页面变空白。
				if (typeof window === 'undefined' || !window.location || !window.history) return;
				const hash = window.location.hash || '';
				const hashParts = hash.split('?');
				if (hashParts.length < 2) return;
				const hashPath = hashParts[0] || '#/pages/custom/records';
				const query = new URLSearchParams(hashParts.slice(1).join('?'));
				routeKeys.forEach((key) => query.delete(key));
				const nextQuery = query.toString();
				const nextUrl = `${window.location.pathname}${window.location.search}${hashPath}${nextQuery ? `?${nextQuery}` : ''}`;
				window.history.replaceState(window.history.state, document.title, nextUrl);
			},
			loadAccessProfile() {
				vk.callFunction({
					url: 'business/custom2.getAccessProfile',
					data: {},
					success: (result) => {
						const profile = result && result.data || {};
						this.accessProfile = {
							loaded: true,
							is_admin: Boolean(profile.is_admin),
							is_lead_provider: Boolean(profile.is_lead_provider),
							visible_sources: Array.isArray(profile.visible_sources) ? profile.visible_sources : [],
							source_options: Array.isArray(profile.source_options) ? profile.source_options : [],
							// 全量来源（含其他角色/已冻结账号的动态直播老师），供列表 formatter 等只读渲染使用。
							source_options_all: Array.isArray(profile.source_options_all) ? profile.source_options_all : [],
							role_keys: Array.isArray(profile.role_keys) ? profile.role_keys : [],
						};
						applyCustomerStatusOptions(profile.status_options);
						this.query.columns.find((item) => item.key === 'status').data = statusOptions;
						this.form.columns.find((item) => item.key === 'status').data = statusOptions;
						this.followup.form.columns.find((item) => item.key === 'status').data = statusOptions;
						if (this.canViewConsultantFilter) this.loadConsultants();
						if (this.routeSource) this.$nextTick(() => this.refresh());
					},
					fail: () => {
						this.accessProfile.loaded = true;
						if (this.canViewConsultantFilter) this.loadConsultants();
					},
				});
			},
			normalizeCreatedTimeRange() {
				const startValue = this.query.formData._add_time_start;
				const endValue = this.query.formData._add_time_end;
				if (!startValue || !endValue) return;
				const startTime = new Date(startValue).getTime();
				const endTime = new Date(endValue).getTime();
				if (Number.isNaN(startTime) || Number.isNaN(endTime) || startTime <= endTime) return;
				this.query.formData._add_time_start = endValue;
				this.query.formData._add_time_end = startValue;
				this.$notify({
					title: '提示',
					message: '开始日期晚于结束日期，已自动调整日期顺序',
					type: 'warning',
					position: 'bottom-right',
				});
			},
			loadConsultants() {
				vk.callFunction({
					url: 'business/custom2.getConsultants',
					data: {},
					success: (result) => {
						const rows = Array.isArray(result && result.rows) ? result.rows : [];
						this.consultantOptions = rows.filter(isConsultantOptionCandidate).map((item) => ({
							value: item._id,
							label: item.nickname || item.username || '未命名咨询师',
						}));
						this.query.columns[0].data = this.consultantOptions;
						this.transfer.form.columns[0].data = this.consultantOptions;
					},
				});
			},
			toggleDeletedView() {
				if (!this.isAdmin) return;
				this.showDeleted = !this.showDeleted;
				this.query.formData._deleted_view = this.showDeleted;
				this.refresh();
			},
			restore(item) {
				if (!this.isAdmin || !item || !item._id) return;
				this.$confirm(`确定恢复客户“${item.parent_name || '未命名客户'}”吗？`, '提示', {
					confirmButtonText: '确定恢复',
					cancelButtonText: '取消',
					type: 'warning',
				}).then(() => {
					vk.callFunction({
						url: 'business/custom2.restore',
						data: { _id: item._id },
						success: (result) => {
							if (!result || result.code === 0) {
								this.refresh();
								this.$notify({ title: '提示', message: '客户信息已恢复', type: 'success', position: 'bottom-right' });
							} else {
								this.$notify({ title: '提示', message: result.msg || '恢复失败，请重试', type: 'error', position: 'bottom-right' });
							}
						},
						fail: () => this.$notify({ title: '提示', message: '恢复失败，请重试', type: 'error', position: 'bottom-right' }),
					});
				}).catch(() => {});
			},
			hardDeleteFromDetail() {
				const customer = this.detail.data || {};
				if (!this.isAdmin || !customer._id || !customer.is_deleted) return;
				vk.callFunction({
					url: 'business/custom2.getHardDeleteSummary',
					data: { _id: customer._id },
					success: (result) => {
						if (!result || result.code !== 0) {
							this.$notify({ title: '提示', message: result && result.msg || '删除摘要加载失败，请重试', type: 'error', position: 'bottom-right' });
							return;
						}
						const summary = result.data || {};
						const materialCount = Number(summary.material_count || 0);
						const customerName = summary.customer_name || customer.parent_name || '未命名客户';
						this.$confirm(`将永久删除客户“${customerName}”、全部进度记录、${materialCount} 份客户资料文件以及客户资料文件夹，删除后无法恢复。确定要彻底删除吗？`, '危险操作：永久删除', {
							confirmButtonText: '确认永久删除',
							cancelButtonText: '取消',
							type: 'error',
						}).then(() => {
							return this.$confirm(`请再次确认：客户“${customerName}”将从数据库和素材库永久移除，关联资料文件也会从云存储删除，无法通过系统恢复。`, '最终确认', {
								confirmButtonText: '确定永久删除',
								cancelButtonText: '取消',
								type: 'error',
							});
						}).then(() => {
							vk.callFunction({
								url: 'business/custom2.hardDelete',
								data: { _id: customer._id },
								success: (deleteResult) => {
									if (!deleteResult || deleteResult.code === 0) {
										this.detail.show = false;
										this.refresh();
										this.$notify({ title: '提示', message: '客户信息已永久删除', type: 'success', position: 'bottom-right' });
									} else {
										this.$notify({ title: '提示', message: deleteResult.msg || '彻底删除失败，请重试', type: 'error', position: 'bottom-right' });
									}
								},
								fail: () => this.$notify({ title: '提示', message: '彻底删除失败，请重试', type: 'error', position: 'bottom-right' }),
							});
						}).catch(() => {});
					},
					fail: () => this.$notify({ title: '提示', message: '删除摘要加载失败，请重试', type: 'error', position: 'bottom-right' }),
				});
			},
			search() {
				this.normalizeCreatedTimeRange();
				this.$refs.table.search();
			},
			refresh() {
				this.$refs.table.refresh();
			},
			downloadCustomerImportTemplate() {
				if (typeof document === 'undefined') {
					this.$notify({ title: '提示', message: '当前环境不支持下载模板', type: 'warning', position: 'bottom-right' });
					return;
				}
				const publicPath = (typeof process !== 'undefined' && process.env && process.env.BASE_URL) || '/admin/';
				const basePath = publicPath.endsWith('/') ? publicPath : `${publicPath}/`;
				const link = document.createElement('a');
				link.href = `${basePath}static/templates/customer-import-template.xlsx?t=${Date.now()}`;
				link.download = '客户导入模板.xlsx';
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
			},
			exportCustomers() {
				if (!this.$refs.table || typeof this.$refs.table.exportExcel !== 'function') {
					this.$notify({ title: '提示', message: '当前表格暂不支持导出', type: 'warning', position: 'bottom-right' });
					return;
				}
				this.$refs.table.exportExcel({
					showColumnSelector: true,
					freezeHeader: true,
					autoFilter: true,
				});
			},
			chooseCustomerImportFile() {
				if (this.importingCustomers) return;
				if (typeof document === 'undefined') {
					this.$notify({ title: '提示', message: '当前环境不支持选择本地Excel文件', type: 'warning', position: 'bottom-right' });
					return;
				}
				let input = this.customerImportInput;
				if (!input) {
					input = document.createElement('input');
					input.type = 'file';
					input.accept = '.xlsx';
					input.style.display = 'none';
					input.addEventListener('change', this.handleCustomerImportFileChange);
					document.body.appendChild(input);
					this.customerImportInput = input;
				}
				input.value = '';
				input.click();
			},
			async handleCustomerImportFileChange(event) {
				const input = event && event.target;
				const file = input && input.files && input.files[0];
				if (!file) return;
				if (!/\.xlsx$/i.test(file.name || '')) {
					this.$notify({ title: '提示', message: '请上传 .xlsx 格式的Excel文件', type: 'warning', position: 'bottom-right' });
					input.value = '';
					return;
				}
				this.importingCustomers = true;
				try {
					if (!vk.pubfn || typeof vk.pubfn.parseXlsxFile !== 'function') throw new Error('当前环境不支持解析Excel');
					const excelRows = await vk.pubfn.parseXlsxFile({ file, index: 0, mode: 1 });
					const rows = this.buildCustomerImportRows(excelRows);
					if (!rows.length) throw new Error('没有可导入的客户数据，请确认第一行是表头且包含“家长姓名”');
					const result = await new Promise((resolve, reject) => {
						vk.callFunction({
							url: 'business/custom2.importCustomers',
							data: { rows },
							success: resolve,
							fail: reject,
						});
					});
					if (result && result.code !== 0) throw new Error(result.msg || '导入失败');
					const summary = result && result.data || {};
					const failCount = Number(summary.fail_count || 0);
					this.$notify({
						title: '提示',
						message: `导入完成：成功 ${summary.success_count || 0} 条${failCount ? `，失败 ${failCount} 条` : ''}`,
						type: failCount ? 'warning' : 'success',
						position: 'bottom-right',
					});
					this.refresh();
				} catch (error) {
					this.$notify({
						title: '提示',
						message: error && error.message || '导入失败，请检查Excel内容',
						type: 'error',
						position: 'bottom-right',
					});
				} finally {
					this.importingCustomers = false;
					if (input) input.value = '';
				}
			},
			buildCustomerImportRows(excelRows = []) {
				const consultantMap = this.consultantOptions.reduce((map, item) => {
					map[item.value] = item.value;
					map[item.label] = item.value;
					return map;
				}, {});
				return (Array.isArray(excelRows) ? excelRows : [])
					.map((row) => this.normalizeCustomerImportRow(row, consultantMap))
					.filter((row) => row && row.parent_name);
			},
			normalizeCustomerImportRow(row = {}, consultantMap = {}) {
				const data = {};
				Object.keys(row || {}).forEach((header) => {
					const field = importHeaderFieldMap[String(header || '').trim()] || String(header || '').trim();
					const value = this.normalizeCustomerImportValue(field, row[header]);
					if (value === undefined || value === null || value === '') return;
					data[field] = value;
				});
				if (data.consultant_name && !data.consultant_id && consultantMap[data.consultant_name]) {
					data.consultant_id = consultantMap[data.consultant_name];
				}
				if (!data.status) data.status = 'initial_contact';
				if (!data._add_time) data._add_time = Date.now();
				if (!data.source) data.source = (this.isLeadProviderRole && this.currentLiveTeacherSourceOption
					? this.currentLiveTeacherSourceOption.value
					: this.availableSourceOptions[0] && this.availableSourceOptions[0].value) || 'other';
				data.attachments = [];
				return data;
			},
			normalizeCustomerImportValue(field, value) {
				if (value && typeof value === 'object' && value.text !== undefined) value = value.text;
				if (value instanceof Date) return value.getTime();
				const text = String(value === undefined || value === null ? '' : value).trim();
				if (!text) return '';
				if (field === 'status') {
					const matched = statusOptions.find((item) => item.value === text || item.label === text);
					return matched ? matched.value : normalizeCustomerStatus(text);
				}
				if (field === 'source') {
					const matchedOption = this.availableSourceOptions.find((item) => item.label === text || item.value === text || (item.aliases || []).includes(text));
					return normalizeSourceValue(matchedOption ? matchedOption.value : (sourceImportValueMap[text] || text));
				}
				if (field === 'wechat_added') {
					const lowerText = text.toLowerCase();
					if (yesValues.includes(lowerText) || yesValues.includes(text)) return true;
					if (noValues.includes(lowerText) || noValues.includes(text)) return false;
					return Boolean(text);
				}
				if (field === 'intended_regions') return text.split(/[、,，;；\s]+/).map((item) => item.trim()).filter(Boolean);
				if (field === 'clue_cost') {
					const amount = Number(text.replace(/[^\d.-]/g, ''));
					return Number.isFinite(amount) ? amount : 0;
				}
				if (field === '_add_time') {
					const time = new Date(text.replace(/-/g, '/')).getTime();
					return Number.isNaN(time) ? Date.now() : time;
				}
				return text;
			},
			toggleStar(customer) {
				if (!this.canStarCustomers || !customer || !customer._id || customer.is_deleted) return;
				const targetStarred = !customer.is_starred;
				vk.callFunction({
					url: 'business/custom2.toggleStar',
					data: {
						customer_id: customer._id,
						is_starred: targetStarred,
					},
					success: (result) => {
						if (!result || result.code === 0) {
							this.$set(customer, 'is_starred', targetStarred);
							if (this.detail.data && this.detail.data._id === customer._id) this.$set(this.detail.data, 'is_starred', targetStarred);
							if (this.form.data && this.form.data._id === customer._id) this.$set(this.form.data, 'is_starred', targetStarred);
							this.$notify({
								title: '提示',
								message: result && result.msg || (targetStarred ? '已设为重点客户' : '已取消重点客户'),
								type: 'success',
								position: 'bottom-right',
							});
							this.refresh();
							return;
						}
						this.showCustomerSubmitNotice(result.msg || '重点客户状态更新失败');
					},
					fail: () => {
						this.showCustomerSubmitNotice('重点客户状态更新失败，请重试', 'error');
					},
				});
			},
			showDetail({ item }) {
				const data = {
					intended_regions: [],
					followup_records: [],
					attachments: [],
					signing_province: '',
					signing_city: '',
					contract_amount: '',
					contract_content: '',
					is_starred: false,
					...item
				};
				data.status = normalizeCustomerStatus(data.status);
				data.source = normalizeSourceValue(data.source);
				data.followup_records = this.sortFollowupRecords(data.followup_records);
				if (data._add_time) data._add_time = new Date(data._add_time);
				this.detail.data = data;
				this.detail.activeTab = 'info';
				this.detailFiles = Array.isArray(data.attachments) ? data.attachments.slice() : [];
				this.syncCustomerMaterials(data);
				this.detail.show = true;
				this.resolveMaterialFiles(this.detailFiles).then((files) => {
					if (this.detail.data._id === data._id) this.detailFiles = files;
				});
			},
			openCustomerFromRoute(customerId) {
				vk.callFunction({
					url: 'business/custom2.getList',
					data: {
						formData: { _id: customerId },
						pageIndex: 1,
						pageSize: 1,
					},
					success: (result) => {
						const item = result && Array.isArray(result.rows) ? result.rows[0] : null;
						if (item && item._id) this.showDetail({ item });
						else this.$notify({ title: '提示', message: '未找到该客户，可能已被删除或无权查看', type: 'warning' });
						this.clearRouteCustomerQuery();
					},
				});
			},
			openDetailFromRow(row) {
				if (!this.isMobileViewport()) return;
				const item = row && row.item ? row.item : row;
				if (item && item._id) this.showDetail({ item });
			},
			isMobileViewport() {
				try {
					const systemInfo = uni.getSystemInfoSync();
					return Number(systemInfo.windowWidth || systemInfo.screenWidth) <= 600;
				} catch (error) {
					return false;
				}
			},
			removeFromDetail() {
				if (!this.canEditWorkflow) return;
				const customer = this.detail.data || {};
				if (!customer._id) return;
				this.$confirm(`确定删除客户“${customer.parent_name || '未命名客户'}”吗？`, '提示', {
					confirmButtonText: '确定删除',
					cancelButtonText: '取消',
					type: 'warning',
				}).then(() => {
					vk.callFunction({
						url: 'business/custom2.delete',
						data: { _id: customer._id },
						success: (result) => {
							if (!result || result.code === 0) {
								this.detail.show = false;
								this.refresh();
								if (this.$notify && typeof this.$notify.closeAll === 'function') this.$notify.closeAll();
								this.$notify({ title: '提示', message: '客户信息已删除', type: 'success', position: 'bottom-right' });
							} else {
								this.$notify({ title: '提示', message: result.msg || '删除失败，请重试', type: 'error', position: 'bottom-right' });
							}
						},
						fail: () => {
							this.$notify({ title: '提示', message: '删除失败，请重试', type: 'error', position: 'bottom-right' });
						},
					});
				}).catch(() => {});
			},
			editFromDetail() {
				if (!this.canManageCustomers) return;
				const data = { ...this.detail.data };
				const openEditor = () => {
					this.detail.show = false;
					this.update({ item: data });
				};
				if (!this.isAdmin) {
					openEditor();
					return;
				}
				this.$confirm('作为管理员，你确定要编辑吗', '提示', {
					confirmButtonText: '确定编辑',
					cancelButtonText: '取消',
					type: 'warning'
				}).then(openEditor).catch(() => {});
			},
			addFollowupFromDetail() {
				if (!this.canEditWorkflow) return;
				const data = { ...this.detail.data };
				this.detail.show = false;
				this.update({ item: data });
				this.$nextTick(() => this.openFollowup());
			},
			openTransferFromForm() {
				if (!this.canEditWorkflow) return;
				this.openTransfer(this.form.data);
			},
			openTransfer(customer = this.detail.data) {
				if (!this.canEditWorkflow) return;
				if (customer && customer.type && !customer._id) customer = this.detail.data;
				if (!customer || !customer._id) return;
				vk.callFunction({
					url: 'business/custom2.getConsultants',
					data: {},
					success: (result) => {
						const rows = Array.isArray(result && result.rows) ? result.rows : [];
						const currentConsultantId = customer.consultant_id;
						const consultants = rows.filter((item) => isConsultantOptionCandidate(item) && item._id !== currentConsultantId).map((item) => ({
							value: item._id,
							label: item.nickname || item.username || '未命名咨询师',
						}));
						this.transfer.form.columns[0].data = consultants;
						if (!consultants.length) {
							this.$notify({ title: '提示', message: '暂无可转移的咨询师', type: 'warning', position: 'bottom-right' });
							return;
						}
						this.transfer.form.data = { customer_id: customer._id, target_consultant_id: '' };
						this.transfer.show = true;
					},
					fail: () => {
						this.$notify({ title: '提示', message: '咨询师列表加载失败，请重试', type: 'error', position: 'bottom-right' });
					},
				});
			},
			transferSuccess(result) {
				const response = result && result.data && result.data.record ? result.data : result;
				const record = response && response.record;
				const targetName = response && response.consultant_name || '';
				const customerId = this.transfer.form.data.customer_id;
				if (this.detail.data._id === customerId) {
					if (targetName) this.detail.data.consultant_name = targetName;
					if (response && response.consultant_id) this.detail.data.consultant_id = response.consultant_id;
					if (record) this.detail.data.followup_records = [record, ...(this.detail.data.followup_records || [])];
				}
				if (this.form.data._id === customerId) {
					this.form.data.consultant_name = targetName;
					this.form.data.consultant_id = response && response.consultant_id || this.form.data.consultant_id;
					if (record) this.form.data.followup_records = [record, ...(this.form.data.followup_records || [])];
				}
				this.transfer.show = false;
				this.refresh();
				if (!this.isAdmin) this.detail.show = false;
				if (this.$notify && typeof this.$notify.closeAll === 'function') this.$notify.closeAll();
				this.$notify({ title: '提示', message: targetName ? `客户已转移至${targetName}` : '客户已转移', type: 'success', position: 'bottom-right' });
			},
			handleDetailCommand(command) {
				if (command === 'progress' || command === 'materials') this.detail.activeTab = command;
			},
			formatDetailTime(value) {
				if (!value) return '未填写';
				const date = new Date(value);
				if (Number.isNaN(date.getTime())) return '未填写';
				const pad = (number) => String(number).padStart(2, '0');
				return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
			},
			formatDetailDate(value) {
				const formatted = this.formatDetailTime(value);
				return formatted === '未填写' ? formatted : formatted.slice(0, 10);
			},
			formatDetailClock(value) {
				const formatted = this.formatDetailTime(value);
				return formatted === '未填写' ? '' : formatted.slice(11);
			},
			formatWechatAddedLabel(value) {
				return [true, 1, 'true', '1'].includes(value) ? '已加微信' : '未加微信';
			},
			// 客户状态标签：方法直接返回 inline style，绕开组件封装，确保 H5 端一定出颜色。
			getRowStatusStyle(status) {
				const map = {
					initial_contact: 'background:#f2f4f7;color:#667085;border:1px solid #d9e0e8;',
					communicating_positive: 'background:#fff7e6;color:#b76e00;border:1px solid #f5c56b;',
					communicating_difficult: 'background:#f5f0ff;color:#7048a8;border:1px solid #c8b4ee;',
					invited: 'background:#ecf5ff;color:#2878c8;border:1px solid #9ac8fa;',
					converted: 'background:#edfff3;color:#18a058;border:1px solid #a8e5c0;',
					refunded: 'background:#fff6ed;color:#c2611a;border:1px solid #f3c08a;',
					not_interested: 'background:#fff1f1;color:#d93025;border:1px solid #f2a7a7;',
				};
				const base = 'display:inline-block;padding:0 8px;line-height:20px;font-size:12px;border-radius:3px;white-space:nowrap;';
				return base + (map[status] || map.initial_contact);
			},
			getRowStatusLabel(status) {
				return getCustomerStatusOption(status).label || status || '';
			},
			// 合同金额只能输入数字（允许小数，最多 2 位小数）。
			filterContractAmount(value) {
				if (value === '' || value === null || value === undefined) {
					this.$set(this.form.data, 'contract_amount', '');
					return;
				}
				const cleaned = String(value).replace(/[^\d.]/g, '')
					.replace(/^\./, '0.')
					.replace(/\.(?=.*\.)/g, '')
					.replace(/^(\d*\.\d{0,2}).*$/, '$1');
				if (cleaned !== value) this.$set(this.form.data, 'contract_amount', cleaned);
			},
			formatSourceLabel(value) {
				const normalized = normalizeSourceValue(value);
				if (!normalized) return '';
				// 优先查全量来源（含其他角色/已冻结账号的动态来源），保证列表渲染时客户任意来源值都能显示中文标签。
				const accessOptions = (this.accessProfile && this.accessProfile.source_options_all) || [];
				const accessItem = accessOptions.find((item) => item.value === normalized);
				const baseLabel = (accessItem && accessItem.label) || sourceLabelMap[normalized] || value || '';
				if (!baseLabel) return '';
				// 直播老师账号被冻结/封禁时，给来源标签追加"（已隐藏）"提示。
				const isHidden = (accessItem && accessItem.enabled === false) || hiddenSourceValues.has(normalized);
				return isHidden ? `${baseLabel}（已隐藏）` : baseLabel;
			},
			formatClueCost(value) {
				if (value === '' || value === null || value === undefined) return '0';
				const amount = Number(value);
				if (Number.isNaN(amount)) return '0';
				return (amount / 100).toFixed(2).replace(/\.00$/, '');
			},
			isSigningEditable(data) {
				return Boolean(data && !data.is_deleted && normalizeCustomerStatus(data.status) === 'converted');
			},
			shouldConfirmConvertedCustomerStatus() {
				if (!this.form.show || this.form.convertedStatusConfirmed) return false;
				const currentStatus = normalizeCustomerStatus(this.form.data && this.form.data.status);
				const originalStatus = normalizeCustomerStatus(this.form.data && this.form.data.original_status);
				return currentStatus === 'converted' && originalStatus !== 'converted';
			},
			confirmConvertedCustomerBeforeSubmit(callback) {
				if (!this.shouldConfirmConvertedCustomerStatus()) {
					callback();
					return;
				}
				this.$confirm('状态改为“已签单”，代表该客户已经签单成交。请确认是否继续？', '确认已签单', {
					confirmButtonText: '确认已签单',
					cancelButtonText: '取消',
					type: 'warning',
				}).then(() => {
					this.form.convertedStatusConfirmed = true;
					callback();
				}).catch(() => {
					this.form.submitting = false;
					this.activeCustomerTab = 'info';
				});
			},
			confirmConvertedFollowupStatus(value, oldValue) {
				if (!this.followup.show || this.followup.skipConvertedStatusPrompt) return;
				if (normalizeCustomerStatus(value) !== 'converted' || normalizeCustomerStatus(oldValue) === 'converted') return;
				this.$confirm('状态改为“已签单”，代表该客户已经签单成交。请确认是否继续？', '确认已签单', {
					confirmButtonText: '确认已签单',
					cancelButtonText: '取消',
					type: 'warning',
				}).catch(() => {
					this.followup.skipConvertedStatusPrompt = true;
					this.followup.form.data.status = oldValue || 'initial_contact';
					this.$nextTick(() => {
						this.followup.skipConvertedStatusPrompt = false;
					});
				});
			},
			formatDetailRegion(region) {
				if (!region) return '';
				if (typeof region === 'string') return region;
				return [region.province, region.city, region.area].filter(Boolean).map((item) => typeof item === 'object' ? (item.name || item.label || '') : item).filter(Boolean).join(' / ');
			},
			detailMaterialImageUrls() {
				return this.detailFiles.filter((file) => this.isMaterialImage(file)).map((file) => this.materialFileUrl(file));
			},
			add() {
				if (!this.canManageCustomers) return;
				const defaultSource = (this.isLeadProviderRole && this.currentLiveTeacherSourceOption
					? this.currentLiveTeacherSourceOption.value
					: '') || '';
				this.activeCustomerTab = 'info';
				this.materialFiles = [];
				this.form.data = {
					status: 'initial_contact',
					_add_time: new Date(),
					source: defaultSource,
					clue_cost: '',
					wechat_added: false,
					wechat: '',
					region: {},
					intended_regions: [],
					attachments: [],
					signing_province: '',
					signing_city: '',
					contract_amount: '',
					contract_content: '',
					consultant_id: '',
					original_consultant_id: '',
					original_status: 'initial_contact',
					is_starred: false,
				};
				this.form.convertedStatusConfirmed = false;
				this.form.type = 'add';
				this.form.title = this.primaryActionText;
				this.form.show = true;
			},
			update({
				item
			}) {
				if (!this.canManageCustomers) return;
				this.activeCustomerTab = 'info';
				const data = {
					intended_regions: [],
					followup_records: [],
					attachments: [],
					signing_province: '',
					signing_city: '',
					contract_amount: '',
					contract_content: '',
					is_starred: false,
					...item
				};
				data.status = normalizeCustomerStatus(data.status);
				data.original_status = data.status;
				data.source = normalizeSourceValue(data.source);
				data.region = normalizeRegionForForm(data.region);
				data.followup_records = this.sortFollowupRecords(data.followup_records);
				data.original_consultant_id = data.consultant_id || '';
				if (!paidSourceValues.includes(data.source)) data.clue_cost = '';
				if (data._add_time) data._add_time = new Date(data._add_time);
				this.materialFiles = Array.isArray(data.attachments) ? data.attachments.slice() : [];
				this.syncCustomerMaterials(data);
				this.form.data = data;
				this.form.convertedStatusConfirmed = false;
				this.resolveMaterialFiles(this.materialFiles).then((files) => {
					this.materialFiles = files;
					this.form.data.attachments = files;
				});
				this.form.type = 'update';
				this.form.title = this.isLeadProviderRole ? '编辑客户信息' : '编辑客户';
				this.form.show = true;
			},
			remove({
				item,
				deleteFn
			}) {
				if (!this.canEditWorkflow) return;
			deleteFn({
				action: 'business/custom2.delete',
					data: {
						_id: item._id
					},
					refresh: true
			});
			},
			syncFollowupStatusOptions(customerStatus) {
				const normalizedStatus = normalizeCustomerStatus(customerStatus);
				const options = !this.isAdmin && postConvertedStatusValues.includes(normalizedStatus)
					? statusOptions.filter((item) => postConvertedStatusValues.includes(item.value))
					: statusOptions;
				const statusColumn = this.followup.form.columns.find((item) => item.key === 'status');
				if (statusColumn) statusColumn.data = options;
			},
			setFollowupFormData(data) {
				this.followup.skipConvertedStatusPrompt = true;
				this.followup.form.data = data;
				this.$nextTick(() => {
					this.followup.skipConvertedStatusPrompt = false;
				});
			},
			openFollowup() {
				if (!this.canEditWorkflow) return;
				this.syncFollowupStatusOptions(this.form.data.status);
				this.followup.editingIndex = -1;
				this.followup.form.type = 'add';
				this.followup.form.action = 'business/custom2.addFollowup';
				this.setFollowupFormData({
					customer_id: this.form.data._id,
					contact_time: new Date(),
					status: normalizeCustomerStatus(this.form.data.status),
					content: '',
				});
				this.followup.show = true;
			},
			editFollowup(record, index) {
				if (!this.canEditFollowupRecord(record)) {
					this.showCustomerSubmitNotice('已签单或已退单的进度只有管理员可以编辑');
					return;
				}
				this.syncFollowupStatusOptions(this.form.data.status);
				this.followup.editingIndex = index;
				this.followup.form.type = 'update';
				this.followup.form.action = 'business/custom2.updateFollowup';
				this.setFollowupFormData({
					customer_id: this.form.data._id,
					followup_id: record._id,
					contact_time: record.contact_time ? new Date(record.contact_time) : new Date(),
					status: normalizeCustomerStatus(record.status),
					content: record.content || '',
				});
				this.followup.show = true;
			},
			editFollowupFromDetail(record) {
				if (!this.canEditFollowupRecord(record)) {
					this.showCustomerSubmitNotice('已签单或已退单的进度只有管理员可以编辑');
					return;
				}
				this.syncFollowupStatusOptions(this.detail.data.status);
				this.followup.editingIndex = (this.detail.data.followup_records || []).indexOf(record);
				this.followup.form.type = 'update';
				this.followup.form.action = 'business/custom2.updateFollowup';
				this.setFollowupFormData({
					customer_id: this.detail.data._id,
					followup_id: record._id,
					contact_time: record.contact_time ? new Date(record.contact_time) : new Date(),
					status: normalizeCustomerStatus(record.status),
					content: record.content || '',
				});
				this.detail.show = false;
				this.followup.show = true;
			},
			removeFollowupFromDetail(record, index) {
				if (!this.canEditWorkflow) return;
				if (this.isTransferRecord(record) && !this.isAdmin) return;
				this.$confirm('确定删除这条进度记录吗？', '提示', {
					confirmButtonText: '确定删除',
					cancelButtonText: '取消',
					type: 'warning',
				}).then(() => {
					vk.callFunction({
						url: 'business/custom2.deleteFollowup',
						data: { customer_id: this.detail.data._id, followup_id: record._id },
						success: (result = {}) => {
							this.detail.data.followup_records = Array.isArray(result.records)
								? result.records
								: this.sortFollowupRecords(this.detail.data.followup_records.filter((item) => item._id !== record._id));
							this.detail.data.status = result.status || this.getLatestManualFollowupStatus(this.detail.data.followup_records);
							this.detail.data.progress = result.progress || this.getLatestManualFollowupContent(this.detail.data.followup_records);
							this.$notify({ title: '提示', message: '进度记录已删除', type: 'success', position: 'bottom-right' });
						},
					});
				}).catch(() => {});
			},
			followupSuccess(result = {}) {
				if (this.$notify && typeof this.$notify.closeAll === 'function') this.$notify.closeAll();
				const followupId = this.followup.form.data.followup_id || this.followup.form.data._id;
				const currentUser = (this.$store && this.$store.state && this.$store.state.$user && this.$store.state.$user.userInfo) || {};
				const currentUserId = currentUser._id || currentUser.uid || currentUser.user_id || '';
				const currentUserName = currentUser.nickname || currentUser.username || currentUser.realname || '';
				const record = {
					...this.followup.form.data,
					_id: followupId,
					contact_time: this.followup.form.data.contact_time,
					// 兼容云函数尚未更新时的返回结果，正式记录仍由服务端写入。
					...(currentUserId ? { operator_id: currentUserId, last_operator_id: currentUserId } : {}),
					...(currentUserName ? { operator_name: currentUserName, last_operator_name: currentUserName } : {}),
				};
				let records = Array.isArray(result.records) ? result.records : [...(this.form.data.followup_records || [])];
				if (Array.isArray(result.records) && followupId) {
					records = records.map((item) => item && item._id === followupId
						? {
							...item,
							...(item.operator_id || currentUserId ? { operator_id: item.operator_id || currentUserId } : {}),
							...(item.operator_name || currentUserName ? { operator_name: item.operator_name || currentUserName } : {}),
							...(item.last_operator_id || currentUserId ? { last_operator_id: item.last_operator_id || currentUserId } : {}),
							...(item.last_operator_name || currentUserName ? { last_operator_name: item.last_operator_name || currentUserName } : {}),
						}
						: item);
				}
				if (!result.records) {
					if (this.followup.editingIndex > -1) {
						records.splice(this.followup.editingIndex, 1, record);
					} else {
						records.unshift(record);
					}
					records = this.sortFollowupRecords(records);
				}
				this.form.data.followup_records = records;
				// 已签单确认已在进度弹窗中完成，回到客户编辑页时跳过同一次操作的重复确认。
				const latestFollowupStatus = normalizeCustomerStatus(result.status || this.getLatestManualFollowupStatus(records));
				if (latestFollowupStatus === 'converted' && normalizeCustomerStatus(this.followup.form.data.status) === 'converted') {
					this.form.convertedStatusConfirmed = true;
				}
				if (this.detail.data && this.detail.data._id === this.followup.form.data.customer_id) {
					this.detail.data.followup_records = records;
					this.detail.data.status = result.status || this.getLatestManualFollowupStatus(records);
					this.detail.data.progress = result.progress || this.getLatestManualFollowupContent(records);
				}
				if (this.form.data && this.form.data._id === this.followup.form.data.customer_id) {
					this.form.data.status = result.status || this.getLatestManualFollowupStatus(records);
					this.form.data.progress = result.progress || this.getLatestManualFollowupContent(records);
				}
				this.$notify({
					title: '提示',
					message: result.msg || (this.followup.editingIndex > -1 ? '进度已更新' : '进度已保存'),
					type: 'success',
					position: 'bottom-right',
				});
				this.followup.show = false;
			},
			removeFollowup(record, index) {
				if (!this.canEditWorkflow) return;
				this.$confirm('确定删除这条进度记录吗？', '提示', {
					confirmButtonText: '确定删除',
					cancelButtonText: '取消',
					type: 'warning',
				}).then(() => {
					vk.callFunction({
						url: 'business/custom2.deleteFollowup',
						data: { customer_id: this.form.data._id, followup_id: record._id },
						success: (result = {}) => {
							this.form.data.followup_records = Array.isArray(result.records)
								? result.records
								: this.sortFollowupRecords(this.form.data.followup_records.filter((item) => item._id !== record._id));
							this.form.data.status = result.status || this.getLatestManualFollowupStatus(this.form.data.followup_records);
							this.form.data.progress = result.progress || this.getLatestManualFollowupContent(this.form.data.followup_records);
							this.$notify({ title: '提示', message: '进度记录已删除', type: 'success', position: 'bottom-right' });
						},
					});
				}).catch(() => {});
			},
			getFollowupRecordTime(record = {}) {
				const values = [record.contact_time, record.create_time, record.update_time, record._add_time];
				for (const value of values) {
					if (!value) continue;
					const date = value instanceof Date ? value : new Date(value);
					const time = date.getTime();
					if (!Number.isNaN(time)) return time;
					const numericValue = Number(value);
					if (Number.isFinite(numericValue) && numericValue > 0) return numericValue;
				}
				return 0;
			},
			sortFollowupRecords(records = []) {
				return [...(Array.isArray(records) ? records : [])].sort((a, b) => {
					const timeDiff = this.getFollowupRecordTime(b) - this.getFollowupRecordTime(a);
					if (timeDiff) return timeDiff;
					return this.getFollowupRecordTime({ contact_time: b.create_time }) - this.getFollowupRecordTime({ contact_time: a.create_time });
				});
			},
			getLatestManualFollowup(records = []) {
				return this.sortFollowupRecords(records).find((item) => !this.isSystemRecord(item) && !this.isTransferRecord(item));
			},
			getLatestManualFollowupStatus(records = []) {
				const latestRecord = this.getLatestManualFollowup(records);
				return latestRecord && latestRecord.status ? normalizeCustomerStatus(latestRecord.status) : 'initial_contact';
			},
			getLatestManualFollowupContent(records = []) {
				const latestRecord = this.getLatestManualFollowup(records);
				return latestRecord ? latestRecord.content || '' : '';
			},
			formatFollowupTime(value) {
				if (!value) return '';
				const date = new Date(value);
				if (Number.isNaN(date.getTime())) return value;
				const pad = (number) => String(number).padStart(2, '0');
				return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
			},
			formatFollowupOperator(record = {}) {
				if (record.last_operator_name) return `编辑人：${record.last_operator_name}`;
				if (record.operator_name) return `记录人：${record.operator_name}`;
				if (record.consultant_name) return `记录人：${record.consultant_name}`;
				if (record.consultant_id) return '记录人：当前咨询师';
				const currentUser = (this.$store && this.$store.state && this.$store.state.$user && this.$store.state.$user.userInfo) || {};
				const currentUserId = currentUser._id || currentUser.uid || currentUser.user_id || '';
				const operatorId = record.last_operator_id || record.operator_id || '';
				if (operatorId && currentUserId && String(operatorId) === String(currentUserId)) {
					const currentUserName = currentUser.nickname || currentUser.username || currentUser.realname || '当前用户';
					return `记录人：${currentUserName}`;
				}
				return '记录人：未记录';
			},
			isTransferRecord(record) {
				if (!record) return false;
				if (record.record_type === 'transfer') return true;
				const content = String(record.content || '');
				return /^客户已从“[^”]+”转移至“[^”]+”$/.test(content) || /^咨询师：.+ 变更为 .+$/.test(content);
			},
			isSystemRecord(record) {
				if (!record) return false;
				return record.record_type === 'system' || /^客户已被.+(删除|恢复)$/.test(String(record.content || ''));
			},
			hasManualFollowupRecords(records = []) {
				return (Array.isArray(records) ? records : []).some((record) => !this.isSystemRecord(record) && !this.isTransferRecord(record));
			},
			isLeadProviderConsultantLocked(data = {}) {
				if (!this.isLeadProviderRole) return false;
				if (!data || !data._id) return false;
				return Boolean(data.consultant_info_modified_at);
			},
			systemRecordAction(record) {
				return record && record.action === 'restore' || String(record && record.content || '').endsWith('恢复') ? 'restore' : 'delete';
			},
			systemRecordPrefix(record) {
				return String(record && record.content || '').replace(/(删除|恢复)$/, '');
			},
			transferConsultants(record) {
				if (record && (record.from_consultant_name || record.to_consultant_name)) {
					return { from: record.from_consultant_name || '未分配', to: record.to_consultant_name || '未分配' };
				}
				const content = String(record && record.content || '');
				let match = content.match(/^客户已从“([^”]+)”转移至“([^”]+)”$/);
				if (!match) match = content.match(/^咨询师：(.+?) 变更为 (.+)$/);
				return match ? { from: match[1], to: match[2] } : { from: '未分配', to: '未分配' };
			},
			materialFileName(file) {
				const value = typeof file === 'string' ? file : (file && (file.name || file.url || file.fileID || file.file_id || file.tempFilePath)) || '';
				const name = value.split('?')[0].split('/').pop();
				return decodeURIComponent(name || '客户资料');
			},
			materialFileUrl(file) {
				if (typeof file === 'string') return file;
				return file && (file.url || file.fileURL || file.fileID || file.file_id || file.tempFilePath || file.filePath) || '';
			},
			resolveMaterialFiles(files) {
				const source = Array.isArray(files) ? files : [];
				const fileIds = source.map((file) => {
					if (typeof file === 'string') return /^(https?:|blob:|data:)/i.test(file) ? '' : file;
					const candidate = file && (file.fileID || file.file_id || file.url || file.fileURL);
					return candidate && !/^(https?:|blob:|data:)/i.test(candidate) ? candidate : '';
				}).filter(Boolean);
				if (!fileIds.length || typeof uniCloud === 'undefined' || typeof uniCloud.getTempFileURL !== 'function') {
					return Promise.resolve(source);
				}
				return new Promise((resolve) => {
					uniCloud.getTempFileURL({
						fileList: [...new Set(fileIds)],
						success: (result) => {
							const urlMap = {};
							(result.fileList || []).forEach((item) => {
								if (item.fileID && item.tempFileURL) urlMap[item.fileID] = item.tempFileURL;
							});
							resolve(source.map((file) => {
								const fileId = typeof file === 'string' ? file : file && (file.fileID || file.file_id || file.url || file.fileURL);
								if (!fileId || !urlMap[fileId]) return file;
								return typeof file === 'string' ? { fileID: fileId, url: urlMap[fileId] } : { ...file, url: urlMap[fileId] };
							}));
						},
						fail: () => resolve(source),
					});
				});
			},
			materialFileExt(file) {
				const name = this.materialFileName(file);
				const match = name.match(/\.([a-z0-9]+)$/i);
				return match ? match[1].toUpperCase() : 'FILE';
			},
			materialFileSize(file) {
				const size = typeof file === 'object' && file ? Number(file.size) : 0;
				if (!size) return '--';
				if (size < 1024) return `${size} B`;
				if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
				return `${(size / 1024 / 1024).toFixed(1)} MB`;
			},
			materialFileDate(file) {
				const value = typeof file === 'object' && file ? (file.uploaded_at || file.created_at) : 0;
				if (!value) return '--';
				const date = new Date(value);
				if (Number.isNaN(date.getTime())) return '--';
				return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
			},
			materialFileIcon(file) {
				const ext = this.materialFileExt(file).toLowerCase();
				if (['doc', 'docx'].includes(ext)) return 'W';
				if (['xls', 'xlsx'].includes(ext)) return 'X';
				if (['ppt', 'pptx'].includes(ext)) return 'P';
				if (ext === 'pdf') return 'PDF';
				return ext.toUpperCase() || 'FILE';
			},
			isMaterialImage(file) {
				return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(this.materialFileName(file));
			},
			materialImageUrls() {
				return this.materialFiles.filter(file => this.isMaterialImage(file)).map(file => this.materialFileUrl(file));
			},
			downloadMaterial(file) {
				const url = this.materialFileUrl(file);
				if (!url) return;
				if (typeof document === 'undefined') {
					uni.downloadFile({ url });
					return;
				}
				const link = document.createElement('a');
				link.href = url;
				link.download = this.materialFileName(file);
				link.target = '_blank';
				link.rel = 'noopener';
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
			},
			removeMaterial(file, index) {
				this.$confirm('确定删除这份资料吗？', '提示', {
					confirmButtonText: '确定删除',
					cancelButtonText: '取消',
					type: 'warning',
				}).then(() => {
					this.materialFiles.splice(index, 1);
					const url = this.materialFileUrl(file);
					const attachments = Array.isArray(this.form.data.attachments) ? this.form.data.attachments : [];
					this.form.data.attachments = attachments.filter(item => this.materialFileUrl(item) !== url);
					this.persistMaterialAttachments('资料已删除');
				}).catch(() => {});
			},
			persistMaterialAttachments(message) {
				if (!this.form.data._id) return;
				vk.callFunction({
					url: 'business/custom2.save',
					data: this.form.data,
					success: (result) => {
						if (result && result.code === 0) {
							if (message) {
								if (this.$notify && typeof this.$notify.closeAll === 'function') this.$notify.closeAll();
								this.$notify({ title: '提示', message, type: 'success', position: 'bottom-right' });
							}
						}
					},
					fail: () => {
						this.$notify({ title: '提示', message: '资料保存失败，请重试', type: 'error', position: 'bottom-right' });
					},
				});
			},
			materialFileClass(file) {
				const ext = this.materialFileExt(file).toLowerCase();
				if (['doc', 'docx'].includes(ext)) return 'is-word';
				if (['xls', 'xlsx'].includes(ext)) return 'is-excel';
				if (['ppt', 'pptx'].includes(ext)) return 'is-ppt';
				if (ext === 'pdf') return 'is-pdf';
				return 'is-file';
			},
			uploadMaterialFile(options) {
				const file = options.file;
				const name = file && file.name ? file.name : '';
				const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
				const filePath = URL.createObjectURL(file);
				let uploadedResult = null;
				vk.uploadFile({
					title: '上传资料中...',
					filePath,
					file,
					fileType: isImage ? 'image' : 'other',
					needSave: Boolean(this.form.data._id),
					provider: 'unicloud',
					onUploadProgress: (event) => {
						if (typeof options.onProgress === 'function') options.onProgress({ percent: event.progress || 0 });
					},
					success: (result) => {
						uploadedResult = result;
						URL.revokeObjectURL(filePath);
						const uploadedUrl = this.materialFileUrl(result);
						if (uploadedUrl) {
							const uploadedFile = { url: uploadedUrl, fileURL: result.fileURL, fileID: result.fileID, file_id: result.fileID, name, size: file && file.size || 0, uploaded_at: Date.now() };
							if (!this.materialFiles.some(item => this.materialFileUrl(item) === uploadedUrl)) {
								this.materialFiles.push(uploadedFile);
							}
							const attachments = Array.isArray(this.form.data.attachments) ? this.form.data.attachments : [];
							if (!attachments.some(item => this.materialFileUrl(item) === uploadedUrl)) {
								this.form.data.attachments = attachments.concat(uploadedFile);
								this.persistMaterialAttachments('资料已上传');
							}
						}
						if (typeof options.onSuccess === 'function') options.onSuccess(result, file);
					},
					addComplete: () => {
						if (!this.form.data._id || !uploadedResult || !uploadedResult.fileID) return;
						this.syncCustomerMaterials({
							_id: this.form.data._id,
							parent_name: this.form.data.parent_name,
							attachments: [{ fileID: uploadedResult.fileID, fileURL: uploadedResult.fileURL, name, size: file && file.size || 0 }],
						});
					},
					fail: (error) => {
						URL.revokeObjectURL(filePath);
						if (typeof options.onError === 'function') options.onError(error);
					},
				});
			},
	success(result = {}) {
			// 关闭框架自动弹出的右上角成功提示，只保留页面右下角轻提示
			if (this.$notify && typeof this.$notify.closeAll === 'function') this.$notify.closeAll();
			const convertedMessage = result && result.msg && String(result.msg).includes('已签单') ? result.msg : '';
			const successMessage = this.isLeadProviderRole
				? (this.form.type === 'update' ? '客户信息已更新' : '已成功分发')
				: (this.form.type === 'update' ? '客户信息已更新' : '客户信息已新增');
			this.$notify({
				title: '提示',
				message: convertedMessage || successMessage,
				type: 'success',
				position: 'bottom-right',
			});
			this.form.submitting = false;
			this.$set(this.form, 'show', false);
			this.$nextTick(() => this.refresh());
				},
			 syncCustomerMaterials(data) {
				if (!data || !data._id || !Array.isArray(data.attachments)) return;
				vk.callFunction({
					url: 'business/custom2.syncMaterials',
					data: { customer_id: data._id, attachments: data.attachments },
				});
			},
			closeCustomerDialog() {
				this.form.show = false;
			},
			showCustomerSubmitNotice(message, type = 'warning') {
				if (!message) return;
				if (this.$notify && typeof this.$notify.closeAll === 'function') this.$notify.closeAll();
				this.$notify({
					title: '提示',
					message,
					type,
					position: 'bottom-right',
				});
			},
			submitCustomerByRequest() {
				vk.callFunction({
					url: this.form.action,
					data: this.form.data,
					success: (result) => {
						if (result && result.code === 0) {
							this.success(result);
							return;
						}
						this.form.submitting = false;
						this.showCustomerSubmitNotice((result && result.msg) || '客户信息保存失败，请重试');
					},
					fail: (error) => {
						this.form.submitting = false;
						const message = error && (error.msg || error.message) || '客户信息保存失败，请重试';
						this.showCustomerSubmitNotice(message, 'error');
					},
				});
			},
			validateAndSubmitCustomer() {
				const customerForm = this.$refs.customerForm;
				const innerForm = customerForm && customerForm.$refs && (customerForm.$refs.form || customerForm.$refs.elForm);
				if (innerForm && typeof innerForm.validate === 'function') {
					innerForm.validate((valid) => {
						if (!valid) {
							this.form.submitting = false;
							this.showCustomerSubmitNotice('请先完善必填信息');
							return;
						}
						this.submitCustomerByRequest();
					});
					return;
				}
				this.submitCustomerByRequest();
			},
			submitCustomerDialog() {
				if (this.form.submitting) return;
				// 顶部“咨询师”选择框不在 vk-data-form 内，需在外层提交入口单独校验。
				if (this.canAssignConsultantInForm && !String(this.form.data.consultant_id || '').trim()) {
					this.activeCustomerTab = 'info';
					this.showCustomerSubmitNotice('请选择咨询师');
					return;
				}
				if (
					this.isLeadProviderRole &&
					this.form.data &&
					this.form.data._id &&
					this.form.data.consultant_info_modified_at &&
					String(this.form.data.consultant_id || '') !== String(this.form.data.original_consultant_id || '')
				) {
					this.activeCustomerTab = 'info';
					this.showCustomerSubmitNotice('咨询师已修改客户资料，不能再修改咨询师');
					return;
				}
				this.form.submitting = true;
				// 客户信息改为外层显式提交，这样后端业务拦截也能统一转为右下角提醒。
				this.activeCustomerTab = 'info';
				this.$nextTick(() => {
					this.confirmConvertedCustomerBeforeSubmit(() => {
						this.validateAndSubmitCustomer();
					});
				});
			},
			},
	};
</script>

<style lang="scss" scoped>
	page {
		background-color: var(--bgcolor);
	}

	/* 客户筛选区采用自适应网格，不再依赖固定屏幕断点或 nth-child 排版。 */
	::v-deep .vk-page-search-card .vk-data-table-query .el-form {
		display: grid !important;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
		gap: 12px 16px;
		align-items: center;
	}

	::v-deep .vk-page-search-card .vk-data-table-query .el-form-item {
		box-sizing: border-box;
		width: auto !important;
		min-width: 0;
		margin: 0 !important;
	}

	::v-deep .vk-page-search-card .vk-data-table-query .el-form-item__label {
		box-sizing: border-box;
		width: 88px !important;
		padding-right: 10px;
		white-space: nowrap;
	}

	::v-deep .vk-page-search-card .vk-data-table-query .el-form-item__content {
		min-width: 0;
		margin-left: 0 !important;
		flex: 1;
	}

	::v-deep .vk-page-search-card .vk-data-table-query .el-input,
	::v-deep .vk-page-search-card .vk-data-table-query .el-select,
	::v-deep .vk-page-search-card .vk-data-table-query .el-date-editor {
		width: 100% !important;
	}

	/* 客户搜索和时间范围需要更宽，其他条件保持统一宽度。 */
	::v-deep .vk-page-search-card .vk-data-table-query .el-form-item:has(.query-input),
	::v-deep .vk-page-search-card .vk-data-table-query .el-form-item:has(.customer-created-time-range) {
		grid-column: span 2;
	}

	::v-deep .vk-page-search-card .customer-created-time-range {
		box-sizing: border-box;
		min-width: 0;
	}

	::v-deep .vk-page-search-card .customer-created-time-range .el-range-input {
		min-width: 0;
		width: calc(50% - 10px);
	}

	::v-deep .vk-page-search-card .vk-data-table-query .form-item--actions {
		grid-column: 1 / -1;
		justify-self: end;
		width: auto !important;
	}

	::v-deep .vk-page-search-card .vk-data-table-query .form-item--actions .el-form-item__content {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 8px;
	}

	@media (max-width: 680px) {
		::v-deep .vk-page-search-card .vk-data-table-query .el-form {
			grid-template-columns: minmax(0, 1fr);
		}

		::v-deep .vk-page-search-card .vk-data-table-query .el-form-item:has(.query-input),
		::v-deep .vk-page-search-card .vk-data-table-query .el-form-item:has(.customer-created-time-range) {
			grid-column: span 1;
		}

		::v-deep .vk-page-search-card .vk-data-table-query .form-item--actions {
			grid-column: 1;
			justify-self: stretch;
		}

		::v-deep .vk-page-search-card .vk-data-table-query .form-item--actions .el-form-item__content {
			justify-content: flex-start;
		}
	}

	.customer-detail-shell {
		padding: 0 16px 16px;
		background: #fff;
		color: #24324a;
	}

	::v-deep .customer-detail-dialog .el-dialog__header {
		padding: 8px 16px 0;
		border-bottom: 0;
	}

	::v-deep .customer-detail-dialog.el-dialog {
		display: flex;
		flex-direction: column;
		max-height: 96vh;
		margin-top: 2vh !important;
		margin-bottom: 2vh !important;
	}

	::v-deep .customer-detail-dialog.el-dialog .el-dialog__body {
		flex: 1;
		min-height: 0;
		max-height: calc(96vh - 30px);
		overflow-y: auto;
		padding: 0 0 16px;
	}

	.customer-detail-heading {
		padding: 4px 6px 18px;
		color: #101828;
		font-size: 24px;
		font-weight: 700;
	}

	.customer-detail-profile {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 22px 28px 0;
		border: 1px solid #dbe5f2;
		border-bottom: 0;
		border-radius: 10px 10px 0 0;
	}

	.customer-detail-profile__identity,
	.customer-detail-profile__actions,
	.customer-detail-summary__item,
	.customer-detail-field,
	.customer-detail-side-title,
	.customer-detail-recent__meta {
		display: flex;
		align-items: center;
	}

	.customer-detail-profile__identity {
		gap: 12px;
		padding-bottom: 22px;
	}

	.customer-detail-profile__name {
		color: #1d2939;
		font-size: 24px;
		font-weight: 700;
	}

	.customer-name-cell {
		display: inline-flex;
		align-items: center;
		min-width: 0;
	}

	.customer-name-cell.is-starred .customer-name-text {
		color: #f5a623;
		font-weight: 600;
	}

	.customer-detail-wechat {
		padding: 6px 11px;
		border: 1px solid #a8e5c0;
		border-radius: 5px;
		background: #edfff3;
		color: #18a058;
		font-size: 13px;
	}

	.customer-detail-consultant {
		padding: 6px 11px;
		border: 1px solid #c9d9f3;
		border-radius: 5px;
		background: #f3f7ff;
		color: #4773ad;
		font-size: 13px;
		white-space: nowrap;
	}

	.customer-detail-profile__actions {
		gap: 12px;
		padding-bottom: 22px;
	}

	.customer-detail-profile__actions .detail-focus-action {
		border-color: #f7d98b;
		background: #fffdf6;
		color: #c88719;
	}

	.customer-detail-profile__actions .detail-focus-action:hover,
	.customer-detail-profile__actions .detail-focus-action:focus {
		border-color: #f3c95f;
		background: #fff7df;
		color: #b87508;
	}

	.customer-detail-profile__actions .detail-focus-action.is-starred {
		border-color: #f5a623;
		background: #f5a623;
		color: #fff;
	}

	.customer-detail-profile__actions .detail-focus-action.is-starred:hover,
	.customer-detail-profile__actions .detail-focus-action.is-starred:focus {
		border-color: #df8f0e;
		background: #df8f0e;
		color: #fff;
	}

	.customer-detail-tabs {
		display: flex;
		gap: 34px;
		padding: 0 28px;
		border: 1px solid #dbe5f2;
		border-top: 0;
	}

	.customer-detail-tab {
		position: relative;
		padding: 14px 0 13px;
		color: #667085;
		font-size: 16px;
		cursor: pointer;
	}

	.customer-detail-tab.is-active {
		color: #1677ff;
		font-weight: 600;
	}

	.customer-detail-tab.is-active::after {
		position: absolute;
		right: 0;
		bottom: -1px;
		left: 0;
		height: 3px;
		border-radius: 3px 3px 0 0;
		background: #1677ff;
		content: '';
	}

	.customer-detail-view {
		padding: 20px 8px 0;
	}

	.customer-detail-summary {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr)) 1.5fr;
		margin-bottom: 18px;
		border: 1px solid #dbe5f2;
		border-radius: 8px;
		background: #fff;
	}

	.customer-detail-summary__item {
		min-width: 0;
		gap: 12px;
		padding: 18px 14px;
		border-right: 1px solid #e8edf3;
	}

	.customer-detail-summary__item:last-child {
		border-right: 0;
	}

	.customer-detail-summary__item > i {
		color: #3286ef;
		font-size: 22px;
	}

	.customer-detail-wechat-icon {
		flex: 0 0 22px;
		width: 22px;
		height: 22px;
	}

	.customer-detail-summary__item > view {
		min-width: 0;
		flex: 1;
		overflow: hidden;
	}

	.customer-detail-summary__item.is-green > i { color: #17b26a; }
	.customer-detail-summary__item.is-orange > i { color: #f79009; }

	.customer-detail-summary__item text,
	.customer-detail-summary__item strong {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		word-break: break-all;
	}

	.customer-detail-summary__item text {
		margin-bottom: 5px;
		color: #667085;
		font-size: 12px;
	}

	.customer-detail-summary__item strong {
		color: #344054;
		font-size: 14px;
		font-weight: 500;
		line-height: 1.4;
		max-height: 2.8em;
		white-space: normal;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
	}

	.customer-detail-summary__item--time strong {
		color: #344054;
		font-size: 14px;
		font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif;
		font-weight: 500;
		line-height: 1.4;
		white-space: normal;
		display: block;
	}

	.customer-detail-summary__item--time strong > text {
		display: block;
		white-space: nowrap;
	}

	::v-deep .customer-profile-dialog.el-dialog.is-fullscreen {
		display: flex;
		flex-direction: column;
	}

	::v-deep .customer-profile-dialog.el-dialog.is-fullscreen .el-dialog__body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	::v-deep .customer-profile-dialog.el-dialog {
		display: flex;
		flex-direction: column;
		max-height: 94vh;
		margin-top: 3vh !important;
		margin-bottom: 3vh !important;
	}

	::v-deep .customer-profile-dialog.el-dialog .el-dialog__body {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		padding: 0 !important;
		overflow: hidden;
	}

	::v-deep .customer-profile-dialog.el-dialog .customer-tab-content {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	::v-deep .customer-profile-dialog.el-dialog .customer-tab-content .admin-form {
		max-height: none !important;
		overflow: visible !important;
	}

	::v-deep .customer-profile-dialog.el-dialog .dialog-footer {
		display: none;
	}

	.customer-profile-footer {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		padding: 12px 26px;
		border-top: 1px solid #e8edf3;
		background: #fff;
	}

	.customer-detail-layout {
		display: grid;
		grid-template-columns: minmax(0, 2.1fr) minmax(300px, .9fr);
		gap: 16px;
	}

	.customer-detail-main,
	.customer-detail-side {
		min-width: 0;
	}

	.customer-detail-card {
		margin-bottom: 12px;
		padding: 16px 18px;
		border: 1px solid #dbe5f2;
		border-radius: 8px;
		background: #fff;
	}

	.customer-detail-card__title {
		display: flex;
		align-items: center;
		gap: 9px;
		margin-bottom: 14px;
		color: #24324a;
		font-size: 16px;
		font-weight: 700;
	}

	.customer-detail-card__title > i,
	.customer-detail-side-title > div > i {
		display: inline-block;
		width: 4px;
		height: 18px;
		border-radius: 2px;
		background: #1677ff;
	}

	.customer-detail-fields {
		display: grid;
		grid-template-columns: 1fr 1fr;
		border-top: 1px solid #e8edf3;
		border-left: 1px solid #e8edf3;
	}

	.customer-detail-field {
		min-width: 0;
		gap: 10px;
		min-height: 42px;
		padding: 0 12px;
		border-right: 1px solid #e8edf3;
		border-bottom: 1px solid #e8edf3;
	}

	.customer-detail-field > i {
		width: 16px;
		color: #3286ef;
		font-size: 15px;
		text-align: center;
	}

	.customer-detail-field > span,
	.customer-detail-text-row > span,
	.customer-detail-regions > span {
		flex: 0 0 86px;
		color: #667085;
		font-size: 13px;
	}

	.customer-detail-field > strong,
	.customer-detail-text-row > strong {
		min-width: 0;
		overflow: hidden;
		color: #344054;
		font-size: 13px;
		font-weight: 500;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.customer-detail-text-row,
	.customer-detail-regions {
		display: flex;
		align-items: flex-start;
		gap: 14px;
		padding: 12px;
		border: 1px solid #e8edf3;
		border-top: 0;
		background: #fbfcfe;
	}

	.customer-detail-text-row > strong {
		flex: 1;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.customer-detail-regions > view {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.customer-detail-regions em {
		color: #98a2b3;
		font-size: 13px;
		font-style: normal;
	}

	.customer-detail-side-title {
		justify-content: space-between;
		margin-bottom: 14px;
		color: #24324a;
		font-size: 16px;
		font-weight: 700;
	}

	.customer-detail-side-title > div {
		display: flex;
		align-items: center;
		gap: 9px;
	}

	.customer-detail-side-title > span,
	.customer-detail-side-title .el-button {
		color: #667085;
		font-size: 12px;
		font-weight: 400;
	}

	.customer-detail-recent {
		display: flex;
		gap: 12px;
		padding: 16px 12px;
		border: 1px solid #e8edf3;
		border-radius: 7px;
	}

	.customer-detail-recent__dot {
		width: 9px;
		height: 9px;
		margin-top: 5px;
		border: 3px solid #3286ef;
		border-radius: 50%;
		background: #fff;
		box-sizing: content-box;
	}

	.customer-detail-recent__meta {
		gap: 8px;
		margin-bottom: 9px;
		color: #667085;
		font-size: 12px;
	}

	.customer-detail-recent strong {
		color: #344054;
		font-size: 14px;
		font-weight: 500;
		line-height: 1.6;
	}

	.customer-detail-card__link {
		display: block;
		width: 100%;
		margin-top: 12px;
		padding: 9px 0;
		border: 1px solid #e8edf3;
		border-radius: 5px;
		color: #1677ff;
	}

	.customer-detail-materials {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
	}

	.customer-detail-material {
		min-width: 0;
		cursor: pointer;
	}

	.customer-detail-material > .el-image,
	.customer-detail-material__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 86px;
		border: 1px solid #e1e8f0;
		border-radius: 6px;
		background: #f8fafc;
	}

	.customer-detail-material__icon {
		color: #2f75b5;
		font-size: 18px;
		font-weight: 700;
	}

	.customer-detail-material__icon.is-excel { color: #217346; }
	.customer-detail-material__icon.is-ppt { color: #c65911; }
	.customer-detail-material__icon.is-pdf { color: #d43838; }

	.customer-detail-material__name {
		overflow: hidden;
		margin-top: 7px;
		color: #344054;
		font-size: 12px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.customer-detail-material small {
		color: #98a2b3;
		font-size: 11px;
	}

	.customer-detail-empty {
		padding: 22px 8px;
		color: #98a2b3;
		font-size: 13px;
		text-align: center;
	}

	.customer-detail-tab-panel {
		min-height: 620px;
		padding: 20px 8px 0;
	}

	.customer-detail-materials-panel {
		min-height: 550px;
	}

	.customer-detail-bottom {
		display: flex;
		justify-content: flex-end;
		padding-top: 4px;
	}

	@media screen and (max-width: 1100px) {
		.customer-detail-profile {
			padding-right: 18px;
			padding-left: 18px;
		}

		.customer-detail-profile__name {
			font-size: 20px;
		}

		.customer-detail-profile__actions {
			gap: 6px;
		}

		.customer-detail-summary {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.customer-detail-summary__item:nth-child(3n) {
			border-right: 0;
		}

		.customer-detail-summary__item:nth-child(n + 4) {
			border-top: 1px solid #e8edf3;
		}

		.customer-detail-summary__item.is-wide {
			grid-column: span 3;
		}

		.customer-detail-layout {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media screen and (max-width: 720px) {
		::v-deep .customer-detail-dialog.el-dialog {
			width: calc(100vw - 24px) !important;
		}

		.customer-detail-shell {
			padding-right: 8px;
			padding-left: 8px;
		}

		.customer-detail-profile {
			display: block;
			padding: 16px;
		}

		.customer-detail-profile__identity,
		.customer-detail-profile__actions {
			flex-wrap: wrap;
			padding-bottom: 12px;
		}

		.customer-detail-profile__actions {
			padding-bottom: 0;
		}

		.customer-detail-tabs {
			padding: 0 16px;
		}

		.customer-detail-view,
		.customer-detail-tab-panel {
			padding-right: 0;
			padding-left: 0;
		}

		.customer-detail-summary {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.customer-detail-summary__item:nth-child(3n) {
			border-right: 1px solid #e8edf3;
		}

		.customer-detail-summary__item:nth-child(2n) {
			border-right: 0;
		}

		.customer-detail-summary__item:nth-child(n + 3) {
			border-top: 1px solid #e8edf3;
		}

		.customer-detail-summary__item.is-wide {
			grid-column: span 2;
		}

		.customer-detail-fields {
			grid-template-columns: 1fr;
		}
	}

	.customer-tabs {
		padding: 0 26px;
	}

	.customer-tab-switch {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
		padding-top: 12px;
		padding-bottom: 12px;
		border-bottom: 1px solid #e8edf3;
	}

	.customer-tabs__actions {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-left: auto;
	}

	.customer-tabs__consultant {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.customer-tabs__consultant-label {
		font-size: 13px;
		color: #606266;
		white-space: nowrap;
	}

	.customer-tabs__consultant ::v-deep .el-select {
		width: 220px;
	}

	.customer-tab-content {
		min-height: 700px;
		box-sizing: border-box;
	}

	.status-sync-hint {
		margin: 12px 26px 0;
		padding: 9px 12px;
		border: 1px solid #cfe5ff;
		border-radius: 4px;
		background: #f2f8ff;
		color: #5b7694;
		font-size: 12px;
		line-height: 20px;
	}

	.customer-detail-content {
		min-height: 700px;
		padding: 8px 26px 72px;
		box-sizing: border-box;
	}

	.customer-detail-status {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		margin-bottom: 8px;
		border: 1px solid #e7edf5;
		border-radius: 6px;
		background: #fbfcfe;
		color: #667085;
		font-size: 13px;
	}

	.customer-detail-content ::v-deep .vk-data-form {
		padding-bottom: 0;
	}

	.customer-detail-footer {
		display: flex;
		justify-content: flex-end;
		padding: 12px 26px;
		border-top: 1px solid #e8edf3;
		background: #fff;
	}

	.customer-tabs ::v-deep .el-tabs__header {
		margin: 0;
		border-bottom-color: #e8edf3;
	}

	.customer-tabs ::v-deep .el-tabs__nav-wrap::after {
		height: 1px;
		background-color: #e8edf3;
	}

	.customer-tabs ::v-deep .el-tabs__item {
		height: 48px;
		padding: 0 24px;
		color: #7b8797;
		font-size: 15px;
		font-weight: 500;
		line-height: 48px;
	}

	.customer-tabs ::v-deep .el-tabs__item.is-active {
		color: #409eff;
		font-weight: 600;
	}

	.customer-tabs ::v-deep .el-tabs__active-bar {
		height: 3px;
		border-radius: 3px 3px 0 0;
	}

	.customer-tabs ::v-deep .el-tab-pane {
		min-height: 645px;
		padding-top: 6px;
		box-sizing: border-box;
	}

	.followup-panel {
		margin: 0 30px 24px;
		padding: 16px 18px 18px;
		border: 1px solid #e7edf5;
		border-radius: 6px;
		background: #fbfcfe;
	}

	.followup-panel__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 14px;
		border-bottom: 1px solid #edf1f6;
	}

	.followup-panel__title {
		display: flex;
		align-items: center;
		font-size: 15px;
		font-weight: 600;
		color: #303133;
	}

	.followup-panel__line {
		width: 3px;
		height: 16px;
		margin-right: 8px;
		border-radius: 2px;
		background: #409eff;
	}

	.followup-empty {
		padding: 28px 0 12px;
		color: #a8b0bd;
		font-size: 13px;
		text-align: center;
	}

	.followup-list {
		padding-top: 8px;
	}

	.followup-item {
		display: flex;
		position: relative;
		padding: 12px 0 4px;
	}

	.followup-item:not(:last-child)::before {
		content: '';
		position: absolute;
		left: 4px;
		top: 22px;
		bottom: -8px;
		width: 1px;
		background: #dce7f4;
	}

	.followup-item__dot {
		z-index: 1;
		width: 9px;
		height: 9px;
		margin: 4px 14px 0 0;
		border: 2px solid #409eff;
		border-radius: 50%;
		background: #fff;
	}

	.followup-item__body {
		flex: 1;
		min-width: 0;
	}

	.followup-item__meta {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 5px;
	}

	.followup-item__time {
		color: #7b8797;
		font-size: 12px;
	}

	.followup-item__operator {
		color: #98a2b3;
		font-size: 12px;
		white-space: nowrap;
	}

	.followup-item__actions {
		align-self: flex-start;
		white-space: nowrap;
	}

	.followup-item__actions .el-button {
		padding: 2px 4px;
	}

	.followup-delete {
		color: #f56c6c;
	}

	.materials-content {
		padding: 18px 26px 76px;
	}

	.signing-content {
		padding: 18px 26px 76px;
		background: #f8fafc;
	}

	.signing-panel {
		padding: 22px 24px 28px;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		background: #fff;
		box-shadow: 0 4px 14px rgba(15, 23, 42, .04);
	}

	.signing-panel__title {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 18px;
		color: #1e293b;
		font-size: 16px;
		font-weight: 700;
	}

	.signing-panel__hint {
		margin-bottom: 20px;
		padding: 10px 14px;
		border: 1px solid #bfdbfe;
		border-radius: 6px;
		background: #eff6ff;
		color: #49719f;
		font-size: 13px;
		line-height: 1.6;
	}

	.signing-fields {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 20px 28px;
	}

	.signing-field {
		min-width: 0;
	}

	.signing-field--full {
		grid-column: 1 / -1;
	}

	.signing-field__label {
		margin-bottom: 8px;
		color: #475569;
		font-size: 13px;
		font-weight: 600;
	}

	.signing-field ::v-deep .el-select,
	.signing-field ::v-deep .el-input {
		width: 100%;
	}

	.signing-field--full ::v-deep .el-textarea__inner {
		min-height: 150px !important;
		resize: vertical;
	}

	.signing-detail-panel {
		padding: 18px 26px 76px;
		background: #f8fafc;
	}

	.signing-detail-fields {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.signing-detail-fields .customer-detail-text-row {
		grid-column: 1 / -1;
	}

	@media (max-width: 700px) {
		.signing-fields,
		.signing-detail-fields {
			grid-template-columns: 1fr;
		}

		.signing-field--full,
		.signing-detail-fields .customer-detail-text-row {
			grid-column: auto;
		}
	}

	.materials-panel {
		padding: 18px 20px 24px;
		border: 1px solid #e7edf5;
		border-radius: 6px;
		background: #fbfcfe;
	}

	.materials-panel__title {
		display: flex;
		align-items: center;
		margin-bottom: 8px;
		font-size: 15px;
		font-weight: 600;
		color: #303133;
	}

	.materials-panel__tips {
		margin: 0 0 18px 11px;
		color: #8a96a6;
		font-size: 13px;
	}

	.materials-panel__upload {
		margin-top: 4px;
		margin-bottom: 20px;
	}

	.materials-panel__files {
		padding-top: 2px;
	}

	.materials-panel__empty {
		margin-top: 14px;
		color: #e6a23c;
		font-size: 13px;
	}

	.materials-file-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(170px, 170px));
		gap: 16px;
		margin-top: 20px;
	}

	.materials-file-card {
		width: 170px;
		overflow: hidden;
		border: 1px solid #e5eaf2;
		border-radius: 6px;
		background: #fff;
		transition: border-color .2s, box-shadow .2s, transform .2s;
	}

	.materials-file-card:hover {
		border-color: #93c5fd;
		box-shadow: 0 6px 16px rgba(37, 99, 235, .12);
		transform: translateY(-2px);
	}

	.materials-file-card__preview {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 154px;
		border-bottom: 1px solid #edf1f6;
		background: #f1f5f9;
		color: #64748b;
		font-size: 18px;
		font-weight: 700;
	}

	.materials-file-card__preview .el-image {
		width: 100%;
		height: 100%;
		background: #f8fafc;
	}

	.materials-file-card__type {
		position: absolute;
		top: 8px;
		right: 8px;
		z-index: 2;
		padding: 2px 5px;
		border-radius: 4px;
		background: rgba(71, 85, 105, .78);
		color: #fff;
		font-size: 10px;
		line-height: 1.2;
	}

	.materials-file-card__info {
		padding: 10px 10px 4px;
	}

	.materials-file-icon {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 54px;
		height: 64px;
		border-radius: 4px;
		background: currentColor;
		color: #64748b;
		box-shadow: 0 2px 5px rgba(15, 23, 42, .12);
	}

	.materials-file-icon::before {
		content: '';
		position: absolute;
		top: 0;
		right: 0;
		width: 17px;
		height: 17px;
		background: rgba(255, 255, 255, .8);
		clip-path: polygon(0 0, 100% 100%, 0 100%);
	}

	.materials-file-icon__label {
		position: relative;
		z-index: 1;
		color: #fff;
		font-size: 20px;
		font-weight: 800;
		letter-spacing: -1px;
	}

	.materials-file-card__preview.is-pdf .materials-file-icon__label {
		font-size: 13px;
		letter-spacing: 0;
	}

	.materials-file-card__preview.is-word { color: #2f75b5; background: #edf5ff; }
	.materials-file-card__preview.is-excel { color: #217346; background: #edf9f1; }
	.materials-file-card__preview.is-ppt { color: #c65911; background: #fff3eb; }
	.materials-file-card__preview.is-pdf { color: #d43838; background: #fff0f0; }
	.materials-file-card__preview.is-file { color: #64748b; background: #f1f5f9; }

	.materials-file-card__name {
		overflow: hidden;
		color: #303133;
		font-size: 13px;
		font-weight: 600;
		line-height: 1.5;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.materials-file-card__meta {
		display: flex;
		justify-content: space-between;
		gap: 6px;
		margin-top: 6px;
		color: #98a2b3;
		font-size: 11px;
		line-height: 1.4;
	}

	.materials-file-card__meta text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.materials-file-card__actions {
		display: flex;
		justify-content: flex-end;
		gap: 6px;
		padding: 0 8px 8px;
		white-space: nowrap;
	}

	.materials-file-card__actions .el-button {
		padding: 2px 3px;
		font-size: 12px;
	}

	.materials-file-card__delete {
		color: #f56c6c;
	}

	.followup-item__content {
		color: #303133;
		font-size: 14px;
		line-height: 1.7;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.followup-system-content {
		font-weight: 600;
	}

	.followup-system-content text {
		margin-right: 4px;
	}

	.followup-system-action--delete,
	.followup-system-action--restore {
		display: inline-block;
		padding: 1px 7px;
		border-radius: 4px;
		font-weight: 700;
	}

	.followup-system-action--delete {
		color: #c62828;
		background: #ffebee;
	}

	.followup-system-action--restore {
		color: #16794a;
		background: #e8f7ee;
	}

	.followup-transfer-content {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 4px;
	}

	.followup-transfer-name {
		display: inline-block;
		padding: 2px 7px;
		border-radius: 4px;
		font-weight: 600;
	}

	.followup-transfer-name--from {
		color: #b54708;
		background: #fff4e5;
	}

	.followup-transfer-name--to {
		color: #067647;
		background: #ecfdf3;
	}

	/* 手机端用整行进入详情，避免操作栏占用首屏空间 */
	@media screen and (max-width: 600px) {
		.page-body ::v-deep .el-table__fixed-right,
		.page-body ::v-deep .el-table__fixed-right.pltableFixedWrapper {
			display: none !important;
		}

		.page-body ::v-deep .el-table__body-wrapper,
		.page-body ::v-deep .el-table__header-wrapper {
			overflow-x: auto !important;
		}

		.page-body ::v-deep .el-table__body tr {
			cursor: pointer;
		}
	}
</style>
