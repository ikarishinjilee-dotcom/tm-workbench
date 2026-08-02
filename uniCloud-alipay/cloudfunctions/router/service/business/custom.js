'use strict';

module.exports = {
  isCloudObject: true,

  getList: async function (data = {}) {
    const { uid, userInfo = {} } = this.getClientInfo();
    const { vk } = this.getUtil();
    const role = userInfo.role || [];
    const whereJson = {};
    if (!role.includes('admin')) whereJson.consultant_id = uid;
    return await vk.baseDao.getTableData({
      dbName: 'tm-clients',
      data,
      whereJson,
      sortArr: [{ name: 'last_followup_at', type: 'desc' }, { name: '_add_time', type: 'desc' }],
    });
  },

  save: async function (data = {}) {
    const { uid, userInfo = {} } = this.getClientInfo();
    const { vk } = this.getUtil();
    const role = userInfo.role || [];
    const { _id, name, phone, wechat, source, stage, next_followup_at, remark } = data;
    if (!name || !phone || !stage) return { code: -1, msg: '客户姓名、手机号和咨询阶段不能为空' };
    const whereJson = {};
    if (!role.includes('admin')) whereJson.consultant_id = uid;
    const dataJson = { name, phone, wechat, source, stage, next_followup_at, remark };
    if (_id) {
      whereJson._id = _id;
      const res = await vk.baseDao.update({ dbName: 'tm-clients', whereJson, dataJson });
      return { ...res, msg: '客户信息已更新' };
    }
    dataJson.consultant_id = uid;
    dataJson.last_followup_at = null;
    const id = await vk.baseDao.add({ dbName: 'tm-clients', dataJson });
    return { code: 0, id, msg: '客户已新增' };
  },

  delete: async function (data = {}) {
    const { uid, userInfo = {} } = this.getClientInfo();
    const { vk, _ } = this.getUtil();
    const role = userInfo.role || [];
    if (!data._id) return { code: -1, msg: '缺少客户ID' };
    const whereJson = { _id: Array.isArray(data._id) ? _.in(data._id) : data._id };
    if (!role.includes('admin')) whereJson.consultant_id = uid;
    const num = await vk.baseDao.del({ dbName: 'tm-clients', whereJson });
    return { code: 0, num, msg: '客户已删除' };
  },
};
