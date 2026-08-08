// 微信小程序端 vuedraggable 占位组件
// vuedraggable 依赖浏览器 DOM（拖拽），小程序端不可用。
// 通过 vue.config.js 的 webpack alias 在 mp-weixin 平台替换为本占位组件，
// 仅透传默认插槽内容，保证引用它的组件（如 vk-unicloud-admin-ui 内部组件）能正常渲染，不导致 app 启动崩溃。
// H5 端不经过此 alias，仍使用真实 vuedraggable。
export default {
  name: 'draggable',
  functional: true,
  render(h, ctx) {
    const slots = (ctx.slots && ctx.slots().default) || [];
    return h('view', { class: 'draggable-stub' }, slots);
  },
};
