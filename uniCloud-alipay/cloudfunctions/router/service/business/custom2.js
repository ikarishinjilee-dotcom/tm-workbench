'use strict';

// 角色信息可能来自数组、字符串或角色对象，统一识别超级管理员。
const isSuperAdmin = (userInfo = {}) => {
  let roleValue = userInfo.role || userInfo.roles || userInfo.role_id || userInfo.roleIds || [];
  if (typeof roleValue === 'string') {
    try {
      roleValue = JSON.parse(roleValue);
    } catch (error) {
      roleValue = roleValue.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  const roles = Array.isArray(roleValue) ? roleValue : [roleValue];
  return roles.some((role) => role === 'admin' || role && role.role_id === 'admin' || role && role.value === 'admin');
};

const normalizeRoleList = (userInfo = {}) => {
  let roleValue = userInfo.role || userInfo.roles || userInfo.role_id || userInfo.roleIds || [];
  if (typeof roleValue === 'string') {
    try {
      roleValue = JSON.parse(roleValue);
    } catch (error) {
      roleValue = roleValue.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return Array.isArray(roleValue) ? roleValue : [roleValue];
};

const normalizeRoleKeys = (userInfo = {}) => normalizeRoleList(userInfo).flatMap((role) => {
  if (typeof role === 'string') return [role];
  return [role.role_id, role.value, role.role_name, role.name].filter(Boolean);
}).filter(Boolean);

const roleMatches = (role, candidates = []) => {
  if (!role) return false;
  const values = typeof role === 'string'
    ? [role]
    : [role.role_id, role.value, role.role_name, role.name].filter(Boolean);
  return values.some((value) => candidates.includes(value));
};

// getClientInfo 在部分调用链中只有 uid，没有完整角色信息，此时补查当前用户。
const getCurrentUserInfo = async (context, uid, userInfo = {}) => {
  const roleValue = userInfo.role || userInfo.roles || userInfo.role_id || userInfo.roleIds;
  const hasRoleInfo = Array.isArray(roleValue) ? roleValue.length > 0 : Boolean(roleValue);
  let currentUserInfo = userInfo;
  if (!hasRoleInfo && uid && typeof context.getUserInfo === 'function') {
    currentUserInfo = (await context.getUserInfo()) || userInfo;
  }
  const roles = normalizeRoleList(currentUserInfo);
  const roleIds = roles.map((role) => typeof role === 'string' ? role : role && (role.role_id || role.value)).filter(Boolean);
  const needRoleDetail = roleIds.length > 0 && !roles.some((role) => typeof role !== 'string' && (role.role_name || role.name));
  if (!needRoleDetail) return currentUserInfo;
  const db = uniCloud.database();
  const dbCmd = db.command;
  const roleRes = await db.collection('uni-id-roles').where({ role_id: dbCmd.in(roleIds) }).field({
    role_id: true,
    role_name: true,
  }).get();
  const roleMap = {};
  (roleRes.data || []).forEach((item) => {
    if (item && item.role_id) roleMap[item.role_id] = item;
  });
  return {
    ...currentUserInfo,
    roles: roleIds.map((roleId) => roleMap[roleId] || { role_id: roleId }),
    role: roleIds.map((roleId) => roleMap[roleId] || { role_id: roleId }),
  };
};

// 同时识别新旧格式，保证历史转移记录也受保护。
const isTransferRecord = (record = {}) => record.record_type === 'transfer' || /^客户已从“[^”]+”转移至“[^”]+”$/.test(String(record.content || ''));
const isSystemRecord = (record = {}) => record.record_type === 'system';
const hasManualFollowupRecords = (records = []) => (Array.isArray(records) ? records : []).some((record) => !isSystemRecord(record) && !isTransferRecord(record));

// 状态统一保存为稳定 ID，同时兼容历史数据中的中文状态值。
const customerStatusOptions = [
  { value: 'initial_contact', label: '初步沟通' },
  { value: 'communicating_positive', label: '沟通中(能转化)' },
  { value: 'communicating_difficult', label: '沟通中(难转化)' },
  { value: 'invited', label: '已邀约' },
  { value: 'converted', label: '已转化' },
  { value: 'not_interested', label: '不考虑' },
];
const customerStatusLabelMap = customerStatusOptions.reduce((map, item) => {
  map[item.label] = item.value;
  return map;
}, {});
const normalizeCustomerStatus = (value) => customerStatusLabelMap[value] || value || 'initial_contact';
const getCustomerStatusAliases = (value) => {
  const normalized = normalizeCustomerStatus(value);
  const option = customerStatusOptions.find((item) => item.value === normalized);
  return option ? [option.value, option.label] : [normalized];
};
const normalizeFollowupRecords = (records) => (Array.isArray(records) ? records : []).map((record) => ({
  ...record,
  status: normalizeCustomerStatus(record.status),
}));
const sourceAliasMap = {
  live_teacher_zhou: ['live_teacher_zhou', '直播（周老师）'],
  wechat_channels_promotion: ['wechat_channels_promotion', '视频号线索', 'wechat_channels'],
  douyin_promotion: ['douyin_promotion', '抖音线索', 'douyin'],
};
const leadProviderSourceRoleMap = {
  live_teacher: ['live_teacher_zhou'],
  '直播老师': ['live_teacher_zhou'],
  traffic_teacher: ['wechat_channels_promotion', 'douyin_promotion'],
  '投流老师': ['wechat_channels_promotion', 'douyin_promotion'],
};
const fuzzyLeadProviderSourceRoleMap = [
  { keywords: ['直播'], sources: ['live_teacher_zhou'] },
  { keywords: ['投流'], sources: ['wechat_channels_promotion', 'douyin_promotion'] },
];
const getSourceAliases = (value) => Array.from(new Set(sourceAliasMap[value] || [value])).filter(Boolean);
const getLeadProviderVisibleSources = (userInfo = {}) => {
  const roles = normalizeRoleList(userInfo);
  const sources = [];
  roles.forEach((role) => {
    Object.keys(leadProviderSourceRoleMap).forEach((roleKey) => {
      if (roleMatches(role, [roleKey])) sources.push(...leadProviderSourceRoleMap[roleKey]);
    });
    const roleValues = typeof role === 'string' ? [role] : [role.role_id, role.value, role.role_name, role.name].filter(Boolean);
    fuzzyLeadProviderSourceRoleMap.forEach((config) => {
      if (roleValues.some((value) => config.keywords.some((keyword) => String(value).includes(keyword)))) {
        sources.push(...config.sources);
      }
    });
  });
  return Array.from(new Set(sources.flatMap((source) => getSourceAliases(source))));
};
const isLeadProviderUser = (userInfo = {}) => !isSuperAdmin(userInfo) && getLeadProviderVisibleSources(userInfo).length > 0;
const applyCustomerAccessWhere = ({ whereJson = {}, userInfo = {}, uid, admin, _ }) => {
  if (admin) return whereJson;
  const visibleSources = getLeadProviderVisibleSources(userInfo);
  if (visibleSources.length) {
    whereJson.source = _.in(visibleSources);
  } else {
    whereJson.consultant_id = uid;
  }
  return whereJson;
};
const getMaterialFileId = (file = {}) => typeof file === 'string' ? file : file.fileID || file.file_id || '';
const getMaterialFileUrl = (file = {}) => typeof file === 'string' ? file : file.url || file.fileURL || file.file_id || file.fileID || '';
const getMaterialFileName = (file = {}) => typeof file === 'string' ? file.split('/').pop() || file : file.name || file.original_name || file.display_name || '客户资料';
const getMaterialFileType = (file = {}) => {
  const name = getMaterialFileName(file).toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/.test(name)) return 'image';
  if (/\.(mp4|mov|avi|mkv|m3u8|3gp)$/.test(name)) return 'video';
  if (/\.(mp3|wav|flac|aac|ogg|m4a)$/.test(name)) return 'audio';
  return 'other';
};

const notifyCustomerDistribution = async ({ db, recipientId, customerId, customerName, actorId, actorName, isRedispatch = false }) => {
  if (!db || !recipientId || !customerId) return;
  await db.collection('tm-notifications').add({
    recipient_id: recipientId,
    type: isRedispatch ? 'customer_redispatch' : 'customer_distribution',
    title: isRedispatch ? '客户重新分发' : '新客户分发',
    content: isRedispatch
      ? `${actorName || '线索老师'}已将客户“${customerName || '未命名客户'}”重新分发给您`
      : `${actorName || '线索老师'}已向您分发客户“${customerName || '未命名客户'}”`,
    customer_id: customerId,
    customer_name: customerName || '未命名客户',
    actor_id: actorId || '',
    actor_name: actorName || '线索老师',
    read: false,
    create_time: new Date(),
    route: '/pages/custom/records',
  });
};

const customerMaterialRootName = '客户信息资料';

// 客户资料使用独立的系统分类，避免被普通素材分组操作误改。
const ensureCustomerMaterialCategory = async (db, customer) => {
  const dbCmd = uniCloud.database().command;
  const rootRes = await db.collection('vk-files-categories').where(
    dbCmd.or([
      { category_type: 'customer_root' },
      { name: customerMaterialRootName, parent_id: '' },
    ])
  ).orderBy('sort', 'asc').orderBy('_add_time', 'asc').get();
  const roots = rootRes.data || [];
  let root = roots[0];
  if (!root) {
    const rootAddRes = await db.collection('vk-files-categories').add({
      name: customerMaterialRootName,
      description: '客户详情上传资料的系统目录',
      parent_id: '',
      sort: -100,
      category_type: 'customer_root',
      is_system: true,
    });
    root = { _id: rootAddRes.id, name: customerMaterialRootName };
  } else {
    await db.collection('vk-files-categories').doc(root._id).update({
      name: customerMaterialRootName,
      description: '客户详情上传资料的系统目录',
      parent_id: '',
      sort: -100,
      category_type: 'customer_root',
      is_system: true,
    });
  }
  if (roots.length > 1) {
    for (const duplicateRoot of roots.slice(1)) {
      await db.collection('vk-files-categories').where({ parent_id: duplicateRoot._id }).update({ parent_id: root._id });
      await db.collection('vk-files-categories').doc(duplicateRoot._id).remove();
    }
  }

  const categoryName = customer.parent_name || customer.name || '未命名客户';
  const categoryRes = await db.collection('vk-files-categories').where(
    dbCmd.or([
      { category_type: 'customer', customer_id: customer._id },
      { name: categoryName, parent_id: root._id },
    ])
  ).orderBy('_add_time', 'asc').get();
  const categories = categoryRes.data || [];
  let category = categories[0];
  const categoryData = {
    name: categoryName,
    description: `客户【${categoryName}】的资料目录`,
    parent_id: root._id,
    category_type: 'customer',
    customer_id: customer._id,
    is_system: true,
  };
  if (category) {
    await db.collection('vk-files-categories').doc(category._id).update(categoryData);
    if (categories.length > 1) {
      for (const duplicateCategory of categories.slice(1)) {
        await db.collection('vk-files').where({ category_id: duplicateCategory._id }).update({ category_id: category._id });
        await db.collection('vk-files-categories').doc(duplicateCategory._id).remove();
      }
    }
  } else {
    const categoryAddRes = await db.collection('vk-files-categories').add({
      ...categoryData,
      sort: 0,
    });
    category = { _id: categoryAddRes.id, ...categoryData };
  }
  return { root, category };
};

const syncCustomerMaterialCategory = async (db, customer) => {
  const { category } = await ensureCustomerMaterialCategory(db, customer);
  await db.collection('vk-files').where({ customer_id: customer._id }).update({
    category_id: category._id,
    customer_name: customer.parent_name || customer.name || '未命名客户',
    customer_deleted: Boolean(customer.is_deleted),
  });
  return category;
};

const cloudObject = {
  getAccessProfile: async function () {
    const { uid, userInfo = {} } = this.getClientInfo();
    const currentUserInfo = await getCurrentUserInfo(this, uid, userInfo);
    const visibleSources = getLeadProviderVisibleSources(currentUserInfo).filter((item) => Object.prototype.hasOwnProperty.call(sourceAliasMap, item));
    return {
      code: 0,
      data: {
        is_admin: isSuperAdmin(currentUserInfo),
        is_lead_provider: !isSuperAdmin(currentUserInfo) && visibleSources.length > 0,
        visible_sources: visibleSources,
        role_keys: normalizeRoleKeys(currentUserInfo),
      },
    };
  },
  isCloudObject: true,

  getList: async function (data = {}) {
    const { uid, userInfo = {} } = this.getClientInfo();
    const { vk, _ } = this.getUtil();
    const currentUserInfo = await getCurrentUserInfo(this, uid, userInfo);
    const admin = isSuperAdmin(currentUserInfo);
    const visibleSources = getLeadProviderVisibleSources(currentUserInfo);
    const whereJson = applyCustomerAccessWhere({ whereJson: {}, userInfo: currentUserInfo, uid, admin, _ });
    // 已删除客户只能由管理员查看；普通列表兼容历史数据中没有 is_deleted 的客户。
    const showDeleted = admin && data.formData && data.formData._deleted_view === true;
    whereJson.is_deleted = showDeleted ? true : _.neq(true);
    // 查询时同时匹配新状态 ID 和历史中文状态，避免旧数据被筛选漏掉。
    const queryData = {
      ...data,
      formData: { ...(data.formData || {}) },
      columns: Array.isArray(data.columns) ? data.columns.map((column) => ({ ...column })) : data.columns,
    };
    delete queryData.formData._deleted_view;
    const selectedConsultantId = queryData.formData.consultant_id;
    delete queryData.formData.consultant_id;
    if ((admin || visibleSources.length) && selectedConsultantId) whereJson.consultant_id = selectedConsultantId;
    // 纯日期筛选的结束日期按当天结束时间计算，避免漏掉结束日期当天的客户。
    if (queryData.formData._add_time_start) {
      const start = new Date(queryData.formData._add_time_start);
      start.setHours(0, 0, 0, 0);
      queryData.formData._add_time_start = start.getTime();
    }
    if (queryData.formData._add_time_end) {
      const end = new Date(queryData.formData._add_time_end);
      end.setHours(23, 59, 59, 999);
      queryData.formData._add_time_end = end.getTime();
    }
    if (queryData.formData._add_time_start && queryData.formData._add_time_end && queryData.formData._add_time_start > queryData.formData._add_time_end) {
      const timeStart = queryData.formData._add_time_start;
      queryData.formData._add_time_start = queryData.formData._add_time_end;
      queryData.formData._add_time_end = timeStart;
    }
    const selectedStatus = queryData.formData.status;
    if (selectedStatus !== undefined && selectedStatus !== null && selectedStatus !== '') {
      queryData.formData.status = getCustomerStatusAliases(selectedStatus);
      if (Array.isArray(queryData.columns)) {
        queryData.columns = queryData.columns.map((column) => column.key === 'status' ? { ...column, mode: 'in' } : column);
      }
    }
    const result = await vk.baseDao.getTableData({
      dbName: 'tm-clients',
      data: queryData,
      whereJson,
      // 优先按最后一次写入时间倒序，历史数据没有该字段时用创建时间兜底。
      sortArr: [
        { name: 'last_edit_time', type: 'desc' },
        { name: '_add_time', type: 'desc' },
      ],
      foreignDB: [{
        dbName: 'uni-id-users',
        localKey: 'consultant_id',
        foreignKey: '_id',
        as: 'consultantUserInfo',
        limit: 1,
      }],
    });
    if (result && Array.isArray(result.rows)) {
      result.rows = result.rows.map((row) => ({
        ...row,
        consultant_name: row.consultant_name || row.consultantUserInfo && (row.consultantUserInfo.nickname || row.consultantUserInfo.username) || '',
      }));
    }
    return result;
  },

  // 返回可作为客户归属人的咨询师名单，仅提供转移所需的公开字段。
  getConsultants: async function () {
    const result = await uniCloud.database().collection('uni-id-users').field({
      _id: true,
      username: true,
      nickname: true,
      status: true,
      allow_login_background: true,
    }).limit(500).get();
    const rows = (result.data || []).filter((item) => item.status !== 1 && item.allow_login_background !== false);
    return { code: 0, rows };
  },

  // 将客户资料登记到统一素材库，兼容历史上只保存附件引用的客户资料。
  syncMaterials: async function (data = {}) {
    const { uid, userInfo = {} } = this.getClientInfo();
    const currentUserInfo = await getCurrentUserInfo(this, uid, userInfo);
    const admin = isSuperAdmin(currentUserInfo);
    if (!data.customer_id || !Array.isArray(data.attachments)) return { code: -1, msg: '客户和资料不能为空' };
    const db = uniCloud.database();
    const customerWhere = applyCustomerAccessWhere({ whereJson: { _id: data.customer_id }, userInfo: currentUserInfo, uid, admin, _: uniCloud.database().command });
    const customerRes = await db.collection('tm-clients').where(customerWhere).limit(1).get();
    const customer = customerRes.data && customerRes.data[0];
    if (!customer) return { code: -1, msg: '客户不存在或无权同步资料' };
    const category = await syncCustomerMaterialCategory(db, customer);

    const materialFiles = data.attachments.map((file) => ({
      file,
      fileId: getMaterialFileId(file),
      url: getMaterialFileUrl(file),
      name: getMaterialFileName(file),
    })).filter((item) => item.fileId || item.url);
    let linked = 0;
    for (const item of materialFiles) {
      const where = item.fileId ? { file_id: item.fileId } : { url: item.url };
      const existingRes = await db.collection('vk-files').where(where).limit(1).get();
      const existing = existingRes.data && existingRes.data[0];
      const materialData = {
        source_type: 'customer',
        customer_id: customer._id,
        customer_name: customer.parent_name || customer.name || '未命名客户',
        customer_deleted: Boolean(customer.is_deleted),
        category_id: category._id,
      };
      if (existing) {
        await db.collection('vk-files').doc(existing._id).update(materialData);
      } else {
        await db.collection('vk-files').add({
          user_id: uid,
          sort: 0,
          status: 0,
          type: getMaterialFileType(item.file),
          url: item.url,
          display_name: item.name,
          original_name: item.name,
          size: Number(item.file && item.file.size || 0),
          file_id: item.fileId,
          provider: item.file && item.file.provider || 'unicloud',
          ...materialData,
        });
      }
      linked += 1;
    }
    return { code: 0, linked, msg: '客户资料已同步到素材管理' };
  },

  save: async function (data = {}) {
    const { uid, userInfo = {} } = this.getClientInfo();
    const { vk, _ } = this.getUtil();
    const db = uniCloud.database();
    const currentUserInfo = await getCurrentUserInfo(this, uid, userInfo);
    const admin = isSuperAdmin(currentUserInfo);
    const leadProviderUser = isLeadProviderUser(currentUserInfo);
    const visibleSources = getLeadProviderVisibleSources(currentUserInfo);
    const {
      _id,
      _add_time,
      status,
      source,
      clue_cost,
      parent_name,
      contact_phone,
      wechat_added,
      wechat,
      region,
      detail_address,
      child_name,
      child_grade,
      study_status,
      intended_regions,
      intended_region_remark,
      progress,
      remark,
      consultant_id,
      consultant_name,
      followup_records,
      attachments,
      signing_province,
      signing_city,
      contract_amount,
      contract_content,
    } = data;
    const normalizedContactPhone = contact_phone || '';
    const normalizedAddTime = _add_time ? (typeof _add_time === 'number' ? _add_time : new Date(_add_time).getTime()) : 0;
    const wechatAdded = [true, 1, 'true', '1'].includes(wechat_added);
    if (!parent_name || !status) return { code: -1, msg: '家长姓名和状态不能为空' };
    if (!normalizedAddTime || Number.isNaN(normalizedAddTime)) return { code: -1, msg: '创建时间不能为空' };
    if (normalizedContactPhone && !/^1\d{10}$/.test(normalizedContactPhone)) return { code: -1, msg: '联系电话必须是11位手机号码' };
    if (wechat && !/^[A-Za-z][A-Za-z0-9_-]{5,19}$/.test(wechat)) return { code: -1, msg: '微信号需为字母开头的6-20位字母、数字、下划线或连字符' };
    const normalizedAttachments = Array.isArray(attachments) ? attachments : [];
    const normalizedFollowupRecords = normalizeFollowupRecords(followup_records);
    const syncedStatus = normalizedFollowupRecords[0] && normalizedFollowupRecords[0].status ? normalizedFollowupRecords[0].status : normalizeCustomerStatus(status);
    let signingData = {
      signing_province: signing_province || '',
      signing_city: signing_city || '',
      contract_amount: contract_amount || '',
      contract_content: contract_content || '',
    };
    const lastEditTime = Date.now();
    if (normalizedAttachments.length > 30) return { code: -1, msg: '每个客户最多保存30份资料' };
    if (leadProviderUser && (!consultant_id || !String(consultant_id).trim())) return { code: -1, msg: '请选择咨询师' };
    if (leadProviderUser && visibleSources.length && !getSourceAliases(source).some((item) => visibleSources.includes(item))) {
      return { code: -1, msg: '当前角色不能分发该线索来源的客户' };
    }
    let consultantInfo = null;
    if (leadProviderUser && consultant_id) {
      const consultantRes = await uniCloud.database().collection('uni-id-users').doc(consultant_id).field({
        _id: true,
        username: true,
        nickname: true,
        status: true,
        allow_login_background: true,
      }).get();
      consultantInfo = consultantRes.data && consultantRes.data[0];
      if (!consultantInfo) return { code: -1, msg: '咨询师不存在' };
      if (consultantInfo.status === 1 || consultantInfo.allow_login_background === false) return { code: -1, msg: '所选咨询师当前不可用' };
    }
    let existingCustomer = null;
    // 客户创建后不允许通过客户资料表单直接改状态，状态只能由进度记录驱动。
    if (_id) {
      const existingWhere = applyCustomerAccessWhere({ whereJson: { _id }, userInfo: currentUserInfo, uid, admin, _ });
      const existingRes = await db.collection('tm-clients').where(existingWhere).limit(1).get();
      existingCustomer = existingRes.data && existingRes.data[0];
      if (!existingCustomer) return { code: -1, msg: '客户不存在或无权编辑' };
      if (existingCustomer.is_deleted) return { code: -1, msg: '已删除客户不可编辑，请先恢复客户信息' };
      if (!leadProviderUser && syncedStatus !== normalizeCustomerStatus(existingCustomer.status)) {
        return { code: -1, msg: '客户创建后不能直接修改状态，请在进度记录中修改' };
      }
      if (leadProviderUser && existingCustomer.consultant_id && existingCustomer.consultant_info_modified_at && consultant_id && consultant_id !== existingCustomer.consultant_id) {
        return { code: -1, msg: '咨询师已修改客户资料，不能再修改咨询师' };
      }
      if (leadProviderUser) {
        signingData = {
          signing_province: existingCustomer.signing_province || '',
          signing_city: existingCustomer.signing_city || '',
          contract_amount: existingCustomer.contract_amount || '',
          contract_content: existingCustomer.contract_content || '',
        };
      } else if (syncedStatus !== 'converted') {
        signingData = {
          signing_province: existingCustomer.signing_province || '',
          signing_city: existingCustomer.signing_city || '',
          contract_amount: existingCustomer.contract_amount || '',
          contract_content: existingCustomer.contract_content || '',
        };
      }
    }
    const dataJson = {
      name: parent_name,
      phone: normalizedContactPhone,
      stage: syncedStatus,
      _add_time: normalizedAddTime,
      last_edit_time: lastEditTime,
      status: syncedStatus,
      source,
      clue_cost: Number(clue_cost || 0),
      parent_name,
      contact_phone: normalizedContactPhone,
      wechat_added: wechatAdded,
      wechat,
      region,
      detail_address,
      child_name,
      child_grade,
      study_status,
      intended_regions: Array.isArray(intended_regions) ? intended_regions : [],
      intended_region_remark,
      progress,
      remark,
      followup_records: leadProviderUser ? undefined : normalizedFollowupRecords,
      attachments: leadProviderUser ? undefined : normalizedAttachments,
      ...signingData,
    };
    if (leadProviderUser) {
      dataJson.wechat_added = existingCustomer ? Boolean(existingCustomer.wechat_added) : false;
      if (existingCustomer && existingCustomer.consultant_info_modified_at) {
        dataJson.consultant_info_modified_at = existingCustomer.consultant_info_modified_at;
        dataJson.consultant_info_modified_by = existingCustomer.consultant_info_modified_by || '';
        dataJson.consultant_info_modified_name = existingCustomer.consultant_info_modified_name || '';
      }
      if (existingCustomer && existingCustomer.consultant_id && existingCustomer.consultant_info_modified_at) {
        dataJson.consultant_id = existingCustomer.consultant_id;
        dataJson.consultant_name = existingCustomer.consultant_name || '';
      }
    }
    if (leadProviderUser && consultantInfo) {
      dataJson.consultant_id = consultantInfo._id;
      dataJson.consultant_name = consultantInfo.nickname || consultantInfo.username || consultant_name || '';
    }
    const whereJson = {};
    applyCustomerAccessWhere({ whereJson, userInfo: currentUserInfo, uid, admin, _ });
    if (_id) {
      whereJson._id = _id;
      if (leadProviderUser) {
        const existingRes = await db.collection('tm-clients').where(whereJson).limit(1).get();
        const existingCustomer = existingRes.data && existingRes.data[0];
        if (!existingCustomer) return { code: -1, msg: '客户不存在或无权编辑' };
        dataJson.status = normalizeCustomerStatus(existingCustomer.status);
        dataJson.stage = normalizeCustomerStatus(existingCustomer.status);
        dataJson.progress = existingCustomer.progress || '';
        dataJson.followup_records = normalizeFollowupRecords(existingCustomer.followup_records);
        dataJson.attachments = Array.isArray(existingCustomer.attachments) ? existingCustomer.attachments : [];
        dataJson.consultant_info_modified_at = existingCustomer.consultant_info_modified_at || 0;
        dataJson.consultant_info_modified_by = existingCustomer.consultant_info_modified_by || '';
        dataJson.consultant_info_modified_name = existingCustomer.consultant_info_modified_name || '';
      } else if (!admin) {
        dataJson.consultant_info_modified_at = existingCustomer && existingCustomer.consultant_info_modified_at || lastEditTime;
        dataJson.consultant_info_modified_by = uid;
        dataJson.consultant_info_modified_name = currentUserInfo.nickname || currentUserInfo.username || '';
      }
      const res = await vk.baseDao.update({ dbName: 'tm-clients', whereJson, dataJson });
      await this.syncMaterials({ customer_id: _id, attachments: dataJson.attachments || normalizedAttachments });
      if (leadProviderUser && consultantInfo && existingCustomer && existingCustomer.consultant_id !== consultantInfo._id) {
        await notifyCustomerDistribution({
          db,
          recipientId: consultantInfo._id,
          customerId: _id,
          customerName: parent_name || existingCustomer.parent_name || existingCustomer.name || '未命名客户',
          actorId: uid,
          actorName: currentUserInfo.nickname || currentUserInfo.username || '线索老师',
          isRedispatch: true,
        });
      }
      return { code: 0, num: res, msg: '客户信息已更新' };
    }
    if (leadProviderUser) {
      dataJson.consultant_id = consultantInfo && consultantInfo._id || consultant_id;
      dataJson.consultant_name = consultantInfo && (consultantInfo.nickname || consultantInfo.username) || consultant_name || '';
      dataJson.followup_records = [];
      dataJson.attachments = [];
      dataJson.signing_province = '';
      dataJson.signing_city = '';
      dataJson.contract_amount = '';
      dataJson.contract_content = '';
    } else {
      dataJson.consultant_id = uid;
      dataJson.consultant_name = currentUserInfo.nickname || currentUserInfo.username || '';
    }
    dataJson.is_deleted = false;
    const id = await vk.baseDao.add({ dbName: 'tm-clients', dataJson });
    await this.syncMaterials({ customer_id: id, attachments: normalizedAttachments });
    if (leadProviderUser && consultantInfo && consultantInfo._id) {
      await notifyCustomerDistribution({
        db,
        recipientId: consultantInfo._id,
        customerId: id,
        customerName: parent_name || '未命名客户',
        actorId: uid,
        actorName: currentUserInfo.nickname || currentUserInfo.username || '线索老师',
        isRedispatch: false,
      });
    }
    return { code: 0, id, msg: '客户信息已新增' };
  },

  // 转移客户归属：咨询师只能转移自己名下的客户，管理员可以转移任意客户。
  transfer: async function (data = {}) {
    const { uid, userInfo = {} } = this.getClientInfo();
    const currentUserInfo = await getCurrentUserInfo(this, uid, userInfo);
    const admin = isSuperAdmin(currentUserInfo);
    if (isLeadProviderUser(currentUserInfo)) return { code: -1, msg: '当前角色仅可分发客户信息，不能转移客户' };
    const { customer_id, target_consultant_id } = data;
    if (!customer_id || !target_consultant_id) return { code: -1, msg: '请选择目标咨询师' };
    if (customer_id === target_consultant_id) return { code: -1, msg: '目标咨询师不能与当前咨询师相同' };

    const db = uniCloud.database();
    const customerWhere = { _id: customer_id };
    if (!admin) customerWhere.consultant_id = uid;
    const customerRes = await db.collection('tm-clients').where(customerWhere).get();
    const customer = customerRes.data && customerRes.data[0];
    if (!customer) return { code: -1, msg: '客户不存在或无权转移' };
    if (customer.is_deleted) return { code: -1, msg: '已删除客户不可转移，请先恢复客户信息' };

    const targetRes = await db.collection('uni-id-users').doc(target_consultant_id).field({
      _id: true,
      username: true,
      nickname: true,
      status: true,
      allow_login_background: true,
    }).get();
    const target = targetRes.data && targetRes.data[0];
    if (!target) return { code: -1, msg: '目标咨询师不存在' };
    if (target.status === 1 || target.allow_login_background === false) return { code: -1, msg: '目标咨询师当前不可用' };

    // 旧客户数据可能只有 consultant_id，没有保存 consultant_name，这里回查账号名称。
    let currentName = customer.consultant_name || '';
    const sourceConsultantId = customer.consultant_id || uid;
    if (!currentName && sourceConsultantId) {
      const sourceRes = await db.collection('uni-id-users').doc(sourceConsultantId).field({
        _id: true,
        username: true,
        nickname: true,
      }).get();
      const source = sourceRes.data && sourceRes.data[0];
      currentName = source && (source.nickname || source.username) || '';
    }
    if (!currentName) currentName = admin ? '管理员' : (currentUserInfo.nickname || currentUserInfo.username || '未分配');
    const targetName = target.nickname || target.username || '未命名咨询师';
    const transferRecord = {
      _id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      contact_time: Date.now(),
      create_time: Date.now(),
      status: normalizeCustomerStatus(customer.status),
      content: `咨询师：${currentName} 变更为 ${targetName}`,
      record_type: 'transfer',
      from_consultant_id: customer.consultant_id || '',
      from_consultant_name: currentName,
      to_consultant_id: target_consultant_id,
      to_consultant_name: targetName,
      operator_id: uid,
    };
    const followupRecords = normalizeFollowupRecords(customer.followup_records);
    await db.collection('tm-clients').doc(customer_id).update({
      consultant_id: target_consultant_id,
      consultant_name: targetName,
      followup_records: [transferRecord, ...followupRecords],
      last_edit_time: Date.now(),
    });
    const customerName = customer.parent_name || customer.name || '未命名客户';
    const actorName = currentUserInfo.nickname || currentUserInfo.username || '管理员';
    const messageContent = admin
      ? `管理员已将客户“${customerName}”转移至您的名下`
      : `咨询师${currentName}已将客户“${customerName}”转移至您的名下`;
    await db.collection('tm-notifications').add({
      recipient_id: target_consultant_id,
      type: 'customer_transfer',
      title: '客户归属变更',
      content: messageContent,
      customer_id,
      customer_name: customerName,
      actor_id: uid,
      actor_name: actorName,
      read: false,
      create_time: new Date(),
      route: '/pages/custom/records',
    });
    return { code: 0, consultant_id: target_consultant_id, consultant_name: targetName, record: transferRecord, msg: '客户已转移' };
  },

  addFollowup: async function (data = {}) {
    const { uid, userInfo = {} } = this.getClientInfo();
    const currentUserInfo = await getCurrentUserInfo(this, uid, userInfo);
    const admin = isSuperAdmin(currentUserInfo);
    if (isLeadProviderUser(currentUserInfo)) return { code: -1, msg: '当前角色仅可分发客户信息，不能新增进度' };
    const { customer_id, contact_time, status, content } = data;
    if (!customer_id) return { code: -1, msg: '缺少客户ID' };
    if (!status) return { code: -1, msg: '进度状态不能为空' };
    const normalizedContactTime = contact_time ? (typeof contact_time === 'number' ? contact_time : new Date(contact_time).getTime()) : 0;
    if (!normalizedContactTime || Number.isNaN(normalizedContactTime)) return { code: -1, msg: '沟通时间不能为空' };

    const db = uniCloud.database();
    const whereJson = { _id: customer_id };
    if (!admin) whereJson.consultant_id = uid;
    const customerRes = await db.collection('tm-clients').where(whereJson).get();
    const customer = customerRes.data && customerRes.data[0];
    if (!customer) return { code: -1, msg: '客户不存在或无权操作' };
    if (customer.is_deleted) return { code: -1, msg: '已删除客户不可添加进度，请先恢复客户信息' };

    const record = {
      _id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      contact_time: normalizedContactTime,
      status: normalizeCustomerStatus(status),
      content: String(content || '').trim(),
      create_time: Date.now(),
      consultant_id: customer.consultant_id || uid,
    };
    const followupRecords = normalizeFollowupRecords(customer.followup_records);
    await db.collection('tm-clients').doc(customer_id).update({
      followup_records: [record, ...followupRecords],
      status: record.status,
      progress: record.content,
      last_edit_time: Date.now(),
    });
    return { code: 0, data: record, msg: '进度已保存' };
  },

  updateFollowup: async function (data = {}) {
    const { uid, userInfo = {} } = this.getClientInfo();
    const currentUserInfo = await getCurrentUserInfo(this, uid, userInfo);
    const admin = isSuperAdmin(currentUserInfo);
    if (isLeadProviderUser(currentUserInfo)) return { code: -1, msg: '当前角色仅可分发客户信息，不能编辑进度' };
    const { customer_id, followup_id: inputFollowupId, _id, contact_time, status, content } = data;
    const followup_id = inputFollowupId || _id;
    if (!customer_id || !followup_id) return { code: -1, msg: '缺少进度记录ID' };
    if (!status) return { code: -1, msg: '进度状态不能为空' };
    const normalizedContactTime = contact_time ? (typeof contact_time === 'number' ? contact_time : new Date(contact_time).getTime()) : 0;
    if (!normalizedContactTime || Number.isNaN(normalizedContactTime)) return { code: -1, msg: '沟通时间不能为空' };

    const db = uniCloud.database();
    const whereJson = { _id: customer_id };
    if (!admin) whereJson.consultant_id = uid;
    const customerRes = await db.collection('tm-clients').where(whereJson).get();
    const customer = customerRes.data && customerRes.data[0];
    if (!customer) return { code: -1, msg: '客户不存在或无权操作' };
    if (customer.is_deleted) return { code: -1, msg: '已删除客户不可编辑进度，请先恢复客户信息' };
    const records = normalizeFollowupRecords(customer.followup_records);
    const index = records.findIndex((item) => item._id === followup_id);
    if (index < 0) return { code: -1, msg: '进度记录不存在' };
    if (isSystemRecord(records[index])) return { code: -1, msg: '系统操作记录不可编辑' };
    if (isTransferRecord(records[index])) return { code: -1, msg: '系统转移记录不可编辑' };
    records[index] = {
      ...records[index],
      contact_time: normalizedContactTime,
      status: normalizeCustomerStatus(status),
      content: String(content || '').trim(),
    };
    await db.collection('tm-clients').doc(customer_id).update({
      followup_records: records,
      status: records[0] ? normalizeCustomerStatus(records[0].status) : normalizeCustomerStatus(customer.status),
      progress: records[0] ? records[0].content : '',
      last_edit_time: Date.now(),
    });
    return { code: 0, data: records[index], msg: '进度已更新' };
  },

  deleteFollowup: async function (data = {}) {
    const { uid, userInfo = {} } = this.getClientInfo();
    const currentUserInfo = await getCurrentUserInfo(this, uid, userInfo);
    const admin = isSuperAdmin(currentUserInfo);
    if (isLeadProviderUser(currentUserInfo)) return { code: -1, msg: '当前角色仅可分发客户信息，不能删除进度' };
    const { customer_id, followup_id } = data;
    if (!customer_id || !followup_id) return { code: -1, msg: '缺少进度记录ID' };
    const db = uniCloud.database();
    const whereJson = { _id: customer_id };
    if (!admin) whereJson.consultant_id = uid;
    const customerRes = await db.collection('tm-clients').where(whereJson).get();
    const customer = customerRes.data && customerRes.data[0];
    if (!customer) return { code: -1, msg: '客户不存在或无权操作' };
    if (customer.is_deleted) return { code: -1, msg: '已删除客户不可删除进度，请先恢复客户信息' };
    const records = normalizeFollowupRecords(customer.followup_records).filter((item) => item._id !== followup_id);
    const deletedRecord = (customer.followup_records || []).find((item) => item._id === followup_id);
    if (deletedRecord && isSystemRecord(deletedRecord)) return { code: -1, msg: '系统操作记录不可删除' };
    if (deletedRecord && isTransferRecord(deletedRecord)) return { code: -1, msg: '系统转移记录不可删除' };
    await db.collection('tm-clients').doc(customer_id).update({
      followup_records: records,
      status: records[0] ? normalizeCustomerStatus(records[0].status) : 'initial_contact',
      progress: records[0] ? records[0].content : '',
      last_edit_time: Date.now(),
    });
    return { code: 0, msg: '进度记录已删除' };
  },

  delete: async function (data = {}) {
    const { uid, userInfo = {} } = this.getClientInfo();
    const { _ } = this.getUtil();
    const currentUserInfo = await getCurrentUserInfo(this, uid, userInfo);
    const admin = isSuperAdmin(currentUserInfo);
    if (isLeadProviderUser(currentUserInfo)) return { code: -1, msg: '当前角色仅可分发客户信息，不能删除客户' };
    if (!data._id) return { code: -1, msg: '缺少客户ID' };
    const whereJson = { _id: Array.isArray(data._id) ? _.in(data._id) : data._id };
    if (!admin) whereJson.consultant_id = uid;
    // 所有角色统一软删除，保留数据供管理员在已删除列表中查看或恢复。
    whereJson.is_deleted = _.neq(true);
    const customerRes = await uniCloud.database().collection('tm-clients').where(whereJson).get();
    const operatorName = currentUserInfo.nickname || currentUserInfo.username || uid;
    const operationTime = Date.now();
    await Promise.all((customerRes.data || []).map(async (customer) => {
      const deleteRecord = {
        _id: `${operationTime}_${Math.random().toString(36).slice(2, 8)}`,
        contact_time: operationTime,
        create_time: operationTime,
        status: normalizeCustomerStatus(customer.status),
        content: `客户已被${operatorName}删除`,
        record_type: 'system',
        action: 'delete',
        operator_id: uid,
        operator_name: operatorName,
      };
      await uniCloud.database().collection('tm-clients').doc(customer._id).update({
        is_deleted: true,
        last_edit_time: operationTime,
        deleted_at: operationTime,
        deleted_by: uid,
        followup_records: [deleteRecord, ...normalizeFollowupRecords(customer.followup_records)],
      });
      await uniCloud.database().collection('vk-files').where({ customer_id: customer._id }).update({ customer_deleted: true });
    }));
    return { code: 0, num: customerRes.data ? customerRes.data.length : 0, msg: '客户信息已删除' };
  },

  restore: async function (data = {}) {
    const { uid, userInfo = {} } = this.getClientInfo();
    const currentUserInfo = await getCurrentUserInfo(this, uid, userInfo);
    if (!isSuperAdmin(currentUserInfo)) return { code: -1, msg: '只有管理员可以恢复客户信息' };
    if (!data._id || Array.isArray(data._id)) return { code: -1, msg: '缺少客户ID' };

    const db = uniCloud.database();
    const customerRes = await db.collection('tm-clients').where({ _id: data._id, is_deleted: true }).limit(1).get();
    const customer = customerRes.data && customerRes.data[0];
    if (!customer) return { code: -1, msg: '该客户不在已删除列表中' };
    const operatorName = currentUserInfo.nickname || currentUserInfo.username || uid;
    const operationTime = Date.now();
    const restoreRecord = {
      _id: `${operationTime}_${Math.random().toString(36).slice(2, 8)}`,
      contact_time: operationTime,
      create_time: operationTime,
      status: normalizeCustomerStatus(customer.status),
      content: `客户已被${operatorName}恢复`,
      record_type: 'system',
      action: 'restore',
      operator_id: uid,
      operator_name: operatorName,
    };
    await db.collection('tm-clients').doc(customer._id).update({
      is_deleted: false,
      last_edit_time: operationTime,
      deleted_at: 0,
      deleted_by: '',
      followup_records: [restoreRecord, ...normalizeFollowupRecords(customer.followup_records)],
    });
    await db.collection('vk-files').where({ customer_id: customer._id }).update({ customer_deleted: false });
    return { code: 0, data: restoreRecord, msg: '客户信息已恢复' };
  },

  getHardDeleteSummary: async function (data = {}) {
    const { uid, userInfo = {} } = this.getClientInfo();
    const currentUserInfo = await getCurrentUserInfo(this, uid, userInfo);
    if (!isSuperAdmin(currentUserInfo)) return { code: -1, msg: '只有管理员可以查看彻底删除摘要' };
    if (!data._id || Array.isArray(data._id)) return { code: -1, msg: '缺少客户ID' };
    const db = uniCloud.database();
    const customerRes = await db.collection('tm-clients').where({ _id: data._id, is_deleted: true }).limit(1).get();
    const customer = customerRes.data && customerRes.data[0];
    if (!customer) return { code: -1, msg: '该客户不在已删除列表中' };
    const materialCountRes = await db.collection('vk-files').where({ customer_id: data._id }).count();
    return {
      code: 0,
      data: {
        customer_id: customer._id,
        customer_name: customer.parent_name || customer.name || '未命名客户',
        material_count: Number(materialCountRes.total || 0),
      },
    };
  },

  hardDelete: async function (data = {}) {
    const { uid, userInfo = {} } = this.getClientInfo();
    const { vk } = this.getUtil();
    const currentUserInfo = await getCurrentUserInfo(this, uid, userInfo);
    if (!isSuperAdmin(currentUserInfo)) return { code: -1, msg: '只有管理员可以彻底删除客户信息' };
    if (!data._id || Array.isArray(data._id)) return { code: -1, msg: '缺少客户ID' };
    const materialFiles = await vk.baseDao.select({
      dbName: 'vk-files',
      pageIndex: 1,
      pageSize: 500,
      getMain: true,
      whereJson: { customer_id: data._id },
      fieldJson: {
        file_id: true,
      },
    });
    const fileList = (materialFiles || []).map((item) => item.file_id).filter(Boolean);
    if (fileList.length) {
      try {
        await vk.deleteFile({ fileList });
      } catch (error) {
        return { code: -1, msg: '删除客户资料文件失败，请稍后重试' };
      }
    }
    const result = await vk.baseDao.del({
      dbName: 'tm-clients',
      whereJson: { _id: data._id, is_deleted: true },
    });
    await vk.baseDao.del({ dbName: 'vk-files', whereJson: { customer_id: data._id } });
    await vk.baseDao.del({
      dbName: 'vk-files-categories',
      whereJson: { category_type: 'customer', customer_id: data._id },
    });
    return { code: 0, num: result, msg: '客户信息已永久删除' };
  },
};

module.exports = cloudObject;
