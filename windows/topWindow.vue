<template>
  <div class="header no-user-select" :class="showMenuTabs ? 'show-menu-tabs' : 'hide-menu-tabs'" v-loading="!appInitedCom" :style="'--textColor' + textColorCom">
    <!-- 左侧 -->
    <div class="left">
      <!-- 模式一：纯图片 -->
      <navigator class="logo-mode-1" open-type="reLaunch" url="/" v-if="mode === 1">
        <image :src="logo1Com" mode="aspectFit" class="logo-image" v-show="leftCollapseCom"></image>
        <image :src="logo2Com" mode="aspectFit" class="logo-image" v-show="!leftCollapseCom"></image>
      </navigator>

      <!-- 模式二：图片+文字 -->
      <navigator class="logo-mode-2" open-type="reLaunch" url="/" v-else>
        <div class="logo-box" v-show="!leftCollapseCom">
          <image class="logo-image" :src="logoCom" mode="scaleToFill"></image>
          <div class="app-name">{{ titleCom }}</div>
        </div>
        <div class="logo-box" v-show="leftCollapseCom">
          <image class="logo-image" :src="logoCom" mode="aspectFit"></image>
        </div>
      </navigator>
    </div>
    <!-- 右侧 -->
    <div class="right">
      <!-- 右上 -->
      <div class="right-top" :style="topMenuStyleCom">
        <div class="navbar" :class="{ 'navbar-mini': !matchLeftWindow }">
          <vk-data-icon
            class="menu-collapse"
            :name="leftCollapseCom ? 'vk-icon-zhankaicaidan' : 'vk-icon-shouqicaidan'"
            :size="17"
            :color="textColorCom"
            :pointer="true"
            @click="menuCollapse"
          ></vk-data-icon>
          <!-- 面包屑 -->
          <breadcrumb></breadcrumb>

          <div class="navbar-left">
            <vk-data-icon @click="toggleSidebar" class="menu-icon pointer" name="vk-icon-sortlight" :size="30" :color="textColorCom"></vk-data-icon>
          </div>
          <div class="navbar-middle">
            <span class="title-text">{{ navigationBarTitleText }}</span>
          </div>
          <div class="navbar-right">
            <div class="navbar-menu">
              <message-center
                :messages="messageMessages"
                :color="textColorCom"
                @message-click="handleMessageClick"
                @mark-all-read="markAllMessagesRead"
              ></message-center>
              <!-- #ifdef WEB -->
              <div v-if="errorLogsCom.length" @click="openForm('errorLog')" class="menu-item debug pointer">
                <el-badge :value="errorLogsCom.length" class="item">
                  <vk-data-icon name="el-icon-message-solid" :size="22" :color="textColorCom"></vk-data-icon>
                </el-badge>
              </div>
              <!-- #endif -->
              <div v-if="appWidthCom >= 1100 && debug" v-for="link in links" :key="link.url" class="menu-item text-overflow">
                <vk-data-link :href="link.url" :text="link.text" />
              </div>
            </div>
            <el-dropdown v-if="isLoginCom" trigger="hover" @command="handleUserMenuCommand">
              <div class="menu-item user-info-item">
                <el-avatar :size="28" :src="avatarCom" icon="el-icon-user-solid" class="menu-avatar"></el-avatar>
                <span v-if="roleLabelCom" :class="['user-role-badge', roleBadgeClassCom]">{{ roleLabelCom }}</span>
                <span class="text-overflow">{{ nicknameCom }}</span>
                <i class="el-icon-arrow-down el-icon--right"></i>
              </div>
              <el-dropdown-menu slot="dropdown">
                <el-dropdown-item command="updateUserInfo"><i class="el-icon-user"></i>{{ $t('vk.user.updateUserInfo') }}</el-dropdown-item>
                <el-dropdown-item command="updatePassword"><i class="el-icon-lock"></i>{{ $t('vk.user.updatePassword') }}</el-dropdown-item>
                <el-dropdown-item command="logout"><i class="el-icon-switch-button"></i>{{ $t('vk.user.logout') }}</el-dropdown-item>
              </el-dropdown-menu>
            </el-dropdown>
            <div v-else class="menu-item user-info-item" @click="navigateToLogin">
              <vk-data-icon name="el-icon-user" :color="textColorCom" :size="16" style="margin-right: 4px"></vk-data-icon>
              <span>{{ $t('vk.user.login') }}</span>
            </div>
          </div>
        </div>
      </div>
      <!-- 右下 -->
      <div class="right-bottom" v-show="showMenuTabs">
        <!-- tabs标签组 -->
        <vk-data-menu-tabs v-if="appInitedCom" ref="menuTabs"></vk-data-menu-tabs>
      </div>
    </div>
    <!-- 弹窗 - 错误日志 -->
    <errorLog v-model="formDatas.errorLog"></errorLog>
    <!-- 弹窗 - 修改密码 -->
    <updatePassword v-model="formDatas.updatePassword"></updatePassword>
    <!-- 弹窗 - 修改个人信息 -->
    <updateUserInfo v-model="formDatas.updateUserInfo"></updateUserInfo>
  </div>
