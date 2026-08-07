'use strict';

// 通知中心只允许用户读取和修改自己的消息。
const cloudObject = {
  isCloudObject: true,

  getList: async function (data = {}) {
    const { uid, userInfo = {} } = this.getClientInfo();
    if (!uid) return { code: -1, msg: '请先登录' };
    const db = uniCloud.database();
    const roleValues = [userInfo.role, userInfo.roles, userInfo.role_id, userInfo.roleIds]
      .flatMap((value) => Array.isArray(value) ? value : [value])
      .map((value) => typeof value === 'object' && value ? value.role_id || value.value || value.name : value)
      .filter(Boolean)
      .map((value) => String(value));
    const notificationWhere = { recipient_id: uid };
    if (roleValues.includes('admin')) {
      notificationWhere.type = db.command.in([
        'customer_distribution',
        'customer_redispatch',
        'customer_transfer',
        'customer_followup_key_event',
      ]);
    }
    const pageSize = Math.min(Math.max(Number(data.page_size) || 50, 1), 100);
    const result = await db.collection('tm-notifications')
      .where(notificationWhere)
      .orderBy('create_time', 'desc')
      .limit(pageSize)
      .get();
    const unreadResult = await db.collection('tm-notifications')
      .where({ ...notificationWhere, read: false })
      .count();
    const rows = (result.data || []).map((item) => {
      // 修复早期转移通知未写入原咨询师名称的问题，优先使用已保存的操作人名称展示。
      let row = item;
      if (item.type === 'customer_transfer' && item.actor_name && String(item.content || '').indexOf('咨询师未分配已将') === 0) {
        row = { ...row, content: String(item.content).replace('咨询师未分配已将', `咨询师${item.actor_name}已将`) };
      }
      if (row.customer_id) {
        const route = row.route || '';
        if (!route) {
          row = { ...row, route: `/pages/custom/records?customer_id=${encodeURIComponent(row.customer_id)}` };
        } else if (route.indexOf('/pages/custom/records') === 0 && route.indexOf('customer_id=') === -1) {
          row = { ...row, route: `${route}${route.indexOf('?') === -1 ? '?' : '&'}customer_id=${encodeURIComponent(row.customer_id)}` };
        }
      }
      return row;
    });
    return {
      code: 0,
      rows,
      unread_count: unreadResult.total || 0,
    };
  },

  getUnreadCount: async function () {
    const { uid, userInfo = {} } = this.getClientInfo();
    if (!uid) return { code: -1, msg: '请先登录' };
    const db = uniCloud.database();
    const roleValues = [userInfo.role, userInfo.roles, userInfo.role_id, userInfo.roleIds]
      .flatMap((value) => Array.isArray(value) ? value : [value])
      .map((value) => typeof value === 'object' && value ? value.role_id || value.value || value.name : value)
      .filter(Boolean)
      .map((value) => String(value));
    const notificationWhere = { recipient_id: uid, read: false };
    if (roleValues.includes('admin')) {
      notificationWhere.type = db.command.in([
        'customer_distribution',
        'customer_redispatch',
        'customer_transfer',
        'customer_followup_key_event',
      ]);
    }
    const unreadResult = await db.collection('tm-notifications')
      .where(notificationWhere)
      .count();
    return { code: 0, unread_count: unreadResult.total || 0 };
  },

  markRead: async function (data = {}) {
    const { uid } = this.getClientInfo();
    const { notification_id } = data;
    if (!uid || !notification_id) return { code: -1, msg: '消息参数不完整' };
    const result = await uniCloud.database().collection('tm-notifications')
      .where({ _id: notification_id, recipient_id: uid })
      .update({ read: true });
    return { code: 0, num: result.updated || 0, msg: '消息已读' };
  },

  markAllRead: async function () {
    const { uid, userInfo = {} } = this.getClientInfo();
    if (!uid) return { code: -1, msg: '请先登录' };
    const db = uniCloud.database();
    const roleValues = [userInfo.role, userInfo.roles, userInfo.role_id, userInfo.roleIds]
      .flatMap((value) => Array.isArray(value) ? value : [value])
      .map((value) => typeof value === 'object' && value ? value.role_id || value.value || value.name : value)
      .filter(Boolean)
      .map((value) => String(value));
    const notificationWhere = { recipient_id: uid, read: false };
    if (roleValues.includes('admin')) {
      notificationWhere.type = db.command.in([
        'customer_distribution',
        'customer_redispatch',
        'customer_transfer',
        'customer_followup_key_event',
      ]);
    }
    const result = await db.collection('tm-notifications')
      .where(notificationWhere)
      .update({ read: true });
    return { code: 0, num: result.updated || 0, msg: '消息已全部读' };
  },
};

module.exports = cloudObject;
