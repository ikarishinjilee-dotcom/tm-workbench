'use strict';

// 角色信息可能来自数组、字符串或角色对象，统一识别超级管理员。
const adminRoleKeys = ['admin', 'super_admin', 'administrator'];
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
  return roles.some((role) => {
    if (typeof role === 'string') return adminRoleKeys.includes(role);
    if (!role) return false;
    return [role.role_id, role.value, role.role_name, role.name].filter(Boolean).some((value) => adminRoleKeys.includes(value));
  });
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
  const needLeadSettings = roleIds.length > 0 && roles.some((role) => typeof role === 'string'
    || !Object.prototype.hasOwnProperty.call(role, 'lead_sources')
    || !Object.prototype.hasOwnProperty.call(role, 'lead_permissions'));
  if (!needRoleDetail && !needLeadSettings) return currentUserInfo;
  const db = uniCloud.database();
  const dbCmd = db.command;
  const roleRes = await db.collection('uni-id-roles').where({ role_id: dbCmd.in(roleIds) }).field({
    role_id: true,
    role_name: true,
    lead_permissions: true,
    lead_sources: true,
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

const getOperatorName = (userInfo = {}, admin = false) => (
  userInfo.nickname
  || userInfo.username
  || userInfo.realname
  || userInfo.name
  || (admin ? '管理员' : '当前用户')
);

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
  { value: 'converted', label: '已签单' },
  { value: 'refunded', label: '已退单' },
  { value: 'not_interested', label: '不考虑' },
];
// 客户质量分类：由客户状态管理页维护，内置状态使用默认等级。
const customerQualityOptions = [
  { value: 'high', label: '高意向' },
  { value: 'normal', label: '普通咨询' },
  { value: 'low', label: '低意向' },
  { value: 'invalid', label: '无效' },
];
const customerQualityValues = ['high', 'normal', 'low', 'invalid'];
// 内置状态默认质量等级，字典表未配置时兜底。
const defaultQualityByStatus = {
  initial_contact: 'normal',
  communicating_positive: 'high',
  communicating_difficult: 'low',
  invited: 'high',
  converted: 'high',
  refunded: 'invalid',
  not_interested: 'invalid',
};
// 客户状态辅助：标准化字典项字段。
const normalizeCustomerStatusOption = (item = {}) => ({
  _id: item._id,
  value: item.value,
  label: item.label || item.value,
  built_in: Boolean(item.built_in),
  enabled: item.enabled !== false,
  sort: Number(item.sort) || 0,
  aliases: Array.isArray(item.aliases) ? item.aliases.filter(Boolean) : [],
});

// 线索来源集合名与默认数据：首次访问时由 getLeadSourceOptions 自动建表。
const leadSourceCollectionName = 'uni-id-lead-sources';
const defaultLeadSourceOptions = [
  { value: 'wechat_channels_promotion', label: '视频号线索', built_in: true, sort: 20 },
  { value: 'douyin_promotion', label: '抖音线索', built_in: true, sort: 30 },
  { value: 'old_customer', label: '老客户', built_in: true, sort: 40 },
  { value: 'customer_referral', label: '客户转介绍', built_in: true, sort: 50 },
  { value: 'other', label: '其他来源', built_in: true, sort: 60 },
];
const normalizeLeadSourceOption = (item = {}) => ({
  _id: item._id,
  value: item.value,
  label: item.label || item.value,
  built_in: Boolean(item.built_in),
  sort: Number(item.sort) || 0,
});
const getLeadSourceOptions = async (db) => {
  const collection = db.collection(leadSourceCollectionName);
  const result = await collection.orderBy('sort', 'asc').limit(200).get();
  if (result.data && result.data.length) return result.data.map(normalizeLeadSourceOption);
  const now = Date.now();
  await collection.add(defaultLeadSourceOptions.map((item) => ({ ...item, _add_time: now, _update_time: now })));
  return defaultLeadSourceOptions.map(normalizeLeadSourceOption);
};

// 客户状态辅助：自动建表并返回标准化后的状态选项。
const getCustomerStatusOptions = async (db, includeDisabled = true) => {
  const collection = db.collection(customerStatusCollectionName);
  let result = await collection.orderBy('sort', 'asc').limit(200).get();
  if (!result.data || !result.data.length) {
    const now = Date.now();
    await collection.add(defaultCustomerStatusOptions.map((item) => ({ ...item, _add_time: now, _update_time: now })));
    result = { data: defaultCustomerStatusOptions.map((item) => ({ ...item })) };
  }
  const options = (result.data || []).map(normalizeCustomerStatusOption);
  return includeDisabled ? options : options.filter((item) => item.enabled !== false);
};

const customerStatusCollectionName = 'uni-id-customer-statuses';
const defaultCustomerStatusOptions = customerStatusOptions.map((item, index) => ({
  ...item,
  quality_level: defaultQualityByStatus[item.value] || 'normal',
  built_in: true,
  enabled: true,
  sort: (index + 1) * 10,
  aliases: [item.label],
}));
const postConvertedStatusValues = ['converted', 'refunded'];
const customerStatusLabelMap = customerStatusOptions.reduce((map, item) => {
  map[item.label] = item.value;
  return map;
}, {});
customerStatusLabelMap['已转化'] = 'converted';
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
const parseTimeInput = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 0 : value.getTime();
  const numericValue = Number(value);
  if (Number.isFinite(numericValue) && numericValue > 0) return numericValue;
  const stringValue = String(value).trim();
  if (!stringValue) return 0;
  // 优先解析 ISO 字符串，兼容前端日期组件序列化后的时间格式。
  const parsedTime = new Date(stringValue).getTime();
  if (!Number.isNaN(parsedTime)) return parsedTime;
  // 再兼容历史数据中的 yyyy-MM-dd HH:mm:ss 格式。
  const legacyParsedTime = new Date(stringValue.replace(/-/g, '/')).getTime();
  return Number.isNaN(legacyParsedTime) ? 0 : legacyParsedTime;
};
const getFollowupRecordTime = (record = {}) => parseTimeInput(record.contact_time || record.create_time || record.update_time || record._add_time);
const sortFollowupRecords = (records = []) => normalizeFollowupRecords(records).sort((a, b) => {
  const timeDiff = getFollowupRecordTime(b) - getFollowupRecordTime(a);
  if (timeDiff) return timeDiff;
  return parseTimeInput(b.create_time) - parseTimeInput(a.create_time);
});
const getLatestManualFollowupRecord = (records = []) => sortFollowupRecords(records)
  .find((record) => !isSystemRecord(record) && !isTransferRecord(record));
