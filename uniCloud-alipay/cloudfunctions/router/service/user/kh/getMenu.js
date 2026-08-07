'use strict';
module.exports = {
  /**
   * 获取我拥有的菜单列表
   * @url user/kh/getMenu 前端调用的url参数地址
   * res 返回参数说明
   * @param {Number} code 错误码，0表示成功
   * @param {String} msg 详细信息
   */
  main: async (event) => {
    let { data = {}, userInfo, util, filterResponse, originalParam } = event;
    let { customUtil, uniID, config, pubFun, vk, db, _ } = util;
    let { uid } = data;
    let res = { code: 0, msg: '' };
    // 业务逻辑开始-----------------------------------------------------------
    let { role = [] } = userInfo;
    // 超级管理员拥有后台全部菜单，不受角色菜单绑定限制。
    // 普通角色仍然只返回已绑定的菜单，避免越权展示或访问其他模块。
    if (role.indexOf('admin') > -1) {
      res = await vk.system.sysDao.listMenuToTree({
        pageIndex: 1,
        pageSize: 500,
        whereJson: {
          parent_id: _.in([null, '']),
          menu_id: _.exists(true),
          enable: true,
        },
        treeProps: {
          level: 3,
        },
      });
      // listMenuToTree 返回 rows（树形）和 list（扁平数组），前端 getMenu
      // 约定使用 menus 和 menuList，这里统一转换为前端需要的字段。
      res.menus = res.rows || [];
      res.menuList = res.list || [];
    } else {
      // 根据角色获取菜单
      res = await vk.system.sysDao.listMenuByRole({
        role,
        treeProps: {
          level: 3,
        },
      });
    }
    // 兼容历史菜单中曾保存的旧路径，避免菜单点击进入 404。
    const normalizeMenuUrl = (menu) => {
      if (!menu || typeof menu !== 'object') return menu;
      const normalized = { ...menu };
      if (normalized.url === '/pages_plugs/system/customstatus/list') {
        normalized.url = '/pages_plugs/system/customer-status/list';
      }
      if (Array.isArray(normalized.children)) {
        normalized.children = normalized.children.map(normalizeMenuUrl);
      }
      return normalized;
    };
    ['menus', 'menuList', 'rows', 'list'].forEach((key) => {
      if (Array.isArray(res[key])) res[key] = res[key].map(normalizeMenuUrl);
    });
    res.userInfo = userInfo;
    // 业务逻辑结束-----------------------------------------------------------
    return res;
  },
};