</template>

<script>
  import config from '@/app.config.js';
  import breadcrumb from './components/breadcrumb';
  import errorLog from './components/errorLog';
  import updatePassword from './components/updatePassword';
  import updateUserInfo from './components/updateUserInfo';
  import MessageCenter from '@/components/MessageCenter/MessageCenter.vue';
  export default {
    components: {
      breadcrumb,
      errorLog,
      updatePassword,
      updateUserInfo,
      MessageCenter,
    },
    props: {
      navigationBarTitleText: {
        type: String,
      },
      matchLeftWindow: {
        type: Boolean,
      },
      showLeftWindow: {
        type: Boolean,
      },
    },
    data() {
      return {
        debug: config.debug,
        // 主题配置
        theme: config.theme,
        // 右侧链接，只在开发模式时显示
        links: [
          {
            text: 'Admin框架文档',
            url: 'https://vkdoc.fsq.pub/admin/',
          },
          {
            text: '浏览更多VK插件',
            url: 'https://ext.dcloud.net.cn/search?q=vk',
          },
        ],
        mode: config.topBar.logoMode,
        showMenuTabs: true,
        formDatas: {},
        // 统一消息入口，后续由消息服务填充具体消息。
        messageMessages: [],
        // 最近一次服务端未读数，用于判断是否需要刷新全量列表。
        lastUnreadCount: -1,
      };
    },
    // 组件挂载完毕时
    mounted() {
      this.vk.menuTabs = this.$refs.menuTabs;
      this.checkMenuCollapse();
      this.checkMenuTabs();
      if (this.appInitedCom) this.loadMessages();
      uni.$on('notifications-changed', this.loadMessages);
      // 近实时消息：10 秒轻量轮询未读数 + 页面切回前台/获得焦点时立即刷新。
      this.messageTimer = setInterval(() => this.pollUnreadCount(), 10000);
      // #ifdef H5
      this.onVisibilityChange = () => { if (document.visibilityState === 'visible') this.loadMessages(); };
      this.onWindowFocus = () => this.loadMessages();
      document.addEventListener('visibilitychange', this.onVisibilityChange);
      window.addEventListener('focus', this.onWindowFocus);
      // #endif
    },
    beforeDestroy() {
      if (this.messageTimer) clearInterval(this.messageTimer);
      uni.$off('notifications-changed', this.loadMessages);
      // #ifdef H5
      if (this.onVisibilityChange) document.removeEventListener('visibilitychange', this.onVisibilityChange);
      if (this.onWindowFocus) window.removeEventListener('focus', this.onWindowFocus);
      // #endif
    },
    methods: {
      // 跳转登录页
      navigateToLogin() {
        this.vk.navigateToLogin();
      },
      // 退出登录
      logout() {
        let { vk } = this;
        vk.userCenter.logout({
          success: (data) => {
            if (typeof this.$refs.menuTabs.clear === 'function') this.$refs.menuTabs.clear();
            uni.reLaunch({
              url: config.login.url,
            });
          },
        });
      },
      // 左侧菜单显示和隐藏
      toggleSidebar() {
        if (!this.showLeftWindow) {
          uni.showLeftWindow();
        } else {
          uni.hideLeftWindow();
        }
      },
      // 用户下拉菜单命令处理
      handleUserMenuCommand(command) {
        if (command === 'updateUserInfo') {
          this.openForm('updateUserInfo');
        } else if (command === 'updatePassword') {
          this.openForm('updatePassword');
        } else if (command === 'logout') {
          this.logout();
        }
      },
      // 打开表单
      openForm(name) {
        this.formDatas[name] = {
          show: true,
        };
      },
      // 拉取当前登录用户的消息，数据权限由云函数控制。
      loadMessages() {
        if (!this.isLoginCom) return;
        this.vk.callFunction({
          url: 'business/notifications.getList',
          data: { page_size: 50 },
          success: (result) => {
            this.messageMessages = Array.isArray(result && result.rows) ? result.rows : [];
          },
        });
      },
      // 轻量轮询：只查未读数，与本地不同时才刷新全量列表（10 秒一次，开销极小）。
      pollUnreadCount() {
        if (!this.isLoginCom) return;
        this.vk.callFunction({
          url: 'business/notifications.getUnreadCount',
          data: {},
          success: (result) => {
            if (!result || result.code !== 0) return;
            const unreadCount = Number(result.unread_count) || 0;
            if (unreadCount !== this.lastUnreadCount) {
              this.lastUnreadCount = unreadCount;
              this.loadMessages();
            }
          },
        });
      },
      handleMessageClick(message) {
        const messageId = message && (message._id || message.id);
        if (messageId) {
          // 先更新本地列表，让顶部铃铛立即消除角标，再同步后端。
          this.messageMessages = this.messageMessages.map((item) => ((item._id || item.id) === messageId ? { ...item, read: true } : item));
        }
        if (messageId) {
          this.vk.callFunction({
            url: 'business/notifications.markRead',
            data: { notification_id: messageId },
          });
        }
        let route = (message && message.route) || '';
        if (message && message.customer_id && route.indexOf('/pages/custom/records') === 0 && route.indexOf('customer_id=') === -1) {
          route += `${route.indexOf('?') === -1 ? '?' : '&'}customer_id=${encodeURIComponent(message.customer_id)}`;
        }
        if (!route && message && message.customer_id) route = `/pages/custom/records?customer_id=${encodeURIComponent(message.customer_id)}`;
        if (route) this.vk.navigateTo(route);
      },
      markAllMessagesRead() {
        this.vk.callFunction({
          url: 'business/notifications.markAllRead',
          data: {},
          success: () => this.loadMessages(),
        });
      },
      // pc状态下菜单折叠
      menuCollapse() {
        let { vk } = this;
        let leftCollapse = vk.getVuex('$app.leftCollapse');
        vk.setVuex('$app.leftCollapse', !leftCollapse);
      },
      checkMenuCollapse() {
        let { vk } = this;
        let leftCollapse = vk.getVuex('$app.leftCollapse');
        if (!leftCollapse) {
          // 打开
          uni.setLeftWindowStyle({
            width: this.leftWidthCom,
          });
        } else {
          // 折叠
          uni.setLeftWindowStyle({
            width: '64px',
          });
        }
      },
      checkMenuTabs() {
        if (config.topBar.showMenuTabs === false) {
          this.showMenuTabs = false;
          uni.setTopWindowStyle({
            height: '60px',
          });
        }
      },
      // 获取当前账号身份标签，兼容 role/roles/role_id/roleIds 的不同数据结构。
      getUserRoleLabel(userInfo = {}) {
        const roleLabelMap = {
          admin: '管理员',
          super_admin: '管理员',
          administrator: '管理员',
          operator: '运营管理员',
          consultant: '咨询师',
          counselor: '咨询师',
          zixunshi: '咨询师',
          sales: '咨询师',
          live_teacher: '直播老师',
          zhibo: '直播老师',
          traffic_teacher: '投流老师',
          touliu: '投流老师',
        };
        const roleValue = userInfo.role || userInfo.roles || userInfo.role_id || userInfo.roleIds || [];
        const roles = Array.isArray(roleValue) ? roleValue : [roleValue];
        const roleLabels = roles.flatMap((role) => {
          if (!role) return [];
          if (typeof role === 'string') return [roleLabelMap[role] || role];
          return [
            role.role_name,
            role.name,
            roleLabelMap[role.role_id],
            roleLabelMap[role.value],
            role.role_id,
            role.value,
          ].filter(Boolean);
        }).filter(Boolean);
        const normalizedLabels = roleLabels.map((label) => {
          const text = String(label);
          if (text.includes('运营')) return '运营管理员';
          if (text.includes('管理员')) return '管理员';
          if (text.includes('直播')) return '直播老师';
          if (text.includes('投流')) return '投流老师';
          if (text.includes('咨询')) return '咨询师';
          return text;
        });
        return Array.from(new Set(normalizedLabels))[0] || '';
      },
    },
    // 监听属性
    watch: {
      appInitedCom(value) {
        if (value) this.loadMessages();
      },
      leftCollapseCom() {
        this.checkMenuCollapse();
      },
    },
    // 计算属性
    computed: {
      leftCollapseCom() {
        return this.vk.getVuex('$app.leftCollapse');
      },
      appInitedCom() {
        return this.vk.getVuex('$app.inited');
      },
      logo1Com() {
        return this.vk.getVuex('$app.config.staticUrl.navBar.logo1');
      },
      logo2Com() {
        return this.vk.getVuex('$app.config.staticUrl.navBar.logo2');
      },
      titleCom() {
        return this.vk.getVuex('$app.config.topBar.logoTitle');
      },
      logoCom() {
        return this.vk.getVuex('$app.config.staticUrl.navBar.logo');
      },
      nicknameCom() {
        const userInfo = this.vk.getVuex('$user.userInfo') || {};
        return userInfo.nickname || userInfo.username || '';
      },
      roleLabelCom() {
        const userInfo = this.vk.getVuex('$user.userInfo') || {};
        return this.getUserRoleLabel(userInfo);
      },
      roleBadgeClassCom() {
        const classMap = {
          管理员: 'user-role-badge--admin',
          运营管理员: 'user-role-badge--operator',
          咨询师: 'user-role-badge--consultant',
          直播老师: 'user-role-badge--live',
          投流老师: 'user-role-badge--traffic',
        };
        return classMap[this.roleLabelCom] || 'user-role-badge--default';
      },
      isLoginCom() {
        const userInfo = this.vk.getVuex('$user.userInfo');
        return userInfo && userInfo._id;
      },
      avatarCom() {
        const userInfo = this.vk.getVuex('$user.userInfo') || {};
        return userInfo.avatar || '';
      },
      errorLogsCom() {
        return this.vk.getVuex('$error.logs');
      },
      appWidthCom() {
        return this.vk.getVuex('$app.width');
      },
      topMenuStyleCom() {
        let theme = this.theme;
        if (theme && theme.use) {
          let topMenu = theme[theme.use].topMenu;
          let { backgroundColor, textColor } = topMenu;
          return {
            backgroundColor,
            color: textColor,
          };
        } else {
          return {};
        }
      },
      textColorCom() {
        let theme = this.theme;
        if (theme && theme.use) {
          return theme[theme.use].topMenu.textColor || '#999';
        } else {
          return '#999';
        }
      },
      leftWidthCom() {
        let theme = this.theme;
        if (theme && theme.use) {
          return theme[theme.use].leftMenu.width || '240px';
        } else {
          return '240px';
        }
      },
    },
  };