const getStarredUserIds = (customer = {}) => {
  const ids = Array.isArray(customer.starred_user_ids) ? customer.starred_user_ids.filter(Boolean) : [];
  if (customer.starred_by && !ids.includes(customer.starred_by)) ids.push(customer.starred_by);
  return ids;
};
const getStarredUsers = (customer = {}) => {
  const users = Array.isArray(customer.starred_users) ? customer.starred_users.filter((item) => item && item.uid) : [];
  if (customer.starred_by && !users.some((item) => item.uid === customer.starred_by)) {
    users.push({
      uid: customer.starred_by,
      name: customer.starred_by_name || '',
      starred_at: customer.starred_at || 0,
    });
  }
  return users;
};
const isCustomerStarredBy = (customer = {}, uid) => Boolean(uid && getStarredUserIds(customer).includes(uid));
const getCustomerStarredAtBy = (customer = {}, uid) => {
  const user = getStarredUsers(customer).find((item) => item.uid === uid);
  return user && user.starred_at || 0;
};
const sourceAliasMap = {
  live_teacher_zhou: ['live_teacher_zhou', '直播（周老师）'],
  wechat_channels_promotion: ['wechat_channels_promotion', '视频号线索', 'wechat_channels'],
  douyin_promotion: ['douyin_promotion', '抖音线索', 'douyin'],
};
const getLeadProviderName = (userInfo = {}) => userInfo.nickname || userInfo.realname || userInfo.username || '';
const getLiveTeacherSourceAliases = (userInfo = {}) => {
  const uid = userInfo._id || userInfo.uid || '';
  const name = getLeadProviderName(userInfo);
  if (!uid && !name) return [];
  const aliases = [];
  if (uid) aliases.push(`live_teacher_${uid}`);
  if (name) aliases.push(`直播（${name}）`);
  // 兼容历史上固定使用“直播（周老师）”的账号。
  if (String(name).includes('周')) aliases.push(...sourceAliasMap.live_teacher_zhou);
  return Array.from(new Set(aliases));
};
const isLiveTeacherUser = (userInfo = {}) => {
  const roleValues = normalizeRoleKeys(userInfo);
  const identityValues = [userInfo.username, userInfo.nickname, userInfo.realname, userInfo.role_id].filter(Boolean);
  // 命中 leadProviderSourceRoleMap 里的"直播老师"角色键。
  if (roleValues.includes('live_teacher') || roleValues.includes('直播老师')) return true;
  // 身份字段含直播/主播/zhibo/live_teacher 关键词。
  const text = [...roleValues, ...identityValues].map(String).join(' ');
  return /直播|主播|live_teacher|zhibo/i.test(text);
};
const getLiveTeacherSourceOption = (userInfo = {}) => {
  const aliases = getLiveTeacherSourceAliases(userInfo);
  const value = aliases.find((item) => item.startsWith('live_teacher_')) || '';
  const label = aliases.find((item) => item.startsWith('直播（')) || '';
  return value && label ? { value, label, aliases } : null;
};
const leadProviderSourceRoleMap = {
  live_teacher: [],
  '直播老师': [],
  traffic_teacher: ['wechat_channels_promotion', 'douyin_promotion'],
  '投流老师': ['wechat_channels_promotion', 'douyin_promotion'],
};
const fuzzyLeadProviderSourceRoleMap = [
  { keywords: ['直播'], sources: [] },
  { keywords: ['投流'], sources: ['wechat_channels_promotion', 'douyin_promotion'] },
];
const leadProviderIdentityKeywordMap = [
  { keywords: ['投流'], sources: ['wechat_channels_promotion', 'douyin_promotion'] },
  { keywords: ['视频号'], sources: ['wechat_channels_promotion'] },
  { keywords: ['抖音'], sources: ['douyin_promotion'] },
];
const getSourceAliases = (value) => Array.from(new Set(sourceAliasMap[value] || [value])).filter(Boolean);
const sameCustomerSource = (left, right) => {
  if (left === right) return true;
  const leftAliases = getSourceAliases(left);
  const rightAliases = getSourceAliases(right);
  return leftAliases.some((alias) => rightAliases.includes(alias));
};
const getLeadProviderVisibleSources = (userInfo = {}) => {
  const roles = normalizeRoleList(userInfo);
  const sources = [];
  let hasConfiguredSourceScope = false;
  roles.forEach((role) => {
    if (role && typeof role === 'object' && Array.isArray(role.lead_sources)) {
      hasConfiguredSourceScope = true;
      role.lead_sources.forEach((source) => {
        // “直播来源”是权限配置中的通用分类，实际客户来源使用每个直播账号的动态编码。
        if (source === 'live') {
          sources.push(...getLiveTeacherSourceAliases(userInfo));
        } else {
          sources.push(source);
        }
      });
      return;
    }
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
  if (hasConfiguredSourceScope) return Array.from(new Set(sources.flatMap((source) => getSourceAliases(source))));
  const identityValues = [
    userInfo.username,
    userInfo.nickname,
    userInfo.realname,
    userInfo.mobile,
  ].filter(Boolean);
  leadProviderIdentityKeywordMap.forEach((config) => {
    if (identityValues.some((value) => config.keywords.some((keyword) => String(value).includes(keyword)))) {
      sources.push(...config.sources);
    }
  });
  if (isLiveTeacherUser(userInfo)) sources.push(...getLiveTeacherSourceAliases(userInfo));
  return Array.from(new Set(sources.flatMap((source) => getSourceAliases(source))));
};
const isLeadProviderUser = (userInfo = {}) => !isSuperAdmin(userInfo) && getLeadProviderVisibleSources(userInfo).length > 0;
const isConsultantCandidate = (userInfo = {}) => !isSuperAdmin(userInfo) && !isLeadProviderUser(userInfo);
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
    route: `/pages/custom/records?customer_id=${encodeURIComponent(customerId)}`,
  });
};

const getCustomerStatusLabel = (value, options = customerStatusOptions) => {
  const normalized = normalizeCustomerStatus(value);
  const option = options.find((item) => item.value === normalized);
  return option ? option.label : normalized;
};

