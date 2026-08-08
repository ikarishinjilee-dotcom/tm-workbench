// 微信小程序端兼容配置
// vk-unicloud-admin-ui 顶层静态 require 了 vuedraggable / sortablejs，二者依赖浏览器 DOM，
// 在小程序端（无 document）app 启动时会抛 "Cannot read property 'childNodes' of undefined"。
// 这里在 mp-weixin 平台通过 webpack alias 将二者替换为占位实现，H5 端完全不受影响。
const path = require('path');

module.exports = {
  configureWebpack(config) {
    if (process.env.UNI_PLATFORM === 'mp-weixin') {
      // HBuilderX uniapp-cli 传入的是 webpack-chain 实例，必须用链式 API（alias.set）修改，
      // 不能整体替换 config.resolve.alias（会破坏 vue-loader 等既有 rule 链，报 VueLoaderPlugin Error）。
      if (config.resolve && typeof config.resolve.alias === 'object') {
        if (typeof config.resolve.alias.set === 'function') {
          config.resolve.alias.set('vuedraggable', path.resolve(__dirname, 'stubs/vuedraggable.js'));
          config.resolve.alias.set('sortablejs', path.resolve(__dirname, 'stubs/sortablejs.js'));
        } else {
          config.resolve.alias = Object.assign({}, config.resolve.alias, {
            vuedraggable: path.resolve(__dirname, 'stubs/vuedraggable.js'),
            sortablejs: path.resolve(__dirname, 'stubs/sortablejs.js'),
          });
        }
      }
    }
    // 不返回 config，避免覆盖 uni-app 的 webpack 配置
  },
};