</script>

<style lang="scss">
  .header {
    height: 100px;
    width: 100%;
    box-sizing: border-box;
    display: flex;
    border-bottom: 1px solid darken($top-window-bg-color, 3%);
    color: $top-window-text-color;
    background-color: #f5f5f5;

    &.hide-menu-tabs {
      height: 60px;
    }

    /* 左侧 */
    .left {
      width: calc(var(--window-left));
    }

    /* 右侧 */
    .right {
      width: calc(100% - var(--window-left));

      .navbar {
        font-size: 13px;
        position: relative;
        height: 100%;
        padding: 0 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .menu-icon {
        width: 30px;
        height: 30px;
        line-height: 30px;
      }

      .menu-collapse {
        width: 30px;
        height: 30px;
        line-height: 30px;
      }

      .navbar-left,
      .navbar-middle,
      .navbar-right {
        flex: 1;
      }

      .navbar-middle,
      .username {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .navbar-middle {
        text-align: center;
      }

      .username {
        max-width: 150px;
      }

      .text-overflow {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .text-overflow {
        max-width: 150px;
      }

      .title-text {
        font-size: 13px;
        line-height: 30px;
      }

      .navbar-menu {
        display: flex;
      }

      .menu-item {
        padding: 5px;
        display: flex;
        align-items: center;
      }

      .user-info-item {
        cursor: pointer;
      }

      .menu-avatar {
        margin-right: 6px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .user-role-badge {
        flex-shrink: 0;
        margin-right: 6px;
        padding: 2px 6px;
        border-radius: 999px;
        border: 1px solid #b7d4ff;
        background: #eef6ff;
        color: #2f7ce8;
        font-size: 12px;
        line-height: 16px;
        font-weight: 500;
      }

      .user-role-badge--admin {
        border-color: #f2c36b;
        background: #fff7e6;
        color: #ad6800;
      }

      .user-role-badge--operator {
        border-color: #5cdbd3;
        background: #e6fffb;
        color: #08979c;
      }

      .user-role-badge--consultant {
        border-color: #91caff;
        background: #e6f4ff;
        color: #0958d9;
      }

      .user-role-badge--live {
        border-color: #b7eb8f;
        background: #f6ffed;
        color: #389e0d;
      }

      .user-role-badge--traffic {
        border-color: #d3adf7;
        background: #f9f0ff;
        color: #722ed1;
      }

      .user-role-badge--default {
        border-color: #d9d9d9;
        background: #f5f5f5;
        color: #595959;
      }

      /* 移动端顶栏：隐藏昵称，避免头像+角色+昵称+箭头总宽超出右侧空间 */
      @media screen and (max-width: 768px) {
        .user-info-item {
          padding: 5px 2px;
        }
        .user-info-item .text-overflow {
          display: none !important;
        }
        .menu-avatar {
          margin-right: 4px;
        }
        .user-role-badge {
          margin-right: 4px;
          padding: 1px 6px;
        }
      }

      .debug {
        display: inline-block;
        position: relative;
      }

      .debug-badge {
        position: absolute;
        top: 5px;
        right: 13px;
        transform: translateY(-50%) translateX(100%) scale(0.8);
      }

      .arrowdown {
        margin-top: 4px;
        margin-left: 3px;
      }

      .navbar-right {
        display: flex;
        justify-content: flex-end;
      }

      /* 大屏时，隐藏的内容 */
      .menu-icon,
      .navbar-middle,
      .navbar-user {
        display: none;
      }

      /* 小屏，显示的内容 */
      .navbar-mini .menu-icon,
      .navbar-mini .navbar-middle {
        display: block;
      }

      .navbar-mini .navbar-user {
        display: flex;
        align-items: center;
      }

      .navbar-mini .user-info {
        display: flex;
        align-items: center;
      }

      .user-avatar {
        margin-right: 8px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .login-btn {
        cursor: pointer;
        display: flex;
        align-items: center;
        padding: 0 10px;
      }

      /* 小屏时，隐藏的内容 */
      .navbar-mini .menu-collapse,
      .navbar-mini .logo,
      .navbar-mini .debug,
      .navbar-mini .navbar-menu,
      .navbar-mini .navbar-menu .username,
      .navbar-mini .breadcrumb-view,
      .navbar-mini .mini-none {
        display: none;
      }
    }

    /* 右上 */
    .right-top {
      height: 50px;
    }

    /* 右下 */
    .right-bottom {
      padding: 0px 12px;
      height: 50px;
      background-color: #f5f5f5;
    }

    ::v-deep .navbar .top-bar .item-content {
      color: var(--textColor);
    }

    /* logo模式一开始 纯图片 */
    .logo-mode-1 {
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #191a23;
      height: 50px;
      padding: 0 14px;
      overflow: hidden;

      .logo-image {
        max-height: 40px;
        max-width: 100%;
        display: block;
      }
    }

    /* logo模式一结束 */

    /* logo模式二开始 logo+文字 */
    .logo-mode-2 {
      .logo-box {
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #191a23;
        height: 50px;

        .logo-image {
          width: 38px;
          height: 38px;
          margin-left: 10px;
          margin-right: 10px;
          border-radius: 50%;
        }

        .app-name {
          width: 100%;
          text-align: left;
          flex: 1;
          line-height: 50px;
          font-size: 20px;
          background-image: -webkit-linear-gradient(left, #147b96, #e6d205 25%, #147b96 50%, #e6d205 75%, #147b96);
          -webkit-text-fill-color: transparent;
          -webkit-background-clip: text;
          -webkit-background-size: 200% 100%;
          -webkit-animation: masked-animation 4s infinite linear;
          display: inline-block;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        @-webkit-keyframes masked-animation {
          0% {
            background-position: 0 0;
          }

          100% {
            background-position: -100% 0;
          }
        }
      }
    }

    /* logo模式二结束 */
  }
</style>
