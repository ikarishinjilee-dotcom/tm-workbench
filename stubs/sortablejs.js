// 微信小程序端 sortablejs 占位实现
// sortablejs 依赖浏览器 DOM（document），小程序端不可用。
// 通过 vue.config.js 的 webpack alias 在 mp-weixin 平台替换为空对象，
// 避免 app 启动时执行 sortablejs 模块代码访问 document 崩溃。
// H5 端不经过此 alias，仍使用真实 sortablejs。
module.exports = {};