const notifyLeadProviderFollowupFeedback = async ({ db, customer = {}, record = {}, actorId, actorName, isUpdate = false }) => {
  if (!db || !customer._id) return;
  const sourceAliases = getSourceAliases(customer.source || '');
  const normalizedStatus = normalizeCustomerStatus(record.status);
  const isImportantFeedback = ['converted', 'refunded'].includes(normalizedStatus);
  let recipientIds = [customer.lead_provider_id].filter(Boolean);
  if (!recipientIds.length && sourceAliases.length) {
    const providerRes = await db.collection('uni-id-users').field({
      _id: true,
      username: true,
      nickname: true,
      status: true,
      allow_login_background: true,
      role: true,
      roles: true,
      role_id: true,
      roleIds: true,
    }).limit(500).get();
    recipientIds = (providerRes.data || [])
      .filter((item) => item.status !== 1 && item.allow_login_background !== false && isLeadProviderUser(item))
      .filter((item) => getLeadProviderVisibleSources(item).some((source) => sourceAliases.includes(source)))
      .map((item) => item._id)
      .filter(Boolean);
  }
  recipientIds = Array.from(new Set(recipientIds)).filter((recipientId) => recipientId && recipientId !== actorId);
  if (!recipientIds.length && !isImportantFeedback) return;
  const customerName = customer.parent_name || customer.name || '未命名客户';
  let statusOptions = customerStatusOptions;
  try {
    // 通知必须使用状态管理页中的最新名称，不能把自定义状态的内部编码直接展示给用户。
    statusOptions = await getCustomerStatusOptions(db, false);
  } catch (error) {
    // 状态配置集合尚未部署时，保留内置状态兜底，不阻断原有进度保存。
    statusOptions = customerStatusOptions;
  }
  const statusLabel = getCustomerStatusLabel(normalizedStatus, statusOptions);
  const actionText = isUpdate ? '更新了进度' : '新增了进度';
  const contentText = String(record.content || '').trim();
  const isConverted = normalizedStatus === 'converted';
  if (isImportantFeedback) {
    const adminIds = (recipientUsersRes.data || [])
      .filter((item) => isSuperAdmin(item))
      .map((item) => item._id)
      .filter((recipientId) => recipientId && recipientId !== actorId && !recipientIds.includes(recipientId));
    await Promise.all(adminIds.map((recipientId) => db.collection('tm-notifications').add({
      recipient_id: recipientId,
      type: 'customer_followup_key_event',
      title: isConverted ? '客户签单反馈' : '客户退单反馈',
      content: `${actorName || '咨询师'}已将客户“${customerName}”推进为${statusLabel}${contentText ? `，内容：${contentText}` : ''}`,
      customer_id: customer._id,
      customer_name: customerName,
      actor_id: actorId || '',
      actor_name: actorName || '咨询师',
      feedback_status: normalizedStatus,
      feedback_status_label: statusLabel,
      feedback_content: contentText,
      read: false,
      create_time: new Date(),
      route: `/pages/custom/records?customer_id=${encodeURIComponent(customer._id)}`,
    })));
  }
  if (!recipientIds.length) return;
  await Promise.all(recipientIds.map((recipientId) => db.collection('tm-notifications').add({
    recipient_id: recipientId,
    type: 'customer_followup_feedback',
    title: isConverted ? '客户签单反馈' : '客户进度反馈',
    content: isConverted
      ? `${actorName || '咨询师'}已将客户“${customerName}”推进为已签单${contentText ? `，内容：${contentText}` : ''}`
      : `${actorName || '咨询师'}已为客户“${customerName}”${actionText}，状态：${statusLabel}${contentText ? `，内容：${contentText}` : ''}`,
    customer_id: customer._id,
    customer_name: customerName,
    actor_id: actorId || '',
    actor_name: actorName || '咨询师',
    feedback_status: normalizedStatus,
    feedback_status_label: statusLabel,
    feedback_content: contentText,
    read: false,
    create_time: new Date(),
    route: `/pages/custom/records?customer_id=${encodeURIComponent(customer._id)}`,
  })));
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
    const admin = isSuperAdmin(currentUserInfo);
    const visibleSources = getLeadProviderVisibleSources(currentUserInfo);
    const sourceUsersRes = await uniCloud.database().collection('uni-id-users').field({
      _id: true, username: true, nickname: true, realname: true, status: true,
      allow_login_background: true, role: true, roles: true, role_id: true, roleIds: true,
    }).limit(500).get();
    const allLiveSourceOptions = (sourceUsersRes.data || [])
      .filter((item) => item.status !== 1 && item.allow_login_background !== false && isLiveTeacherUser(item))
      .map(getLiveTeacherSourceOption)
      .filter(Boolean)
      .filter((item, index, list) => list.findIndex((candidate) => candidate.value === item.value) === index);
    // 字典来源（默认项兜底 + 字典表）与直播老师动态来源合并，确保前端下拉框能匹配客户已使用的所有来源值。
    // 默认来源始终存在（即使字典表为空），字典项按 value 去重追加。
    let configuredSourceOptions = [];
    try {
      configuredSourceOptions = await getLeadSourceOptions(uniCloud.database());
    } catch (error) {
      configuredSourceOptions = defaultLeadSourceOptions.map(normalizeLeadSourceOption);
    }
    const defaultSourceOptions = defaultLeadSourceOptions.map(normalizeLeadSourceOption);
    const mergedSourceOptions = [
      ...defaultSourceOptions,
      ...configuredSourceOptions,
      ...allLiveSourceOptions,
    ].filter((item, index, list) => list.findIndex((candidate) => candidate.value === item.value) === index);
    const sourceOptions = admin
      ? mergedSourceOptions
      : mergedSourceOptions.filter((item) => (item.aliases || [item.value]).some((alias) => visibleSources.includes(alias)));
    // 客户状态字典：管理员配置页可读全部状态，其他角色只读启用状态。
    let configuredCustomerStatusOptions = [];
    try {
      configuredCustomerStatusOptions = await getCustomerStatusOptions(uniCloud.database(), isSuperAdmin(currentUserInfo));
    } catch (error) {
      configuredCustomerStatusOptions = customerStatusOptions.map(normalizeCustomerStatusOption);
    }
    return {
      code: 0,
      data: {
        is_admin: admin,
        is_lead_provider: !admin && visibleSources.length > 0,
        visible_sources: visibleSources,
        source_options: sourceOptions,
        status_options: configuredCustomerStatusOptions,
        role_keys: normalizeRoleKeys(currentUserInfo),
      },
    };
  },
  // 获取角色级线索管理配置。
  getLeadSettings: async function () {
    const { uid, userInfo = {} } = this.getClientInfo();
    const currentUserInfo = await getCurrentUserInfo(this, uid, userInfo);
    if (!isSuperAdmin(currentUserInfo)) return { code: -1, msg: '只有超级管理员可以配置线索权限' };
    const result = await uniCloud.database().collection('uni-id-roles').field({
      _id: true, role_id: true, role_name: true, comment: true, enable: true,
      lead_permissions: true, lead_sources: true,
    }).orderBy('_add_time', 'asc').get();
    return { code: 0, data: result.data || [] };
  },

  // 保存角色级线索管理配置。
  saveLeadSettings: async function (data = {}) {
    const { uid, userInfo = {} } = this.getClientInfo();
    const currentUserInfo = await getCurrentUserInfo(this, uid, userInfo);
    if (!isSuperAdmin(currentUserInfo)) return { code: -1, msg: '只有超级管理员可以配置线索权限' };
    if (!data.role_id) return { code: -1, msg: '缺少角色标识' };
    if (data.role_id === 'admin') return { code: -1, msg: '超级管理员默认拥有全部线索权限，无需单独配置' };
    const permissions = Array.isArray(data.lead_permissions) ? Array.from(new Set(data.lead_permissions.filter(Boolean))) : [];
    const sources = Array.isArray(data.lead_sources) ? Array.from(new Set(data.lead_sources.filter(Boolean))) : [];
    await uniCloud.database().collection('uni-id-roles').where({ role_id: data.role_id }).update({
      lead_permissions: permissions,
      lead_sources: sources,
    });
    return { code: 0, msg: '线索权限已保存', data: { role_id: data.role_id, lead_permissions: permissions, lead_sources: sources } };
  },

  // 获取客户状态配置。客户业务页可读取启用状态，管理员配置页可读取全部状态。
  getCustomerStatusOptions: async function (data = {}) {
    const { uid, userInfo = {} } = this.getClientInfo();
    const currentUserInfo = await getCurrentUserInfo(this, uid, userInfo);
    const db = uniCloud.database();
    return { code: 0, data: await getCustomerStatusOptions(db, isSuperAdmin(currentUserInfo) && data.include_disabled === true) };
  },

  // 新增或修改客户状态。状态 ID 一旦生成后保持不变，避免历史客户和进度记录失效。
  saveCustomerStatusOption: async function (data = {}) {
    const { uid, userInfo = {} } = this.getClientInfo();
    const currentUserInfo = await getCurrentUserInfo(this, uid, userInfo);
    if (!isSuperAdmin(currentUserInfo)) return { code: -1, msg: '只有超级管理员可以维护客户状态' };
    const label = String(data.label || '').trim();
    if (!label) return { code: -1, msg: '请输入状态名称' };
    if (label.length > 30) return { code: -1, msg: '状态名称不能超过30个字' };
    const db = uniCloud.database();
    const collection = db.collection(customerStatusCollectionName);
    const now = Date.now();
    const qualityLevel = String(data.quality_level || '').trim();
    if (!customerQualityValues.includes(qualityLevel)) return { code: -1, msg: '请选择客户质量分类' };
    if (data._id || data.value) {
      const existingRes = await collection.doc(data._id).get();
      const existing = existingRes.data && existingRes.data[0];
      if (!existing) return { code: -1, msg: '客户状态不存在或已删除' };
      const aliases = [label];
      const enabled = data.enabled === false ? false : true;
      const sort = Number(data.sort) || Number(existing.sort) || 0;
      await collection.doc(existing._id).update({ label, enabled, sort, aliases, _update_time: now });
      return { code: 0, msg: '客户状态已更新', data: normalizeCustomerStatusOption({ ...existing, label, enabled, sort, aliases }) };
    }
    const value = `custom_status_${now}_${Math.random().toString(36).slice(2, 8)}`;
    const sort = Number(data.sort) || 100;
    const option = { value, label, built_in: false, enabled: true, sort, aliases: [label], _add_time: now, _update_time: now };
    const addRes = await collection.add(option);
    return { code: 0, msg: '客户状态已新增', data: normalizeCustomerStatusOption({ ...option, _id: addRes.id }) };
  },

  // 不删除状态，统一改为停用，确保历史客户和进度记录始终可追溯。
  toggleCustomerStatusOption: async function (data = {}) {
    const { uid, userInfo = {} } = this.getClientInfo();
    const currentUserInfo = await getCurrentUserInfo(this, uid, userInfo);
    if (!isSuperAdmin(currentUserInfo)) return { code: -1, msg: '只有超级管理员可以维护客户状态' };
    if (!data._id) return { code: -1, msg: '缺少客户状态标识' };
    const db = uniCloud.database();
    const collection = db.collection(customerStatusCollectionName);
    const existingRes = await collection.doc(data._id).get();
    const existing = existingRes.data && existingRes.data[0];
    if (!existing) return { code: -1, msg: '客户状态不存在或已删除' };
    const enabled = data.enabled !== false;
    await collection.doc(data._id).update({ enabled, _update_time: Date.now() });
    return { code: 0, msg: enabled ? '客户状态已启用' : '客户状态已停用' };
  },

  // 获取管理员维护的线索来源。
  getLeadSourceOptions: async function () {
    const { uid, userInfo = {} } = this.getClientInfo();
    const currentUserInfo = await getCurrentUserInfo(this, uid, userInfo);
    if (!isSuperAdmin(currentUserInfo)) return { code: -1, msg: '只有超级管理员可以维护线索来源' };
    const db = uniCloud.database();
    const options = await getLeadSourceOptions(db);
    const usersRes = await db.collection('uni-id-users').field({
      _id: true, username: true, nickname: true, realname: true, status: true, allow_login_background: true,
      role: true, roles: true, role_id: true, roleIds: true,
    }).limit(500).get();
    const dynamicOptions = (usersRes.data || [])
      .filter((item) => isLiveTeacherUser(item))
      .map((item) => {
        const option = getLiveTeacherSourceOption(item);
        return option ? { ...option, enabled: item.status !== 1 && item.allow_login_background !== false } : null;
      })
      .filter(Boolean)
      .filter((item, index, list) => list.findIndex((candidate) => candidate.value === item.value) === index);
    return { code: 0, data: options, dynamic_source_options: dynamicOptions };
  },

  // 新增或修改线索来源。value 是内部稳定标识，编辑时只允许修改显示名称。
  saveLeadSourceOption: async function (data = {}) {
    const { uid, userInfo = {} } = this.getClientInfo();
    const currentUserInfo = await getCurrentUserInfo(this, uid, userInfo);
    if (!isSuperAdmin(currentUserInfo)) return { code: -1, msg: '只有超级管理员可以维护线索来源' };
    const label = String(data.label || '').trim();
    if (!label) return { code: -1, msg: '请输入来源名称' };
    if (label.length > 30) return { code: -1, msg: '来源名称不能超过30个字' };
    const db = uniCloud.database();
    const collection = db.collection(leadSourceCollectionName);
    const now = Date.now();
    if (data._id || data.value) {
      const existingRes = data._id
        ? await collection.doc(data._id).get()
        : await collection.where({ value: data.value }).limit(1).get();
      const existing = existingRes.data && existingRes.data[0];
      if (!existing) return { code: -1, msg: '来源不存在或已删除' };
      const enabled = data.enabled === false ? false : true;
      await collection.doc(existing._id).update({ label, enabled, _update_time: now });
      return { code: 0, msg: '线索来源已更新', data: normalizeLeadSourceOption({ ...existing, label, enabled }) };
    }
    const value = `custom_${now}_${Math.random().toString(36).slice(2, 8)}`;
    const sort = Number(data.sort) || 100;
    const addRes = await collection.add({ value, label, built_in: false, enabled: true, sort, _add_time: now, _update_time: now });
    return { code: 0, msg: '线索来源已新增', data: normalizeLeadSourceOption({ _id: addRes.id, value, label, built_in: false, enabled: true, sort }) };
  },

  // 内置来源不删除；自定义来源被客户使用后也不删除，避免历史客户无法识别来源。
  deleteLeadSourceOption: async function (data = {}) {
    const { uid, userInfo = {} } = this.getClientInfo();
    const currentUserInfo = await getCurrentUserInfo(this, uid, userInfo);
    if (!isSuperAdmin(currentUserInfo)) return { code: -1, msg: '只有超级管理员可以维护线索来源' };
    if (!data._id) return { code: -1, msg: '缺少来源标识' };
    const db = uniCloud.database();
    const collection = db.collection(leadSourceCollectionName);
    const existingRes = await collection.doc(data._id).get();
    const existing = existingRes.data && existingRes.data[0];
    if (!existing) return { code: -1, msg: '来源不存在或已删除' };
    if (existing.built_in) return { code: -1, msg: '内置来源不能删除，只能修改名称' };
    const usedCount = await db.collection('tm-clients').where({ source: existing.value }).count();
    if (usedCount.total > 0) return { code: -1, msg: `该来源已被${usedCount.total}个客户使用，不能删除` };
    await collection.doc(data._id).remove();
    return { code: 0, msg: '线索来源已删除', data: { _id: data._id } };
  },

  isCloudObject: true,

  getList: async function (data = {}) {
    const { uid, userInfo = {} } = this.getClientInfo();
    const { vk, _ } = this.getUtil();
    const currentUserInfo = await getCurrentUserInfo(this, uid, userInfo);
    const admin = isSuperAdmin(currentUserInfo);
    const visibleSources = getLeadProviderVisibleSources(currentUserInfo);
    let whereJson = applyCustomerAccessWhere({ whereJson: {}, userInfo: currentUserInfo, uid, admin, _ });
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
    const selectedCustomerId = queryData.formData._id;
    delete queryData.formData._id;
    if (selectedCustomerId) whereJson._id = selectedCustomerId;
    const selectedConsultantId = queryData.formData.consultant_id;
    delete queryData.formData.consultant_id;
    if ((admin || visibleSources.length) && selectedConsultantId) whereJson.consultant_id = selectedConsultantId;
    // 一个关键词同时匹配家长姓名、孩子姓名和联系电话。
    const customerKeyword = String(queryData.formData.customer_keyword || '').trim();
    delete queryData.formData.customer_keyword;
    if (customerKeyword) {
      const keywordRegExp = new RegExp(vk.pubfn.escapeRegExp(customerKeyword), 'i');
      whereJson = _.and(whereJson, _.or([
        { parent_name: keywordRegExp },
        { child_name: keywordRegExp },
        { contact_phone: keywordRegExp },
      ]));
    }
    // 日期范围组件提交数组，转换成原有的开始/结束时间条件，兼容旧版查询参数。
    const createdTimeRange = queryData.formData._add_time_range;
    delete queryData.formData._add_time_range;
    if (Array.isArray(createdTimeRange) && createdTimeRange.length === 2) {
      queryData.formData._add_time_start = createdTimeRange[0];
      queryData.formData._add_time_end = createdTimeRange[1];
    }
    const selectedStarred = queryData.formData.is_starred;
    delete queryData.formData.is_starred;
    // 将时间范围直接写入最终 where 条件，避免 daterange 字段被 baseDao 当成普通字段处理。
    const createdTimeStartValue = queryData.formData._add_time_start;
    const createdTimeEndValue = queryData.formData._add_time_end;
    delete queryData.formData._add_time_start;
    delete queryData.formData._add_time_end;
    let createdTimeStart = 0;
    let createdTimeEnd = 0;
    if (createdTimeStartValue) {
      const start = new Date(createdTimeStartValue);
      start.setHours(0, 0, 0, 0);
      createdTimeStart = start.getTime();
    }
    if (createdTimeEndValue) {
      const end = new Date(createdTimeEndValue);
      end.setHours(23, 59, 59, 999);
      createdTimeEnd = end.getTime();
    }
    if (createdTimeStart && createdTimeEnd && createdTimeStart > createdTimeEnd) {
      const timeStart = createdTimeStart;
      createdTimeStart = createdTimeEnd;
      createdTimeEnd = timeStart;
    }
    const createdTimeConditions = [];
    if (createdTimeStart) createdTimeConditions.push(_.gte(createdTimeStart));
    if (createdTimeEnd) createdTimeConditions.push(_.lte(createdTimeEnd));
    if (createdTimeConditions.length === 1) {
      whereJson = _.and(whereJson, { _add_time: createdTimeConditions[0] });
    } else if (createdTimeConditions.length === 2) {
      whereJson = _.and(whereJson, { _add_time: _.and(createdTimeConditions[0], createdTimeConditions[1]) });
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
        is_starred: isCustomerStarredBy(row, uid),
        starred_at: getCustomerStarredAtBy(row, uid),
        consultant_name: row.consultant_name || row.consultantUserInfo && (row.consultantUserInfo.nickname || row.consultantUserInfo.username) || '',
      }));
      if (selectedStarred === true || selectedStarred === 'true' || selectedStarred === 1 || selectedStarred === '1') {
        result.rows = result.rows.filter((row) => row.is_starred);
      } else if (selectedStarred === false || selectedStarred === 'false' || selectedStarred === 0 || selectedStarred === '0') {
        result.rows = result.rows.filter((row) => !row.is_starred);
      }
    }
    return result;
  },

  // 咨询师首页概览：只返回当前用户可见的未删除客户，避免前端自行拼装权限范围。
  getDashboard: async function () {
    const { uid, userInfo = {} } = this.getClientInfo();
    const { _ } = this.getUtil();
    const currentUserInfo = await getCurrentUserInfo(this, uid, userInfo);
    const admin = isSuperAdmin(currentUserInfo);
    const whereJson = { is_deleted: _.neq(true) };
    applyCustomerAccessWhere({ whereJson, userInfo: currentUserInfo, uid, admin, _ });

    const dashboardDb = uniCloud.database();
    const configuredDashboardStatusOptions = await getCustomerStatusOptions(dashboardDb, false);
    const statusQualityMap = configuredDashboardStatusOptions.reduce((map, option) => {
      map[option.value] = option.quality_level || defaultQualityByStatus[option.value] || 'normal';
      return map;
    }, {});
    const result = await dashboardDb.collection('tm-clients')
      .where(whereJson)
      .field({ _id: true, name: true, parent_name: true, status: true, source: true, consultant_id: true, consultant_name: true, _add_time: true, last_edit_time: true, progress: true, followup_records: true, contract_amount: true, is_starred: true, starred_at: true, starred_by: true, starred_by_name: true, starred_user_ids: true, starred_users: true })
      .orderBy('last_edit_time', 'desc')
      .orderBy('_add_time', 'desc')
      .limit(1000)
      .get();
    const consultantCandidatesRes = await dashboardDb.collection('uni-id-users').field({
      _id: true,
      username: true,
      nickname: true,
      status: true,
      allow_login_background: true,
      role: true,
      roles: true,
      role_id: true,
      roleIds: true,
    }).limit(500).get();
    const consultantCandidates = (consultantCandidatesRes.data || [])
      .filter((item) => item.status !== 1 && item.allow_login_background !== false && isConsultantCandidate(item))
      .map((item) => ({
        consultant_id: item._id,
        consultant_name: item.nickname || item.username || '未命名咨询师',
      }))
      .sort((a, b) => String(a.consultant_name).localeCompare(String(b.consultant_name), 'zh-Hans-CN'));
    const rows = result.data || [];
    const now = Date.now();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;
    const month = new Date(now);
    month.setDate(1);
    month.setHours(0, 0, 0, 0);
    const monthStart = month.getTime();
    const getManualRecords = (row) => (Array.isArray(row.followup_records) ? row.followup_records : [])
      .filter((record) => !isSystemRecord(record) && !isTransferRecord(record));
    const parseTimeValue = (value) => {
      if (!value) return 0;
      if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
      if (value instanceof Date) return Number.isNaN(value.getTime()) ? 0 : value.getTime();
      const numericValue = Number(value);
      if (Number.isFinite(numericValue) && numericValue > 0) return numericValue;
      const stringValue = String(value).trim();
      if (!stringValue) return 0;
      // 优先解析 ISO 时间，兼容前端日期组件序列化后的进度时间。
      const parsedTime = new Date(stringValue).getTime();
      if (!Number.isNaN(parsedTime)) return parsedTime;
      // 再兼容历史数据中的 yyyy-MM-dd HH:mm:ss 格式。
      const legacyParsedTime = new Date(stringValue.replace(/-/g, '/')).getTime();
      return Number.isNaN(legacyParsedTime) ? 0 : legacyParsedTime;
    };
    const getRecordTime = (record = {}) => {
      const timeFields = [record.contact_time, record.create_time, record.update_time, record._add_time];
      for (const value of timeFields) {
        const parsedTime = parseTimeValue(value);
        if (parsedTime) return parsedTime;
      }
      return 0;
    };
    const getLatestFollowupTime = (row) => {
      return getManualRecords(row)
        .reduce((latest, record) => Math.max(latest, getRecordTime(record)), 0);
    };
    const hasProgress = (row) => {
      if (getManualRecords(row).length) return true;
      const normalizedStatus = statusOf(row);
      return Boolean(normalizedStatus && normalizedStatus !== 'initial_contact' || String(row.progress || '').trim());
    };
    const parseAmount = (value) => {
      const amount = Number(String(value || '').replace(/[^\d.-]/g, ''));
      return Number.isFinite(amount) ? amount : 0;
    };
    const isToday = (value) => {
      const time = parseTimeValue(value);
      return time >= todayStart && time < todayEnd;
    };
    const getTodayStatusRecords = (row) => getManualRecords(row).filter((record) => isToday(record.contact_time));
    const hasTodayStatusAdvanced = (row) => getTodayStatusRecords(row)
      .some((record) => normalizeCustomerStatus(record.status) !== 'initial_contact');
    const hasTodayConverted = (row) => getTodayStatusRecords(row)
      .some((record) => normalizeCustomerStatus(record.status) === 'converted');
    const hasMonthConverted = (row) => getManualRecords(row)
      .some((record) => getRecordTime(record) >= monthStart && normalizeCustomerStatus(record.status) === 'converted')
      || (statusOf(row) === 'converted' && Number(row.last_edit_time || 0) >= monthStart);
    const statusOf = (row) => normalizeCustomerStatus(row.status);
    const hasMonthProgress = (row) => getManualRecords(row)
      .some((record) => getRecordTime(record) >= monthStart)
      || (statusOf(row) !== 'initial_contact' && Number(row.last_edit_time || 0) >= monthStart);
    const hasMonthStatus = (row, targetStatus) => getManualRecords(row)
      .some((record) => getRecordTime(record) >= monthStart && normalizeCustomerStatus(record.status) === targetStatus)
      || (statusOf(row) === targetStatus && Number(row.last_edit_time || 0) >= monthStart);
    const sortedByPriority = [...rows].sort((a, b) => {
      const priority = { invited: 5, communicating_positive: 4, initial_contact: 3, communicating_difficult: 2, converted: 1, not_interested: 0 };
      return (priority[statusOf(b)] || 0) - (priority[statusOf(a)] || 0) || (b.last_edit_time || b._add_time || 0) - (a.last_edit_time || a._add_time || 0);
    });
    const getAssignedConsultantName = (row = {}) => row.consultant_name || row.consultantUserInfo && (row.consultantUserInfo.nickname || row.consultantUserInfo.username) || '';
    const getCustomerSummary = (row) => {
      const latest = getLatestFollowupTime(row);
      return {
        _id: row._id,
        name: row.parent_name || row.name || '未命名客户',
        status: statusOf(row),
        source: row.source || '',
        consultant_id: row.consultant_id || '',
        consultant_name: getAssignedConsultantName(row),
        latest_followup_at: latest,
        has_progress: hasProgress(row),
        update_time: row.last_edit_time || row._add_time || 0,
        is_starred: isCustomerStarredBy(row, uid),
        contract_amount: parseAmount(row.contract_amount),
      };
    };
    const starredRows = rows
      .filter((row) => isCustomerStarredBy(row, uid))
      .sort((a, b) => (getCustomerStarredAtBy(b, uid) || b.last_edit_time || b._add_time || 0) - (getCustomerStarredAtBy(a, uid) || a.last_edit_time || a._add_time || 0));
    const actionRows = rows
      .filter((row) => getManualRecords(row).length === 0 || statusOf(row) === 'initial_contact')
      .sort((a, b) => (b._add_time || 0) - (a._add_time || 0));
    const staleRows = rows.filter((row) => {
      const latest = getLatestFollowupTime(row);
      return !latest || now - latest >= 7 * 24 * 60 * 60 * 1000;
    }).sort((a, b) => getLatestFollowupTime(a) - getLatestFollowupTime(b));
    const todayRows = rows.filter((row) => isToday(row._add_time));
    // 直播/投流老师新增客户时必须同步选择咨询师，因此首页不再表达“待分配”状态。
    // 旧数据如果缺少 consultant_id，也按“已随新增同步”处理，避免页面误导为存在待分配环节。
    const todayAssignedRows = todayRows;
    const todayAdvancedRows = rows.filter(hasTodayStatusAdvanced);
    const todayConvertedRows = rows.filter(hasTodayConverted);
    const todayInvalidRows = todayRows.filter((row) => ['not_interested', 'refunded'].includes(statusOf(row)));
    const todayEffectiveRows = todayRows.filter((row) => !['not_interested', 'refunded'].includes(statusOf(row)));
    const monthNewRows = rows.filter((row) => Number(row._add_time || 0) >= monthStart);
    const monthAdvancedRows = rows.filter(hasMonthProgress);
    const monthConvertedRows = rows.filter((row) => hasMonthStatus(row, 'converted'));
    const monthRefundedRows = rows.filter((row) => hasMonthStatus(row, 'refunded'));
    const consultantStatMap = {};
    rows.forEach((row) => {
      const consultantName = getAssignedConsultantName(row);
      const key = row.consultant_id || consultantName || 'synced';
      if (!consultantStatMap[key]) {
        consultantStatMap[key] = {
          consultant_id: row.consultant_id || '',
          consultant_name: consultantName || '已随新增同步',
          received: 0,
          followed: 0,
          month_converted: 0,
          followup_rate: 0,
        };
      }
      const receivedToday = isToday(row._add_time);
      if (receivedToday) consultantStatMap[key].received += 1;
      if (receivedToday && hasTodayStatusAdvanced(row)) consultantStatMap[key].followed += 1;
      if (hasMonthConverted(row)) consultantStatMap[key].month_converted += 1;
    });
    Object.values(consultantStatMap).forEach((item) => {
      item.followup_rate = item.received ? Math.round((item.followed / item.received) * 100) : 0;
    });
    // 来源效果按当前可见客户累计统计，避免用“当天新增客户当天成交”衡量长周期业务。
    const sourceStats = Object.values(rows.reduce((map, row) => {
      const key = row.source || 'other';
      if (!map[key]) map[key] = { source: key, count: 0, advanced: 0, converted: 0, amount: 0 };
      map[key].count += 1;
      if (statusOf(row) !== 'initial_contact') map[key].advanced += 1;
      if (statusOf(row) === 'converted') {
        map[key].converted += 1;
        map[key].amount += parseAmount(row.contract_amount);
      }
      return map;
    }, {})).sort((a, b) => b.count - a.count);
    const liveConvertedRows = rows.filter((row) => statusOf(row) === 'converted');
    const statusRows = customerStatusOptions.map((option) => ({
      value: option.value,
      label: option.label,
      count: rows.filter((row) => normalizeCustomerStatus(row.status) === option.value).length,
    }));
    return {
      code: 0,
      summary: {
        total: rows.length,
        converted: rows.filter((row) => normalizeCustomerStatus(row.status) === 'converted').length,
        followed: rows.filter((row) => hasProgress(row)).length,
        today_new: rows.filter((row) => isToday(row._add_time)).length,
        today_followup: rows.reduce((count, row) => count + getManualRecords(row).filter((record) => isToday(record.contact_time)).length, 0),
        // 本月签单必须以“已签单”进度的发生时间为准，不能用客户资料最后编辑时间代替。
        month_converted: rows.filter(hasMonthConverted).length,
        contract_amount: rows.filter((row) => statusOf(row) === 'converted').reduce((total, row) => total + parseAmount(row.contract_amount), 0),
        conversion_rate: rows.length ? Math.round((rows.filter((row) => statusOf(row) === 'converted').length / rows.length) * 100) : 0,
      },
      status_distribution: statusRows,
      recent_customers: rows.slice(0, 5).map((row) => ({
        _id: row._id,
        name: row.parent_name || row.name || '未命名客户',
        status: normalizeCustomerStatus(row.status),
        source: row.source || '',
        update_time: row.last_edit_time || row._add_time || 0,
      })),
      today_tasks: actionRows.slice(0, 6).map((row) => ({
        ...getCustomerSummary(row),
        task_type: hasProgress(row) ? 'status' : 'first_followup',
        task_label: getManualRecords(row).length ? '确认客户进度' : '建立首次跟进',
      })),
      focus_customers: starredRows.slice(0, 5).map(getCustomerSummary),
      reminders: {
        need_followup: actionRows.length,
        stale_7d: staleRows.length,
        stale_15d: staleRows.filter((row) => {
          const latest = getLatestFollowupTime(row);
          return !latest || now - latest >= 15 * 24 * 60 * 60 * 1000;
        }).length,
      },
      reminder_customers: {
        need_followup: actionRows.map(getCustomerSummary),
        stale_7d: staleRows.map(getCustomerSummary),
        stale_15d: staleRows.filter((row) => {
          const latest = getLatestFollowupTime(row);
          return !latest || now - latest >= 15 * 24 * 60 * 60 * 1000;
        }).map(getCustomerSummary),
      },
      performance_customers: {
        month_converted: rows.filter((row) => statusOf(row) === 'converted' && Number(row.last_edit_time || 0) >= monthStart).map(getCustomerSummary),
        converted: rows.filter((row) => statusOf(row) === 'converted').map(getCustomerSummary),
      },
      live_dashboard: {
        overview: {
          today_new: todayRows.length,
          today_assigned: todayAssignedRows.length,
          effective_consult: todayEffectiveRows.length,
          invalid_customers: todayInvalidRows.length,
          converted_feedback: todayConvertedRows.length,
          month_new: monthNewRows.length,
          month_advanced: monthAdvancedRows.length,
          month_converted: monthConvertedRows.length,
          month_refunded: monthRefundedRows.length,
          month_contract_amount: monthConvertedRows.reduce((total, row) => total + parseAmount(row.contract_amount), 0),
        },
        flow: [
          { key: 'assigned', label: '今日新增并分发', value: todayAssignedRows.length },
          { key: 'advanced', label: '今日有进度客户', value: todayAdvancedRows.length },
          { key: 'converted', label: '今日签单客户', value: todayConvertedRows.length },
        ],
        consultant_stats: consultantCandidates.map((consultant) => {
          const stat = consultantStatMap[consultant.consultant_id] || consultantStatMap[consultant.consultant_name] || {};
          const received = stat.received || 0;
          const followed = stat.followed || 0;
          return {
            consultant_id: consultant.consultant_id,
            consultant_name: consultant.consultant_name,
            received,
            followed,
            converted: stat.converted || 0,
            followup_rate: received ? Math.round((followed / received) * 100) : 0,
          };
        }),
        source_stats: sourceStats.slice(0, 6).map((item) => ({
          ...item,
          conversion_rate: item.count ? Math.round((item.converted / item.count) * 1000) / 10 : 0,
        })),
        quality_stats: customerQualityOptions.map((quality) => ({
          key: quality.value,
          label: quality.label,
          value: todayRows.filter((row) => (statusQualityMap[statusOf(row)] || 'normal') === quality.value).length,
        })),
        recent_customers: todayRows.slice(0, 8).map(getCustomerSummary),
        value_summary: {
          month_new: rows.filter((row) => Number(row._add_time || 0) >= monthStart).length,
          converted: liveConvertedRows.length,
          contract_amount: liveConvertedRows.reduce((total, row) => total + parseAmount(row.contract_amount), 0),
        },
      },
    };
  },

  // 返回可作为客户归属人的咨询师名单，仅提供转移所需的公开字段。
  getConsultants: async function () {
    const result = await uniCloud.database().collection('uni-id-users').field({
      _id: true,
      username: true,
      nickname: true,
      status: true,
      allow_login_background: true,
      role: true,
      roles: true,
      role_id: true,
      roleIds: true,
    }).limit(500).get();
    const rows = (result.data || []).filter((item) => item.status !== 1 && item.allow_login_background !== false && isConsultantCandidate(item));
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

  importCustomers: async function (data = {}) {
    const { uid, userInfo = {} } = this.getClientInfo();
    const currentUserInfo = await getCurrentUserInfo(this, uid, userInfo);
    const admin = isSuperAdmin(currentUserInfo);
    const leadProviderUser = isLeadProviderUser(currentUserInfo);
    const inputRows = Array.isArray(data.rows) ? data.rows : [];
    const rows = inputRows.slice(0, 500);
    if (!rows.length) return { code: -1, msg: '没有可导入的客户数据' };
    if (inputRows.length > 500) return { code: -1, msg: '单次最多导入500条客户数据' };

    const db = uniCloud.database();
    const consultantMap = {};
    if (admin || leadProviderUser) {
      const consultantRes = await db.collection('uni-id-users').field({
        _id: true,
        username: true,
        nickname: true,
        realname: true,
        status: true,
        allow_login_background: true,
        role: true,
        roles: true,
        role_id: true,
        roleIds: true,
      }).limit(500).get();
      (consultantRes.data || []).filter(isConsultantCandidate).forEach((item) => {
        [item._id, item.username, item.nickname, item.realname].filter(Boolean).forEach((value) => {
          consultantMap[String(value).trim()] = item._id;
        });
      });
    }

    const failures = [];
    let successCount = 0;
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index] || {};
      const rowData = {
        ...row,
        _add_time: row._add_time || Date.now(),
        status: normalizeCustomerStatus(row.status),
        source: normalizeSourceValue(row.source || 'other'),
        attachments: [],
      };
      if (!rowData.consultant_id && rowData.consultant_name && consultantMap[String(rowData.consultant_name).trim()]) {
        rowData.consultant_id = consultantMap[String(rowData.consultant_name).trim()];
      }
      try {
        const result = await this.save(rowData);
        if (result && result.code !== 0) {
          failures.push({ row: index + 2, name: rowData.parent_name || '', msg: result.msg || '导入失败' });
        } else {
          successCount += 1;
        }
      } catch (error) {
        failures.push({ row: index + 2, name: rowData.parent_name || '', msg: error && error.message || '导入失败' });
      }
    }

    return {
      code: 0,
      data: {
        total: rows.length,
        success_count: successCount,
        fail_count: failures.length,
        failures: failures.slice(0, 20),
      },
      msg: failures.length ? '部分客户导入失败' : '客户导入完成',
    };
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
    const shouldAssignConsultant = leadProviderUser || (admin && !_id);
    if (shouldAssignConsultant && (!consultant_id || !String(consultant_id).trim())) return { code: -1, msg: '请选择咨询师' };
    if (leadProviderUser && visibleSources.length && !getSourceAliases(source).some((item) => visibleSources.includes(item))) {
      return { code: -1, msg: '当前角色不能分发该线索来源的客户' };
    }
    let consultantInfo = null;
    if (shouldAssignConsultant && consultant_id) {
      const consultantRes = await uniCloud.database().collection('uni-id-users').doc(consultant_id).field({
        _id: true,
        username: true,
        nickname: true,
        status: true,
        allow_login_background: true,
        role: true,
        roles: true,
        role_id: true,
        roleIds: true,
      }).get();
      consultantInfo = consultantRes.data && consultantRes.data[0];
      if (!consultantInfo) return { code: -1, msg: '咨询师不存在' };
      if (consultantInfo.status === 1 || consultantInfo.allow_login_background === false) return { code: -1, msg: '所选咨询师当前不可用' };
      if (!isConsultantCandidate(consultantInfo)) return { code: -1, msg: '所选账号不是咨询师，不能分配客户' };
    }
    let existingCustomer = null;
    // 客户创建后不允许通过客户资料表单直接改状态，状态只能由进度记录驱动。
    if (_id) {
      const existingWhere = applyCustomerAccessWhere({ whereJson: { _id }, userInfo: currentUserInfo, uid, admin, _ });
      const existingRes = await db.collection('tm-clients').where(existingWhere).limit(1).get();
      existingCustomer = existingRes.data && existingRes.data[0];
      if (!existingCustomer) return { code: -1, msg: '客户不存在或无权编辑' };
      if (existingCustomer.is_deleted) return { code: -1, msg: '已删除客户不可编辑，请先恢复客户信息' };
      if (!admin && source !== undefined && source !== null && !sameCustomerSource(source, existingCustomer.source)) {
        return { code: -1, msg: '客户来源创建后不可修改，如需调整请联系管理员' };
      }
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
      dataJson.lead_provider_id = existingCustomer && existingCustomer.lead_provider_id || uid;
      dataJson.lead_provider_name = existingCustomer && existingCustomer.lead_provider_name || currentUserInfo.nickname || currentUserInfo.username || '';
      if (existingCustomer && existingCustomer.consultant_id && existingCustomer.consultant_info_modified_at) {
        dataJson.consultant_id = existingCustomer.consultant_id;
        dataJson.consultant_name = existingCustomer.consultant_name || '';
      }
    }
    if (shouldAssignConsultant && consultantInfo) {
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
      return {
        code: 0,
        num: res,
        msg: dataJson.status === 'converted' ? '客户信息已更新，客户状态已改为“已签单”，代表已签此单' : '客户信息已更新',
      };
    }
    if (leadProviderUser) {
      dataJson.consultant_id = consultantInfo && consultantInfo._id || consultant_id;
      dataJson.consultant_name = consultantInfo && (consultantInfo.nickname || consultantInfo.username) || consultant_name || '';
      dataJson.lead_provider_id = uid;
      dataJson.lead_provider_name = currentUserInfo.nickname || currentUserInfo.username || '';
      dataJson.followup_records = [];
      dataJson.attachments = [];
      dataJson.signing_province = '';
      dataJson.signing_city = '';
      dataJson.contract_amount = '';
      dataJson.contract_content = '';
    } else if (!admin) {
      dataJson.consultant_id = uid;
      dataJson.consultant_name = currentUserInfo.nickname || currentUserInfo.username || '';
    }
    dataJson.is_deleted = false;
    const id = await vk.baseDao.add({ dbName: 'tm-clients', dataJson });
    await this.syncMaterials({ customer_id: id, attachments: normalizedAttachments });
    if (shouldAssignConsultant && consultantInfo && consultantInfo._id) {
      await notifyCustomerDistribution({
        db,
        recipientId: consultantInfo._id,
        customerId: id,
        customerName: parent_name || '未命名客户',
        actorId: uid,
        actorName: currentUserInfo.nickname || currentUserInfo.username || (admin ? '管理员' : '线索老师'),
        isRedispatch: false,
      });
    }
    return {
      code: 0,
      id,
      msg: dataJson.status === 'converted' ? '客户信息已新增，客户状态为“已签单”，代表已签此单' : '客户信息已新增',
    };
  },

  // 标记/取消重点客户：管理员可操作任意客户；咨询师只能操作自己名下客户；直播/投流老师只能操作自己可见来源的客户。
  toggleStar: async function (data = {}) {
    const { uid, userInfo = {} } = this.getClientInfo();
    const { _ } = this.getUtil();
    const currentUserInfo = await getCurrentUserInfo(this, uid, userInfo);
    const admin = isSuperAdmin(currentUserInfo);
    const { customer_id } = data;
    const isStarred = data.is_starred === true || data.is_starred === 'true' || data.is_starred === 1;
    if (!customer_id) return { code: -1, msg: '请选择客户' };

    const db = uniCloud.database();
    const customerWhere = { _id: customer_id };
    applyCustomerAccessWhere({ whereJson: customerWhere, userInfo: currentUserInfo, uid, admin, _ });
    const customerRes = await db.collection('tm-clients').where(customerWhere).limit(1).get();
    const customer = customerRes.data && customerRes.data[0];
    if (!customer) return { code: -1, msg: '客户不存在或无权操作' };
    if (customer.is_deleted) return { code: -1, msg: '已删除客户不能标记重点' };

    let starredUserIds = getStarredUserIds(customer);
    let starredUsers = getStarredUsers(customer);
    const operatorName = currentUserInfo.nickname || currentUserInfo.username || '';
    const operationTime = Date.now();
    if (isStarred) {
      if (!starredUserIds.includes(uid)) starredUserIds.push(uid);
      starredUsers = starredUsers.filter((item) => item.uid !== uid);
      starredUsers.push({
        uid,
        name: operatorName,
        starred_at: operationTime,
      });
    } else {
      starredUserIds = starredUserIds.filter((item) => item !== uid);
      starredUsers = starredUsers.filter((item) => item.uid !== uid);
    }
    const latestStarredUser = [...starredUsers].sort((a, b) => (b.starred_at || 0) - (a.starred_at || 0))[0] || null;
    const updateData = {
      is_starred: starredUserIds.length > 0,
      starred_user_ids: starredUserIds,
      starred_users: starredUsers,
      starred_at: latestStarredUser ? latestStarredUser.starred_at || 0 : 0,
      starred_by: latestStarredUser ? latestStarredUser.uid || '' : '',
      starred_by_name: latestStarredUser ? latestStarredUser.name || '' : '',
      last_edit_time: operationTime,
    };
    await db.collection('tm-clients').doc(customer_id).update(updateData);
    return {
      code: 0,
      is_starred: isStarred,
      starred_at: getCustomerStarredAtBy(updateData, uid),
      msg: isStarred ? '已设为重点客户' : '已取消重点客户',
    };
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
      role: true,
      roles: true,
      role_id: true,
      roleIds: true,
    }).get();
    const target = targetRes.data && targetRes.data[0];
    if (!target) return { code: -1, msg: '目标咨询师不存在' };
    if (target.status === 1 || target.allow_login_background === false) return { code: -1, msg: '目标咨询师当前不可用' };
    if (!isConsultantCandidate(target)) return { code: -1, msg: '目标账号不是咨询师，不能转移客户' };

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
      route: `/pages/custom/records?customer_id=${encodeURIComponent(customer_id)}`,
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
    const normalizedContactTime = parseTimeInput(contact_time);
    if (!normalizedContactTime || Number.isNaN(normalizedContactTime)) return { code: -1, msg: '沟通时间不能为空' };
    if (normalizedContactTime > Date.now()) return { code: -1, msg: '沟通时间不能晚于当前时间' };

    const db = uniCloud.database();
    const whereJson = { _id: customer_id };
    if (!admin) whereJson.consultant_id = uid;
    const customerRes = await db.collection('tm-clients').where(whereJson).get();
    const customer = customerRes.data && customerRes.data[0];
    if (!customer) return { code: -1, msg: '客户不存在或无权操作' };
    if (customer.is_deleted) return { code: -1, msg: '已删除客户不可添加进度，请先恢复客户信息' };
    if (!admin && postConvertedStatusValues.includes(normalizeCustomerStatus(customer.status)) && !postConvertedStatusValues.includes(normalizeCustomerStatus(status))) {
      return { code: -1, msg: '客户已签单，进度状态只能选择“已签单”或“已退单”' };
    }

    const record = {
      _id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      contact_time: normalizedContactTime,
      status: normalizeCustomerStatus(status),
      content: String(content || '').trim(),
      create_time: Date.now(),
      consultant_id: customer.consultant_id || uid,
      operator_id: uid,
      operator_name: getOperatorName(currentUserInfo, admin),
      last_operator_id: uid,
      last_operator_name: getOperatorName(currentUserInfo, admin),
      update_time: Date.now(),
    };
    const followupRecords = sortFollowupRecords([record, ...(customer.followup_records || [])]);
    const latestManualRecord = getLatestManualFollowupRecord(followupRecords);
    await db.collection('tm-clients').doc(customer_id).update({
      followup_records: followupRecords,
      status: latestManualRecord ? normalizeCustomerStatus(latestManualRecord.status) : normalizeCustomerStatus(customer.status),
      progress: latestManualRecord ? latestManualRecord.content : '',
      last_edit_time: Date.now(),
    });
    await notifyLeadProviderFollowupFeedback({
      db,
      customer,
      record,
      actorId: uid,
      actorName: getOperatorName(currentUserInfo, admin),
      isUpdate: false,
    });
    return {
      code: 0,
      data: record,
      records: followupRecords,
      status: latestManualRecord ? normalizeCustomerStatus(latestManualRecord.status) : normalizeCustomerStatus(customer.status),
      progress: latestManualRecord ? latestManualRecord.content : '',
      msg: latestManualRecord && latestManualRecord._id === record._id && record.status === 'converted' ? '进度已保存，客户状态已改为“已签单”，代表已签此单' : '进度已保存',
    };
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
    const normalizedContactTime = parseTimeInput(contact_time);
    if (!normalizedContactTime || Number.isNaN(normalizedContactTime)) return { code: -1, msg: '沟通时间不能为空' };
    if (normalizedContactTime > Date.now()) return { code: -1, msg: '沟通时间不能晚于当前时间' };

    const db = uniCloud.database();
    const whereJson = { _id: customer_id };
    if (!admin) whereJson.consultant_id = uid;
    const customerRes = await db.collection('tm-clients').where(whereJson).get();
    const customer = customerRes.data && customerRes.data[0];
    if (!customer) return { code: -1, msg: '客户不存在或无权操作' };
    if (customer.is_deleted) return { code: -1, msg: '已删除客户不可编辑进度，请先恢复客户信息' };
    if (!admin && postConvertedStatusValues.includes(normalizeCustomerStatus(customer.status)) && !postConvertedStatusValues.includes(normalizeCustomerStatus(status))) {
      return { code: -1, msg: '客户已签单，进度状态只能选择“已签单”或“已退单”' };
    }
    const records = normalizeFollowupRecords(customer.followup_records);
    const index = records.findIndex((item) => item._id === followup_id);
    if (index < 0) return { code: -1, msg: '进度记录不存在' };
    if (isSystemRecord(records[index])) return { code: -1, msg: '系统操作记录不可编辑' };
    if (isTransferRecord(records[index])) return { code: -1, msg: '系统转移记录不可编辑' };
    if (!admin && postConvertedStatusValues.includes(normalizeCustomerStatus(records[index].status))) {
      return { code: -1, msg: '已签单或已退单的进度只有管理员可以编辑' };
    }
    records[index] = {
      ...records[index],
      contact_time: normalizedContactTime,
      status: normalizeCustomerStatus(status),
      content: String(content || '').trim(),
      last_operator_id: uid,
      last_operator_name: getOperatorName(currentUserInfo, admin),
      update_time: Date.now(),
    };
    const sortedRecords = sortFollowupRecords(records);
    const latestManualRecord = getLatestManualFollowupRecord(sortedRecords);
    await db.collection('tm-clients').doc(customer_id).update({
      followup_records: sortedRecords,
      status: latestManualRecord ? normalizeCustomerStatus(latestManualRecord.status) : normalizeCustomerStatus(customer.status),
      progress: latestManualRecord ? latestManualRecord.content : '',
      last_edit_time: Date.now(),
    });
    const updatedRecord = sortedRecords.find((item) => item._id === followup_id) || records[index];
    await notifyLeadProviderFollowupFeedback({
      db,
      customer,
      record: updatedRecord,
      actorId: uid,
      actorName: getOperatorName(currentUserInfo, admin),
      isUpdate: true,
    });
    return {
      code: 0,
      data: updatedRecord,
      records: sortedRecords,
      status: latestManualRecord ? normalizeCustomerStatus(latestManualRecord.status) : normalizeCustomerStatus(customer.status),
      progress: latestManualRecord ? latestManualRecord.content : '',
      msg: latestManualRecord && latestManualRecord._id === followup_id && normalizeCustomerStatus(updatedRecord.status) === 'converted' ? '进度已更新，客户状态已改为“已签单”，代表已签此单' : '进度已更新',
    };
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
    const records = sortFollowupRecords(normalizeFollowupRecords(customer.followup_records).filter((item) => item._id !== followup_id));
    const deletedRecord = (customer.followup_records || []).find((item) => item._id === followup_id);
    if (deletedRecord && isSystemRecord(deletedRecord)) return { code: -1, msg: '系统操作记录不可删除' };
    if (deletedRecord && isTransferRecord(deletedRecord)) return { code: -1, msg: '系统转移记录不可删除' };
    const latestManualRecord = getLatestManualFollowupRecord(records);
    await db.collection('tm-clients').doc(customer_id).update({
      followup_records: records,
      status: latestManualRecord ? normalizeCustomerStatus(latestManualRecord.status) : 'initial_contact',
      progress: latestManualRecord ? latestManualRecord.content : '',
      last_edit_time: Date.now(),
    });
    return {
      code: 0,
      records,
      status: latestManualRecord ? normalizeCustomerStatus(latestManualRecord.status) : 'initial_contact',
      progress: latestManualRecord ? latestManualRecord.content : '',
      msg: '进度记录已删除',
    };
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
