<template>
  <view class="page-body">
    <view class="vk-page-card vk-page-search-card">
      <vk-data-table-query v-model="queryForm.formData" :columns="queryForm.columns" :span="4" :collapse-rows="1" :collapse-default-expand="true" @search="search"></vk-data-table-query>
    </view>
    <view class="vk-page-card">
      <view class="vk-page-card-toolbar">
        <view class="vk-page-card-title">客户信息</view>
        <view class="vk-page-card-actions">
          <el-button type="primary" :size="$global.size" icon="el-icon-plus" @click="addClient">新增客户</el-button>
          <el-button :size="$global.size" icon="el-icon-refresh" @click="refresh">刷新</el-button>
        </view>
      </view>
      <view class="vk-page-card-table">
        <vk-data-table ref="clientTable" :action="table.action" :columns="table.columns" :query-form-param="queryForm" :right-btns="['detail_auto', 'update', 'delete']" :row-no="true" :pagination="true" :top="0" @update="updateClient" @delete="deleteClient"></vk-data-table>
      </view>
    </view>
    <vk-data-dialog v-model="form.show" :title="form.title" width="680px" top="5vh" mode="form" :close-on-click-modal="false" :destroy-on-close="true">
      <vk-data-form v-model="form.data" :rules="form.rules" :action="form.action" :form-type="form.type" :columns="form.columns" label-width="120px" max-height="720px" @success="onFormSuccess"></vk-data-form>
    </vk-data-dialog>
  </view>
</template>

<script>
  let vk = uni.vk;
  const stageOptions = ['待首次联系', '沟通中', '需求分析', '方案准备', '方案已提交', '签约中', '已签约', '暂缓', '已结束'].map((value) => ({ value, label: value }));
  export default {
    data() {
      return {
        table: {
          action: 'business/custom.getList',
          columns: [
            { key: 'name', title: '客户姓名', type: 'text', minWidth: 140 },
            { key: 'phone', title: '手机号', type: 'text', width: 140 },
            { key: 'wechat', title: '微信号', type: 'text', width: 140 },
            { key: 'stage', title: '咨询阶段', type: 'tag', width: 120, tagType: 'primary' },
            { key: 'source', title: '客户来源', type: 'text', width: 120 },
            { key: 'next_followup_at', title: '下次沟通', type: 'date', width: 140, valueFormat: 'yyyy-MM-dd' },
            { key: 'last_followup_at', title: '最近沟通', type: 'date', width: 140, valueFormat: 'yyyy-MM-dd' },
            { key: '_add_time', title: '创建时间', type: 'time', width: 160, valueFormat: 'yyyy-MM-dd hh:mm:ss' },
          ],
        },
        queryForm: {
          formData: {},
          columns: [
            { key: 'name', title: '客户姓名', type: 'text', placeholder: '请输入客户姓名', mode: '%%' },
            { key: 'phone', title: '手机号', type: 'text', placeholder: '请输入手机号', mode: '%%' },
            { key: 'stage', title: '咨询阶段', type: 'select', placeholder: '请选择阶段', mode: '==', data: stageOptions },
          ],
        },
        form: {
          show: false,
          title: '',
          type: 'add',
          action: 'business/custom.save',
          data: {},
          rules: {
            name: [{ required: true, message: '请输入客户姓名', trigger: 'blur' }],
            phone: [{ required: true, message: '请输入手机号', trigger: 'blur' }],
            stage: [{ required: true, message: '请选择咨询阶段', trigger: 'change' }],
          },
          columns: [
            { key: 'name', title: '客户姓名', type: 'text', placeholder: '请输入客户姓名' },
            { key: 'phone', title: '手机号', type: 'text', placeholder: '请输入手机号' },
            { key: 'wechat', title: '微信号', type: 'text', placeholder: '请输入微信号' },
            { key: 'source', title: '客户来源', type: 'text', placeholder: '如：转介绍、活动、线上咨询' },
            { key: 'stage', title: '咨询阶段', type: 'select', placeholder: '请选择咨询阶段', data: stageOptions },
            { key: 'next_followup_at', title: '下次沟通时间', type: 'date', valueFormat: 'timestamp' },
            { key: 'remark', title: '备注', type: 'textarea', autosize: { minRows: 4, maxRows: 8 }, placeholder: '请输入备注' },
          ],
        },
      };
    },
    onLoad() { vk = this.vk; },
    methods: {
      search() { this.$refs.clientTable.search(); },
      refresh() { this.$refs.clientTable.refresh(); },
      addClient() { this.form.data = { stage: '待首次联系' }; this.form.type = 'add'; this.form.title = '新增客户'; this.form.show = true; },
      updateClient({ item }) { this.form.data = { ...item }; this.form.type = 'update'; this.form.title = '编辑客户'; this.form.show = true; },
      deleteClient({ item, deleteFn }) { deleteFn({ action: 'business/custom.delete', data: { _id: item._id }, refresh: true }); },
      onFormSuccess() { this.form.show = false; this.refresh(); },
    },
  };
</script>

<style lang="scss" scoped>
  page { background-color: var(--bgcolor); }
</style>
