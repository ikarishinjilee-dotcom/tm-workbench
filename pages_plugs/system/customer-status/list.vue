<template>
  <div class="customer-status-page">
    <div class="vk-page-card status-intro-card">
      <div class="status-intro-icon"><i class="el-icon-s-operation"></i></div>
      <div>
        <div class="status-intro-title">客户状态管理</div>
        <div class="status-intro-text">维护客户当前阶段和质量分类。状态编码固定不变，修改配置不会影响历史客户、进度记录和统计数据。</div>
      </div>
    </div>

    <div class="vk-page-card">
      <div class="vk-page-card-toolbar">
        <div>
          <div class="vk-page-card-title">客户状态</div>
          <div class="status-card-tip">停用状态不会出现在新增客户、进度记录和筛选选项中，但历史数据仍会正常展示。</div>
        </div>
        <div class="vk-page-card-actions">
          <el-button type="primary" :size="$global.size" icon="el-icon-plus" @click="addStatus">新增状态</el-button>
          <el-button :size="$global.size" icon="el-icon-refresh" @click="loadStatuses">刷新</el-button>
        </div>
      </div>
      <div class="vk-page-card-table">
        <el-table v-loading="loading" :data="statuses" stripe>
          <el-table-column prop="label" label="状态名称" min-width="220">
            <template v-slot="{ row }">
              <span class="status-name"><i class="el-icon-price-tag"></i>{{ row.label }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="quality_level" label="客户质量" width="130" align="center">
            <template v-slot="{ row }">
              <el-tag :type="qualityTagType(row.quality_level)" size="mini">{{ qualityLabel(row.quality_level) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="value" label="内部编码" min-width="280" />
          <el-table-column prop="sort" label="排序" width="90" align="center" />
          <el-table-column label="类型" width="110" align="center">
            <template v-slot="{ row }">
              <el-tag :type="row.built_in ? 'info' : 'success'" size="mini">{{ row.built_in ? '内置' : '自定义' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="110" align="center">
            <template v-slot="{ row }">
              <el-tag :type="row.enabled === false ? 'warning' : 'success'" size="mini">{{ row.enabled === false ? '已停用' : '已启用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="220" fixed="right">
            <template v-slot="{ row }">
              <el-button type="text" :size="$global.size" @click="editStatus(row)">编辑状态</el-button>
              <el-button type="text" :size="$global.size" @click="toggleStatus(row)">{{ row.enabled === false ? '启用状态' : '停用状态' }}</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="!loading && !statuses.length" class="status-empty"><i class="el-icon-price-tag"></i>暂无客户状态</div>
      </div>
    </div>

    <el-dialog :title="statusDialog.form._id ? '编辑客户状态' : '新增客户状态'" :visible.sync="statusDialog.visible" width="520px" append-to-body>
      <el-form label-width="90px">
        <el-form-item label="状态名称" required>
          <el-input v-model="statusDialog.form.label" maxlength="30" show-word-limit placeholder="例如：已邀约" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="statusDialog.form.sort" :min="1" :max="999" controls-position="right" />
        </el-form-item>
        <el-form-item label="客户质量" required>
          <el-select v-model="statusDialog.form.quality_level" placeholder="请选择客户质量" style="width: 220px">
            <el-option v-for="item in qualityOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="statusDialog.form._id" label="状态">
          <el-switch v-model="statusDialog.form.enabled" active-text="启用" inactive-text="停用" />
        </el-form-item>
        <div class="status-dialog-tip">内部编码由系统维护，不允许修改。停用后不会影响已使用该状态的历史客户。</div>
      </el-form>
      <span slot="footer">
        <el-button @click="statusDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="statusDialog.saving" @click="saveStatus">保存</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
export default {
  data() {
    return {
      loading: false,
      statuses: [],
      statusDialog: {
        visible: false,
        saving: false,
        form: {},
      },
      qualityOptions: [
        { value: 'high', label: '高质量' },
        { value: 'normal', label: '普通' },
        { value: 'low', label: '低质量' },
        { value: 'invalid', label: '无效' },
      ],
    };
  },
  created() {
    this.loadStatuses();
  },
  methods: {
    qualityTagType(level) {
      const map = { high: 'success', normal: 'primary', low: 'warning', invalid: 'danger' };
      return map[level] || 'info';
    },
    qualityLabel(level) {
      const item = this.qualityOptions.find((option) => option.value === level);
      return item ? item.label : '未分类';
    },
    loadStatuses() {
      this.loading = true;
      vk.callFunction({
        url: 'business/custom2.getCustomerStatusOptions',
        data: { include_disabled: true },
        success: (result) => {
          if (result && result.code === 0 && Array.isArray(result.data)) {
            this.statuses = result.data;
          } else {
            this.$message.warning((result && result.msg) || '状态配置加载失败');
          }
        },
        complete: () => {
          this.loading = false;
        },
      });
    },
    addStatus() {
      this.statusDialog.form = { label: '', sort: 100, quality_level: 'normal', enabled: true };
      this.statusDialog.visible = true;
    },
    editStatus(status) {
      this.statusDialog.form = {
        _id: status._id,
        value: status.value,
        label: status.label,
        sort: status.sort,
        quality_level: status.quality_level,
        enabled: status.enabled !== false,
      };
      this.statusDialog.visible = true;
    },
    saveStatus() {
      const form = this.statusDialog.form;
      if (!form.label || !String(form.label).trim()) return this.$message.warning('请输入状态名称');
      if (!form.quality_level) return this.$message.warning('请选择客户质量');
      this.statusDialog.saving = true;
      vk.callFunction({
        url: 'business/custom2.saveCustomerStatusOption',
        data: { ...form, label: String(form.label).trim() },
        success: (result) => {
          if (!result || result.code !== 0) return this.$message.error((result && result.msg) || '状态保存失败');
          this.$message.success(result.msg || '状态已保存');
          this.statusDialog.visible = false;
          this.loadStatuses();
        },
        complete: () => {
          this.statusDialog.saving = false;
        },
      });
    },
    toggleStatus(status) {
      const enabled = status.enabled === false;
      this.$confirm(`确定${enabled ? '启用' : '停用'}客户状态“${status.label}”吗？`, '操作确认', { type: 'warning' })
        .then(() => {
          vk.callFunction({
            url: 'business/custom2.toggleCustomerStatusOption',
            data: { _id: status._id, enabled },
            success: (result) => {
              if (!result || result.code !== 0) return this.$message.error((result && result.msg) || '状态操作失败');
              this.$message.success(result.msg || '状态已更新');
              this.loadStatuses();
            },
          });
        })
        .catch(() => {});
    },
  },
};
</script>

<style lang="scss" scoped>
  .customer-status-page { padding-bottom: 20px; }
  .status-intro-card { display: flex; align-items: center; gap: 14px; padding: 20px 22px; background: linear-gradient(135deg, #eff6ff, #f8fbff); border: 1px solid #dbeafe; }
  .status-intro-icon { display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; border-radius: 12px; color: #2563eb; background: #dbeafe; font-size: 22px; }
  .status-intro-title { color: #16345f; font-size: 18px; font-weight: 700; }
  .status-intro-text, .status-card-tip, .status-dialog-tip { margin-top: 6px; color: #8292aa; font-size: 12px; line-height: 1.7; }
  .status-card-tip { margin-top: 4px; }
  .status-name { display: inline-flex; align-items: center; gap: 8px; color: #183b68; font-weight: 600; }
  .status-name i { color: #3b82f6; }
  .status-empty { padding: 48px 0; color: #9aa9bd; text-align: center; }
  .status-empty i { margin-right: 8px; }
  .status-dialog-tip { padding: 10px 12px; border-radius: 6px; background: #f5f8fc; }
  ::v-deep .el-input-number { width: 180px; }

  /* 移动端适配 */
  @media screen and (max-width: 768px) {
    .status-intro-card { padding: 14px 16px; gap: 10px; }
    .status-intro-icon { width: 38px; height: 38px; font-size: 18px; }
    .status-intro-title { font-size: 16px; }
    ::v-deep .el-table .cell { padding-left: 8px; padding-right: 8px; }
    ::v-deep .el-input-number { width: 100%; }
  }
</style>
