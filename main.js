import Vue from 'vue';
import App from './App';
import store from './store';
import config from '@/app.config.js';

// 引入 elementUI
import elementUI from 'element-ui';
// element-ui 样式含内联 base64 字体图标，微信小程序 wxss 编译器无法解析（报 unexpected token），仅 H5 端引入。
// #ifdef H5
import 'element-ui/lib/theme-chalk/index.css';
// #endif

// 加载 Element UI 的语言包
import enLocale from 'element-ui/lib/locale/lang/en';
import zhHansLocale from 'element-ui/lib/locale/lang/zh-CN';
import zhHantLocale from 'element-ui/lib/locale/lang/zh-TW';

const elLocale = {
  en: enLocale,
  'zh-Hans': zhHansLocale,
  'zh-Hant': zhHantLocale,
};
// 加载 vk 语言包
import vkLocale from './locale/index';

const messages = {
  // 英文
  en: {
    ...elLocale['en'],
    ...vkLocale['en'],
  },
  // 简体中文
  'zh-Hans': {
    ...elLocale['zh-Hans'],
    ...vkLocale['zh-Hans'],
  },
  // 繁体中文
  'zh-Hant': {
    ...elLocale['zh-Hant'],
    ...vkLocale['zh-Hant'],
  },
};

// 引入 vue-i18n
import VueI18n from 'vue-i18n';
Vue.use(VueI18n);

const i18n = new VueI18n({
  locale: uni.getLocale() || 'zh-Hans', // 页面上通过执行 uni.setLocale('en') 可设置为英文（需要刷新页面才生效）
  messages,
});

Vue.use(elementUI, {
  i18n: (key, value) => i18n.t(key, value),
});

// 引入 高性能表格UI 组件
import UmyUi from 'umy-ui';
// umy-ui 样式含内联字体等，小程序 wxss 编译器无法解析，仅 H5 端引入。
// #ifdef H5
import 'umy-ui/lib/theme-chalk/index.css';
// #endif
Vue.use(UmyUi);

// 引入 vk 实例
import vk from 'uni_modules/vk-unicloud';
config.i18n = i18n;
Vue.use(vk, config);

// 引入 vkAdminUI 组件
import vkAdminUI from 'vk-unicloud-admin-ui';
// vk-unicloud-admin-ui 主题含 vk-icon 内联 base64 woff2 字体，微信小程序 wxss 编译器无法解析，仅 H5 端引入。
// #ifdef H5
import 'vk-unicloud-admin-ui/theme/index.css';
// #endif
Vue.use(vkAdminUI);

// 自动注册全局组件（必须加在Vue.use(vkAdminUI);的后面）
// 注意：微信小程序端编译要求 Vue.component 的第一个参数必须是静态字符串，
// 不能使用 require.context 动态遍历注册（会报 "Vue.component()的第一个参数必须为静态字符串"）。
// 因此改为静态 import + 显式注册，组件名与原来的动态注册规则保持一致。
import customDemo from '@/components/custom-demo/custom-demo.vue';
import MessageCenter from '@/components/MessageCenter/MessageCenter.vue';
import vkDataInputEditor from '@/components/vk-data-input-editor/vk-data-input-editor.vue';
import vkDataPageHeader from '@/components/vk-data-page-header/vk-data-page-header.vue';
import vkDataQrcode from '@/components/vk-data-qrcode/vk-data-qrcode.vue';

Vue.component('custom-demo', customDemo);
Vue.component('MessageCenter', MessageCenter);
Vue.component('vk-data-input-editor', vkDataInputEditor);
Vue.component('vk-data-page-header', vkDataPageHeader);
Vue.component('vk-data-qrcode', vkDataQrcode);

// vk-data-input-file-select 与 custom-editor-tinymce 仅支持 H5：
// vk-data-input-file-select 依赖 wxfileMessage 等小程序原生插件，编译器自动生成的 .json 配置缺失导致小程序端启动失败；
// custom-editor-tinymce 依赖 tinymce 浏览器库，小程序端无意义。
// 用条件编译仅在 H5 端注册，确保小程序端不触发相关编译，同时不影响 PC 端正常使用。
// #ifdef H5
import vkDataInputFileSelect from '@/components/vk-data-input-file-select/vk-data-input-file-select.vue';
import customEditorTinymce from '@/components/custom-editor-tinymce/custom-editor-tinymce.vue';
Vue.component('vk-data-input-file-select', vkDataInputFileSelect);
Vue.component('custom-editor-tinymce', customEditorTinymce);
// #endif

// 显式注册根目录下的单文件组件（require.context 不会自动注册 length===1 的文件）。
import StatusTag from '@/components/StatusTag.vue';
Vue.component('StatusTag', StatusTag);

// 引入 自定义全局css 样式
import '@/common/css/app.scss';

// H5 端才需要的全局样式：uni-admin 的 uni.css（含 ~ 兄弟选择器，小程序 wxss 不支持）
// 与 uni-icons.css（含字体）。JS 条件编译比 SCSS 内嵌 @if/#ifdef 更可靠。
// #ifdef H5
import '@/common/uni-admin/css/uni.css';
import '@/common/uni-admin/css/uni-icons.css';
// #endif

Vue.config.productionTip = false;

App.mpType = 'app';

const app = new Vue({
  i18n,
  store,
  ...App,
});
app.$mount();
