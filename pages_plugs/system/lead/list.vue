<template>
  <div class="lead-permission-page">
    <div class="vk-page-card lead-intro-card">
      <div class="lead-intro-icon"><i class="el-icon-connection"></i></div>
      <div>
        <div class="lead-intro-title">线索管理权限</div>
        <div class="lead-intro-text">按角色配置可管理的线索范围和操作能力。超级管理员默认拥有全部权限。</div>
      </div>
    </div>

    <div class="vk-page-card">
      <div class="vk-page-card-toolbar">
        <div>
          <div class="vk-page-card-title">线索来源</div>
          <div class="source-card-tip">来源名称可随时调整，客户历史记录和权限配置使用稳定编码，不会因改名失效。</div>
        </div>
        <div class="vk-page-card-actions">
          <el-button type="primary" :size="$global.size" icon="el-icon-plus" @click="addSource">新增来源</el-button>
          <el-button :size="$global.size" icon="el-icon-refresh" @click="loadSourceOptions">刷新</el-button>
        </div>
      </div>
      <div class="vk-page-card-table">
        <el-table v-loading="sourceLoading" :data="sourceCatalog" stripe>
          <el-table-column prop="label" label="来源名称" min-width="220">
            <template slot-scope="scope">
              <span class="source-name"><i class="el-icon-connection"></i>{{ scope.row.label }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="value" label="内部编码" min-width="280" />
          <el-table-column label="类型" width="110">
            <template slot-scope="scope">
              <el-tag :type="scope.row.built_in ? 'info' : 'success'" size="mini">{{ scope.row.built_in ? '内置' : '自定义' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180" fixed="right">
            <template slot-scope="scope">
              <el-button type="text" :size="$global.size" @click="editSource(scope.row)">编辑名称</el-button>
              <el-button v-if="!scope.row.built_in" type="text" :size="$global.size" class="danger-text" @click="removeSource(scope.row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="!sourceLoading && !sourceCatalog.length" class="lead-empty"><i class="el-icon-connection"></i>暂无线索来源</div>
      </div>
    </div>

    <div class="vk-page-card">
      <div class="vk-page-card-toolbar">
        <div class="vk-page-card-title">角色线索权限</div>
        <div class="vk-page-card-actions">
          <el-button :size="$global.size" icon="el-icon-refresh" @click="loadRoles">刷新</el-button>
        </div>
      </div>
      <div class="vk-page-card-table">
        <el-table v-loading="loading" :data="roles" stripe>
          <el-table-column prop="role_name" label="角色名称" width="180">
            <template slot-scope="scope">
              <span class="role-name"><i class="el-icon-user"></i>{{ scope.row.role_name }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="role_id" label="角色标识" width="220" />
          <el-table-column label="线索管理" min-width="150">
            <template slot-scope="scope">
              <el-tag :type="hasPermission(scope.row, 'manage') ? 'success' : 'info'" size="mini">
                {{ hasPermission(scope.row, 'manage') ? '可管理' : '未开通' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="来源范围" min-width="260">
            <template slot-scope="scope">
              <span v-if="scope.row.role_id === 'admin'" class="muted-text">全部来源</span>
              <template v-else>
                <el-tag v-for="source in visibleSources(scope.row)" :key="source" class="source-tag" size="mini">{{ sourceLabel(source) }}</el-tag>
                <span v-if="!visibleSources(scope.row).length" class="muted-text">未配置</span>
              </template>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template slot-scope="scope">
              <el-button v-if="scope.row.role_id !== 'admin'" type="text" :size="$global.size" @click="editRole(scope.row)">配置权限</el-button>
              <span v-else class="muted-text">默认全部</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <el-dialog title="配置角色线索权限" :visible.sync="roleDialog.visible" width="520px" append-to-body>
      <div class="dialog-role-summary">
        <div class="dialog-role-name">{{ roleDialog.form.role_name }}</div>
        <div class="dialog-role-id">角色标识：{{ roleDialog.form.role_id }}</div>
      </div>
      <el-form label-width="90px" class="lead-form">
        <el-form-item label="线索管理">
          <el-checkbox-group v-model="roleDialog.form.lead_permissions">
            <el-checkbox v-for="item in permissionOptions" :key="item.value" :label="item.value">{{ item.label }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="来源范围">
          <el-checkbox-group v-model="roleDialog.form.lead_sources">
            <el-checkbox v-for="item in sourceOptions" :key="item.value" :label="item.value">{{ item.label }}</el-checkbox>
          </el-checkbox-group>
          <div class="form-tip">选择“直播来源”时，该角色可管理所有直播账号产生的客户线索。</div>
        </el-form-item>
      </el-form>
      <span slot="footer">
        <el-button @click="roleDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="roleDialog.saving" @click="saveRoleSettings">保存</el-button>
      </span>
    </el-dialog>

    <el-dialog :title="sourceDialog.form._id ? '编辑线索来源' : '新增线索来源'" :visible.sync="sourceDialog.visible" width="480px" append-to-body>
      <el-form label-width="90px">
        <el-form-item label="来源名称" required>
          <el-input v-model="sourceDialog.form.label" maxlength="30" show-word-limit placeholder="例如：抖音线索" />
        </el-form-item>
        <el-form-item v-if="sourceDialog.form._id" label="内部编码">
          <span class="source-code-text">{{ sourceDialog.form.value }}</span>
        </el-form-item>
        <div class="source-dialog-tip form-tip">内部编码由系统维护，编辑时只允许修改显示名称。</div>
      </el-form>
      <span slot="footer">
        <el-button @click="sourceDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="sourceDialog.saving" @click="saveSource">保存</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
export default {
  data() {
    return {
      loading: false,
      sourceLoading: false,
      roles: [],
      sourceCatalog: [],
      sourceOptions: [],
      permissionOptions: [
        { value: 'manage', label: '可管理线索' },
        { value: 'distribute', label: '可分发咨询师' },
      ],
      sourceDialog: {
        visible: false,
        saving: false,
        form: {},
      },
      roleDialog: {
        visible: false,
        saving: false,
        form: {},
      },
    };
  },
  created() {
    this.loadSourceOptions();
    this.loadRoles();
  },
  methods: {
    addSource() {
      this.sourceDialog.form = { value: '', label: '', enabled: true };
      this.sourceDialog.visible = true;
    },
    editSource(source) {
      this.sourceDialog.form = { _id: source._id, value: source.value, label: source.label, enabled: source.enabled !== false };
      this.sourceDialog.visible = true;
    },
    saveSource() {
      const label = String(this.sourceDialog.form.label || '').trim();
      if (!label) return this.$message.warning('请输入来源名称');
      this.sourceDialog.saving = true;
      vk.callFunction({
        url: 'business/custom2.saveLeadSourceOption',
        data: { _id: this.sourceDialog.form._id, value: this.sourceDialog.form.value, label, enabled: this.sourceDialog.form.enabled !== false },
        success: (result) => {
          if (!result || result.code !== 0) return this.$message.error((result && result.msg) || '保存来源失败');
          this.sourceDialog.visible = false;
          this.$message.success(result.msg || '线索来源已保存');
          this.loadSourceOptions();
          this.loadRoles();
        },
        complete: () => {
          this.sourceDialog.saving = false;
        },
      });
    },
    removeSource(source) {
      this.$confirm(`确定删除线索来源“${source.label}”吗？`, '删除确认', { type: 'warning' }).then(() => {
        this.sourceLoading = true;
        vk.callFunction({
          url: 'business/custom2.deleteLeadSourceOption',
          data: { _id: source._id },
          success: (result) => {
            if (!result || result.code !== 0) return this.$message.error((result && result.msg) || '删除来源失败');
            this.$message.success(result.msg || '线索来源已删除');
            this.loadSourceOptions();
            this.loadRoles();
          },
          complete: () => {
            this.sourceLoading = false;
          },
        });
      }).catch(() => {});
    },
    loadSourceOptions() {
      this.sourceLoading = true;
      vk.callFunction({
        url: 'business/custom2.getLeadSourceOptions',
        data: {},
        success: (result) => {
          if (result && result.code === 0 && Array.isArray(result.data)) {
            this.sourceCatalog = result.data;
            this.sourceOptions = result.data.map((item) => ({ value: item.value, label: item.label }));
          } else {
            this.$message.warning((result && result.msg) || '线索来源加载失败');
          }
        },
        complete: () => {
          this.sourceLoading = false;
        },
      });
    },
    loadRoles() {
      this.loading = true;
      vk.callFunction({
        url: 'business/custom2.getLeadSettings',
        data: {},
        success: (result) => {
          if (result && result.code === 0 && Array.isArray(result.data)) {
            this.roles = result.data;
          } else {
            this.$message.warning((result && result.msg) || '角色权限加载失败');
          }
        },
        complete: () => {
          this.loading = false;
        },
      });
    },
    editRole(role) {
      this.roleDialog.form = {
        role_id: role.role_id,
        role_name: role.role_name,
        lead_permissions: Array.isArray(role.lead_permissions) ? [...role.lead_permissions] : [],
        lead_sources: Array.isArray(role.lead_sources) ? [...role.lead_sources] : [],
      };
      this.roleDialog.visible = true;
    },
    saveRoleSettings() {
      const form = this.roleDialog.form;
      this.roleDialog.saving = true;
      vk.callFunction({
        url: 'business/custom2.saveLeadSettings',
        data: {
          role_id: form.role_id,
          lead_permissions: form.lead_permissions || [],
          lead_sources: form.lead_sources || [],
        },
        success: (result) => {
          if (!result || result.code !== 0) return this.$message.error((result && result.msg) || '权限保存失败');
          this.roleDialog.visible = false;
          this.$message.success(result.msg || '线索权限已保存');
          this.loadRoles();
        },
        complete: () => {
          this.roleDialog.saving = false;
        },
      });
    },
    hasPermission(role, value) {
      if (role.role_id === 'admin') return true;
      return (role.lead_permissions || []).includes(value);
    },
    visiblePermissions(role) {
      return role.role_id === 'admin' ? [] : (role.lead_permissions || []);
    },
    visibleSources(role) {
      return role.role_id === 'admin' ? [] : (role.lead_sources || []);
    },
    permissionLabel(value) {
      const item = this.permissionOptions.find((option) => option.value === value);
      return item ? item.label : value;
    },
    sourceLabel(value) {
      const item = this.sourceOptions.find((option) => option.value === value);
      return item ? item.label : value;
    },
  },
};
</script>

<style lang="scss" scoped>
  .lead-permission-page { padding-bottom: 20px; }
  .lead-intro-card { display: flex; align-items: center; padding: 22px 26px; background: linear-gradient(135deg, #f0f7ff, #f8fbff); border: 1px solid #dcecff; }
  .lead-intro-icon { display: flex; width: 46px; height: 46px; margin-right: 16px; align-items: center; justify-content: center; border-radius: 14px; color: #2878e8; background: #dcecff; font-size: 22px; }
  .lead-intro-title { color: #1f3557; font-size: 18px; font-weight: 600; }
  .lead-intro-text, .muted-text, .form-tip { color: #8b9ab1; font-size: 13px; }
  .lead-intro-text { margin-top: 7px; }
  .source-card-tip { margin-top: 5px; color: #8b9ab1; font-size: 12px; }
  .role-name { color: #263c5d; font-weight: 600; }
  .role-name i { margin-right: 7px; color: #4d91ed; }
  .source-name { color: #263c5d; font-weight: 600; }
  .source-name i { margin-right: 7px; color: #4d91ed; }
  .danger-text { color: #f56c6c; }
  .source-code-text { color: #71839d; font-family: monospace; font-size: 13px; }
  .source-dialog-tip { margin-left: 90px; line-height: 1.6; }
  .source-tag, .permission-tag { margin: 2px 5px 2px 0; }
  .lead-empty { padding: 45px; color: #9aaac0; text-align: center; }
  .lead-empty i { display: block; margin-bottom: 8px; font-size: 28px; }
  .dialog-role-summary { padding: 14px 16px; margin-bottom: 20px; border-radius: 8px; background: #f5f8fc; }
  .dialog-role-name { color: #263c5d; font-size: 16px; font-weight: 600; }
  .dialog-role-id { margin-top: 5px; color: #9aaac0; font-size: 12px; }
  .lead-form ::v-deep .el-checkbox { margin-right: 18px; margin-bottom: 12px; }
  .form-tip { line-height: 1.6; }
</style>
