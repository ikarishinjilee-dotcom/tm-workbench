<template>
  <view class="page-body consultant-dashboard">
    <view class="dashboard-layout">
      <view class="dashboard-main">
        <view class="dashboard-hero">
          <view>
            <view class="dashboard-title">您好，{{ userName }}老师</view>
            <view class="dashboard-date">{{ dashboardDateText }}</view>
            <view class="dashboard-subtitle">{{ dashboardSubtitle }}</view>
          </view>
          <view class="hero-actions">
            <el-button type="primary" size="small" icon="el-icon-plus" @click="openAddCustomer">{{ primaryActionText }}</el-button>
            <el-button size="small" icon="el-icon-refresh" @click="refreshAll">刷新数据</el-button>
          </view>
        </view>

        <view class="metric-grid">
          <view v-for="item in metricCards" :key="item.key" class="dashboard-card metric-card" :class="item.tone">
            <view class="metric-top"><view class="metric-icon"><i :class="item.icon"></i></view><view class="metric-label">{{ item.label }}</view></view>
            <view class="metric-value">{{ item.value }}</view>
            <view class="metric-caption">{{ item.caption }}</view>
          </view>
        </view>

        <template v-if="isLiveTeacherDashboard">
          <view class="dashboard-card section-card live-flow-card">
            <view class="section-heading"><view><view class="section-title"><i class="el-icon-connection"></i>今日客户流转</view><view class="section-note">直播/投流新增时必须同步分发咨询师，后续按客户状态推进统计</view></view></view>
            <view class="live-flow">
              <view v-for="(step, index) in liveDashboard.flow" :key="step.key" class="live-flow-step" :class="`live-flow-${step.key}`">
                <view class="live-flow-value">{{ step.value }}</view>
                <view class="live-flow-label">{{ step.label }}</view>
                <i v-if="index < liveDashboard.flow.length - 1" class="el-icon-arrow-right live-flow-arrow"></i>
              </view>
            </view>
          </view>

          <view class="content-grid">
            <view class="dashboard-card section-card live-table-card">
              <view class="section-heading"><view><view class="section-title"><i class="el-icon-user-solid"></i>咨询师分配效果</view><view class="section-note">状态推进=客户状态已不是“初步沟通”</view></view></view>
              <view class="live-consultant-table">
                <view class="live-table-row live-table-head"><text>咨询师</text><text>今日接收</text><text>状态推进</text><text>成交</text><text>推进率</text></view>
                <view v-for="item in liveDashboard.consultant_stats" :key="item.consultant_id || item.consultant_name" class="live-table-row">
                  <text class="live-table-name">{{ item.consultant_name }}</text><text>{{ item.received }}</text><text>{{ item.followed }}</text><text>{{ item.converted }}</text><text>{{ item.followup_rate }}%</text>
                </view>
                <view v-if="!liveDashboard.consultant_stats.length" class="empty-state"><i class="el-icon-user"></i>今日暂无新增客户</view>
              </view>
            </view>

            <view class="dashboard-card section-card live-source-card">
              <view class="section-heading"><view><view class="section-title"><i class="el-icon-pie-chart"></i>客户来源分析</view><view class="section-note">按今日新增客户的来源统计数量，同时看该来源当天成交和转化率</view></view></view>
              <view class="live-source-list">
                <view v-for="item in liveDashboard.source_stats" :key="item.source" class="live-source-row">
                  <view><view class="live-source-name">{{ formatSourceLabel(item.source) }}</view><view class="live-source-meta">成交 {{ item.converted }} 个 · 转化率 {{ item.conversion_rate }}%</view></view>
                  <view class="live-source-count">{{ item.count }}</view>
                </view>
                <view v-if="!liveDashboard.source_stats.length" class="empty-state"><i class="el-icon-pie-chart"></i>今日暂无来源数据</view>
              </view>
            </view>
          </view>

          <view class="content-grid bottom-grid">
            <view class="dashboard-card section-card live-quality-card">
              <view class="section-heading"><view><view class="section-title"><i class="el-icon-medal"></i>客户质量分析</view><view class="section-note">按当前状态归类：高意向=已签单/已邀约/能转化；普通=初步/难转化；低意向=不考虑；无效=已退单</view></view></view>
              <view class="live-quality-grid">
                <view v-for="item in liveDashboard.quality_stats" :key="item.key" class="live-quality-item" :class="`live-quality-${item.key}`"><view class="live-quality-value">{{ item.value }}</view><view class="live-quality-label">{{ item.label }}</view></view>
              </view>
              <view class="live-value-summary">
                <view><text>本月新增客户</text><strong>{{ liveDashboard.value_summary.month_new }}</strong></view>
                <view><text>累计成交</text><strong>{{ liveDashboard.value_summary.converted }}</strong></view>
                <view><text>直播贡献成交金额</text><strong>{{ formatAmount(liveDashboard.value_summary.contract_amount) }}</strong></view>
              </view>
            </view>

            <view class="dashboard-card section-card live-recent-card">
              <view class="section-heading"><view><view class="section-title"><i class="el-icon-time"></i>最近添加客户</view><view class="section-note">检查有没有漏分、错分</view></view><el-button type="text" size="small" @click="openCustomers()">全部客户</el-button></view>
              <view v-if="liveDashboard.recent_customers.length" class="live-recent-list">
                <view v-for="customer in liveDashboard.recent_customers" :key="customer._id" class="live-recent-row" @click="openCustomers(customer._id)">
                  <view class="live-recent-main"><view class="live-recent-name">{{ customer.name }}</view><view class="live-recent-meta">{{ formatSourceLabel(customer.source) }} · 分配：<text class="live-recent-consultant">{{ customer.consultant_name || '已随新增同步' }}</text></view></view>
                  <StatusTag :status="customer.status"></StatusTag><i class="el-icon-arrow-right row-arrow"></i>
                </view>
              </view>
              <view v-else class="empty-state"><i class="el-icon-document-add"></i>今日暂无新增客户</view>
            </view>
          </view>
        </template>

        <template v-else>
        <view class="dashboard-card section-card task-card">
          <view class="section-heading">
            <view><view class="section-title"><i class="el-icon-s-promotion"></i>今日待处理</view><view class="section-note">优先处理没有跟进记录或仍处于初步沟通的客户</view></view>
            <view class="section-count">{{ todayTasks.length }} 位</view>
          </view>
          <view v-if="todayTasks.length" class="task-list">
            <view v-for="task in todayTasks" :key="task._id" class="task-row" @click="openCustomers(task._id)">
              <view class="task-status" :class="task.task_type"><i :class="task.task_type === 'first_followup' ? 'el-icon-phone-outline' : 'el-icon-edit-outline'"></i></view>
              <view class="task-main"><view class="task-name">{{ task.name }}</view><view class="task-desc">{{ task.task_label }}<text v-if="task.source"> · {{ formatSourceLabel(task.source) }}</text></view></view>
              <StatusTag :status="task.status"></StatusTag>
              <el-button type="text" size="small" @click.stop="openCustomers(task._id)">查看客户</el-button>
              <i class="el-icon-arrow-right row-arrow"></i>
            </view>
          </view>
          <view v-else class="empty-state"><i class="el-icon-circle-check"></i>暂无需要优先处理的客户</view>
        </view>

        <view class="content-grid">
          <view class="dashboard-card section-card funnel-card">
            <view class="section-heading"><view><view class="section-title"><i class="el-icon-s-operation"></i>客户转化漏斗</view><view class="section-note">按当前客户状态统计</view></view><el-button type="text" size="small" @click="openCustomers()">查看客户</el-button></view>
            <view class="funnel-list">
              <view v-for="(item, index) in funnelRows" :key="item.value" class="funnel-row">
                <view class="funnel-step"><view class="funnel-index">{{ index + 1 }}</view><view class="funnel-label">{{ item.label }}</view></view>
                <view class="funnel-track"><view class="funnel-bar" :class="`funnel-bar--${index}`" :style="{ width: statusWidth(item.count) }"></view></view>
                <view class="funnel-count">{{ item.count }}</view>
              </view>
            </view>
          </view>

          <view class="dashboard-card section-card focus-card">
            <view class="section-heading"><view><view class="section-title"><i class="el-icon-star-on"></i>重点客户</view><view class="section-note">仅展示已标记重点的客户</view></view><el-button type="text" size="small" @click="openCustomers()">全部客户</el-button></view>
            <view v-if="focusCustomers.length" class="focus-list">
              <view v-for="customer in focusCustomers" :key="customer._id" class="focus-row" @click="openCustomers(customer._id)">
                <view class="focus-main"><view class="focus-name"><i v-if="customer.is_starred" class="el-icon-star-on focus-star"></i>{{ customer.name }}</view><view class="focus-meta">{{ formatSourceLabel(customer.source) }} · {{ formatProgressAge(customer) }}</view></view>
                <StatusTag :status="customer.status"></StatusTag><i class="el-icon-arrow-right row-arrow"></i>
              </view>
            </view>
            <view v-else class="empty-state"><i class="el-icon-star-off"></i>暂时没有重点客户</view>
          </view>
        </view>

        <view class="content-grid bottom-grid">
          <view class="dashboard-card section-card reminder-card">
            <view class="section-heading"><view><view class="section-title"><i class="el-icon-alarm-clock"></i>跟进提醒</view><view class="section-note">根据最近跟进记录推算</view></view></view>
            <view class="reminder-grid">
              <view class="reminder-item reminder-item--orange" @click="openDashboardCustomerList('need_followup')"><view class="reminder-icon"><i class="el-icon-chat-dot-round"></i></view><view><view class="reminder-value">{{ reminders.need_followup }}</view><view class="reminder-label">需要建立跟进</view></view></view>
              <view class="reminder-item reminder-item--red" @click="openDashboardCustomerList('stale_7d')"><view class="reminder-icon"><i class="el-icon-warning-outline"></i></view><view><view class="reminder-value">{{ reminders.stale_7d }}</view><view class="reminder-label">超过 7 天未跟进</view></view></view>
              <view class="reminder-item reminder-item--purple" @click="openDashboardCustomerList('stale_15d')"><view class="reminder-icon"><i class="el-icon-time"></i></view><view><view class="reminder-value">{{ reminders.stale_15d }}</view><view class="reminder-label">超过 15 天未跟进</view></view></view>
            </view>
          </view>

          <view class="dashboard-card section-card performance-card">
            <view class="section-heading"><view><view class="section-title"><i class="el-icon-trophy"></i>我的业绩</view><view class="section-note">基于当前客户数据累计统计</view></view></view>
            <view class="performance-grid"><view class="performance-item" @click="openDashboardCustomerList('month_converted')"><view class="performance-value">{{ summary.month_converted }}</view><view class="performance-label">本月编辑为已签单</view></view><view class="performance-item" @click="openDashboardCustomerList('converted')"><view class="performance-value">{{ summary.conversion_rate }}%</view><view class="performance-label">当前转化率</view></view><view class="performance-item" @click="openDashboardCustomerList('contract_amount')"><view class="performance-value">{{ formatAmount(summary.contract_amount) }}</view><view class="performance-label">累计合同金额</view></view></view>
          </view>
        </view>
        </template>
      </view>

      <view class="dashboard-card message-card">
        <view class="message-heading"><view><view class="message-title"><i class="el-icon-bell"></i>{{ messagePanelTitle }}</view><view class="message-subtitle">{{ messagePanelSubtitle }}</view></view><view class="message-unread-count" v-if="unreadCount">{{ unreadCount }}</view></view>
        <view class="message-tabs"><view :class="['message-tab', { active: messageTab === 'customer' }]" @click="messageTab = 'customer'">{{ primaryMessageTabText }}</view><view :class="['message-tab', { active: messageTab === 'all' }]" @click="messageTab = 'all'">全部消息</view></view>
        <view v-if="visibleMessages.length" class="message-list">
          <view v-for="message in visibleMessages" :key="message._id" class="message-item" :class="{ 'is-unread': !message.read }" @click="handleMessageClick(message)">
            <view class="message-dot"></view><view class="message-main">
              <view class="message-item-title">{{ message.title || '消息提醒' }}<text v-if="!message.read" class="message-unread">未读</text></view>
              <view v-if="isFeedbackMessage(message)" class="message-feedback">
                <view class="message-feedback-summary">{{ feedbackMessageParts(message).summary }}</view>
                <view class="message-feedback-tags">
                  <text class="message-feedback-label">状态</text><text class="message-feedback-status">{{ feedbackMessageParts(message).statusLabel }}</text>
                </view>
                <view v-if="feedbackMessageParts(message).content" class="message-feedback-content"><text>内容</text>{{ feedbackMessageParts(message).content }}</view>
              </view>
              <view v-else class="message-content">{{ message.content }}</view>
              <view class="message-time">{{ formatTime(message.create_time) }}</view>
            </view>
          </view>
        </view>
        <view v-else class="message-empty"><i class="el-icon-bell"></i><view>{{ emptyMessageText }}</view></view>
        <view class="message-footer" @click="markAllMessagesRead"><i class="el-icon-check"></i>全部标记为已读</view>
      </view>
    </view>
    <el-dialog :visible.sync="customerListDialog.show" width="600px" append-to-body custom-class="dashboard-customer-dialog">
      <view slot="title" class="dashboard-customer-dialog__header">
        <view>
          <view class="dashboard-customer-dialog__title">{{ customerListDialog.title }}</view>
          <view class="dashboard-customer-dialog__subtitle">点击客户可直接进入详情处理</view>
        </view>
        <view class="dashboard-customer-dialog__count">{{ customerListDialog.rows.length }} 位</view>
      </view>
      <view v-if="customerListDialog.rows.length" class="dashboard-customer-list">
        <view v-for="customer in customerListDialog.rows" :key="customer._id" class="dashboard-customer-row" @click="openCustomers(customer._id)">
          <view class="dashboard-customer-main">
            <view class="dashboard-customer-name">{{ customer.name }}</view>
            <view class="dashboard-customer-meta"><i class="el-icon-s-promotion"></i>{{ formatSourceLabel(customer.source) }}<text> · </text><i class="el-icon-time"></i>{{ formatProgressAge(customer) }}</view>
          </view>
          <view v-if="customerListDialog.showAmount" class="dashboard-customer-amount">{{ formatAmount(customer.contract_amount) }}</view>
          <StatusTag :status="customer.status"></StatusTag>
          <view class="dashboard-customer-action"><i class="el-icon-arrow-right"></i></view>
        </view>
      </view>
      <view v-else class="empty-state"><i class="el-icon-circle-check"></i>暂无对应客户</view>
    </el-dialog>
  </view>
</template>

<script>
  import StatusTag from '@/components/StatusTag.vue';

  // 客户来源在数据库中保存稳定编码，首页统一转换为中文展示。
  const sourceLabelMap = {
    live_teacher_zhou: '直播（周老师）',
    wechat_channels_promotion: '视频号线索',
    douyin_promotion: '抖音线索',
    wechat_channels: '视频号线索',
    douyin: '抖音线索',
    old_customer: '老客户',
    customer_referral: '客户转介绍',
    other: '其他',
  };

  let vk = uni.vk;
  export default {
    components: {
      StatusTag,
    },
    data() {
      return {
        userName: '咨询师',
        messages: [],
        messageTab: 'customer',
        summary: { total: 0, today_new: 0, converted: 0, today_followup: 0, month_converted: 0, contract_amount: 0, conversion_rate: 0 },
        statusDistribution: [],
        todayTasks: [],
        focusCustomers: [],
        reminders: { need_followup: 0, stale_7d: 0, stale_15d: 0 },
        reminderCustomers: { need_followup: [], stale_7d: [], stale_15d: [] },
        performanceCustomers: { month_converted: [], converted: [] },
        customerListDialog: { show: false, title: '', rows: [], showAmount: false },
        liveDashboard: {
          overview: { today_new: 0, today_assigned: 0, effective_consult: 0, invalid_customers: 0, duplicate_customers: 0, converted_feedback: 0 },
          flow: [],
          consultant_stats: [],
          source_stats: [],
          quality_stats: [],
          recent_customers: [],
          value_summary: { month_new: 0, converted: 0, contract_amount: 0 },
        },
      };
    },
    onLoad(options = {}) {
      vk = this.vk;
      this.options = options;
      const userInfo = vk.getVuex('$user.userInfo') || {};
      this.userName = userInfo.nickname || userInfo.username || '咨询师';
      this.refreshAll();
    },
    computed: {
      metricCards() {
        if (this.isLiveTeacherDashboard) {
          return [
            { key: 'today_new', label: '新增客户', value: this.liveDashboard.overview.today_new, caption: '今日线索', icon: 'el-icon-plus', tone: 'metric-cyan' },
            { key: 'today_assigned', label: '今日已分发', value: this.liveDashboard.overview.today_assigned, caption: '已进入咨询师客户池', icon: 'el-icon-s-claim', tone: 'metric-blue' },
            { key: 'effective_consult', label: '有效咨询', value: this.liveDashboard.overview.effective_consult, caption: '排除无效与退单', icon: 'el-icon-success', tone: 'metric-green' },
            { key: 'invalid_customers', label: '无效客户', value: this.liveDashboard.overview.invalid_customers, caption: '不感兴趣或退单', icon: 'el-icon-warning-outline', tone: 'metric-orange' },
            { key: 'duplicate_customers', label: '重复客户', value: this.liveDashboard.overview.duplicate_customers, caption: '待接入去重记录', icon: 'el-icon-document-copy', tone: 'metric-purple' },
            { key: 'converted_feedback', label: '成交反馈', value: this.liveDashboard.overview.converted_feedback, caption: '今日新增里已成交', icon: 'el-icon-money', tone: 'metric-red' },
          ];
        }
        return [
          { key: 'total', label: '我的客户', value: this.summary.total, caption: '当前负责客户', icon: 'el-icon-user', tone: 'metric-blue' },
          { key: 'today_new', label: '今日新增', value: this.summary.today_new, caption: '今天新增客户', icon: 'el-icon-plus', tone: 'metric-cyan' },
          { key: 'need_followup', label: '待跟进', value: this.reminders.need_followup, caption: '需要优先处理', icon: 'el-icon-s-promotion', tone: 'metric-orange' },
          { key: 'today_followup', label: '今日已沟通', value: this.summary.today_followup, caption: '今天已记录沟通', icon: 'el-icon-chat-dot-round', tone: 'metric-purple' },
          { key: 'converted', label: '已签单', value: this.summary.converted, caption: '当前已签单客户', icon: 'el-icon-success', tone: 'metric-green' },
          { key: 'contract_amount', label: '成交金额', value: this.formatAmount(this.summary.contract_amount), caption: '当前已签单客户合同金额', icon: 'el-icon-money', tone: 'metric-red' },
        ];
      },
      funnelRows() {
        const order = ['initial_contact', 'communicating_positive', 'communicating_difficult', 'invited', 'converted', 'refunded', 'not_interested'];
        return order.map((value) => this.statusDistribution.find((item) => item.value === value) || { value, label: value, count: 0 });
      },
      maxStatusCount() {
        return Math.max(...this.funnelRows.map((item) => item.count), 1);
      },
      visibleMessages() {
        if (this.messageTab === 'all') return this.messages;
        const customerMessageTypes = ['customer_distribution', 'customer_redispatch', 'customer_transfer', 'customer_followup_feedback'];
        return this.messages.filter((item) => customerMessageTypes.includes(item.type));
      },
      unreadCount() {
        return this.visibleMessages.filter((item) => !item.read).length;
      },
      userRoles() {
        const userInfo = vk.getVuex('$user.userInfo') || {};
        let roleValue = userInfo.role || userInfo.roles || userInfo.role_id || userInfo.roleIds || [];
        if (typeof roleValue === 'string') {
          try {
            roleValue = JSON.parse(roleValue);
          } catch (error) {
            roleValue = roleValue.split(',').map((item) => item.trim()).filter(Boolean);
          }
        }
        const roles = Array.isArray(roleValue) ? roleValue : [roleValue];
        return roles.flatMap((role) => {
          if (typeof role === 'string') return [role];
          if (!role) return [];
          return [role.role_id, role.value, role.role_name, role.name].filter(Boolean);
        });
      },
      isLiveTeacherDashboard() {
        return this.userRoles.some((role) => {
          const text = String(role);
          return ['live_teacher', 'zhibo', '直播老师'].includes(text) || text.includes('直播');
        });
      },
      dashboardSubtitle() {
        return this.isLiveTeacherDashboard
          ? '关注今天来了多少客户、分给谁、跟进效果和直播获客价值。'
          : '今天先处理最需要推进的客户，把每一次沟通都变成下一步。';
      },
      dashboardDateText() {
        const now = new Date();
        const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        const pad = (value) => String(value).padStart(2, '0');
        return `今天是 ${now.getFullYear()}年${pad(now.getMonth() + 1)}月${pad(now.getDate())}日 ${weekdays[now.getDay()]}`;
      },
      primaryActionText() {
        return this.isLiveTeacherDashboard ? '分发客户' : '新增客户';
      },
      messagePanelTitle() {
        return this.isLiveTeacherDashboard ? '工作提醒' : '消息中心';
      },
      messagePanelSubtitle() {
        return this.isLiveTeacherDashboard ? '客户质量、咨询师接收和成交反馈会在这里提醒你' : '新客户分配会在这里提醒你';
      },
      primaryMessageTabText() {
        return this.isLiveTeacherDashboard ? '客户提醒' : '客户通知';
      },
      emptyMessageText() {
        if (this.messageTab !== 'customer') return '暂无消息';
        return this.isLiveTeacherDashboard ? '暂无工作提醒' : '暂无客户通知';
      },
    },
    methods: {
      refreshAll() {
        this.loadDashboard();
        this.loadMessages();
      },
      loadDashboard() {
        vk.callFunction({ url: 'business/custom2.getDashboard', data: {}, success: (result) => {
          this.summary = { ...this.summary, ...(result.summary || {}) };
          this.statusDistribution = result.status_distribution || [];
          this.todayTasks = result.today_tasks || [];
          this.focusCustomers = result.focus_customers || [];
          this.reminders = { ...this.reminders, ...(result.reminders || {}) };
          this.reminderCustomers = { ...this.reminderCustomers, ...(result.reminder_customers || {}) };
          this.performanceCustomers = { ...this.performanceCustomers, ...(result.performance_customers || {}) };
          this.liveDashboard = {
            ...this.liveDashboard,
            ...(result.live_dashboard || {}),
            overview: { ...this.liveDashboard.overview, ...(result.live_dashboard && result.live_dashboard.overview || {}) },
            value_summary: { ...this.liveDashboard.value_summary, ...(result.live_dashboard && result.live_dashboard.value_summary || {}) },
          };
        } });
      },
      loadMessages() {
        vk.callFunction({ url: 'business/notifications.getList', data: { page_size: 50 }, success: (result) => { this.messages = result.rows || []; } });
      },
      handleMessageClick(message) {
        if (!message.read) {
          vk.callFunction({ url: 'business/notifications.markRead', data: { notification_id: message._id } });
          message.read = true;
        }
        let route = message.route || '';
        // 兼容历史通知没有带参数的情况，仍然根据通知中的客户 ID 精准打开详情。
        if (message.customer_id && route.indexOf('/pages/custom/records') === 0 && route.indexOf('customer_id=') === -1) {
          route += `${route.indexOf('?') === -1 ? '?' : '&'}customer_id=${encodeURIComponent(message.customer_id)}`;
        }
        if (!route && message.customer_id) route = `/pages/custom/records?customer_id=${encodeURIComponent(message.customer_id)}`;
        if (route) vk.navigateTo(route);
      },
      markAllMessagesRead() {
        vk.callFunction({ url: 'business/notifications.markAllRead', data: {}, success: () => this.loadMessages() });
      },
      openDashboardCustomerList(type) {
        const config = {
          need_followup: { title: '需要建立跟进的客户', rows: this.reminderCustomers.need_followup || [] },
          stale_7d: { title: '超过 7 天未跟进的客户', rows: this.reminderCustomers.stale_7d || [] },
          stale_15d: { title: '超过 15 天未跟进的客户', rows: this.reminderCustomers.stale_15d || [] },
          month_converted: { title: '本月编辑为已签单的客户', rows: this.performanceCustomers.month_converted || [], showAmount: true },
          converted: { title: '当前已签单客户', rows: this.performanceCustomers.converted || [], showAmount: true },
          contract_amount: { title: '累计合同金额对应客户', rows: this.performanceCustomers.converted || [], showAmount: true },
        }[type];
        if (!config) return;
        this.customerListDialog = { show: true, title: config.title, rows: config.rows, showAmount: Boolean(config.showAmount) };
      },
      openCustomers(customerId) {
        const validCustomerId = typeof customerId === 'string' || typeof customerId === 'number' ? String(customerId) : '';
        const query = validCustomerId ? `?customer_id=${encodeURIComponent(validCustomerId)}` : '';
        vk.navigateTo(`/pages/custom/records${query}`);
      },
      openAddCustomer() {
        vk.navigateTo('/pages/custom/records?action=add');
      },
      statusWidth(count) {
        return `${Math.max(3, Math.round((count / this.maxStatusCount) * 100))}%`;
      },
      formatAmount(value) {
        const amount = Number(value || 0);
        if (!amount) return '¥0';
        return `¥${amount.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
      },
      formatSourceLabel(value) {
        return sourceLabelMap[value] || value || '未填写来源';
      },
      formatProgressAge(customer = {}) {
        const value = customer.latest_followup_at;
        if (!value && customer.has_progress) return '已推进';
        if (!value) return '尚未推进';
        const days = Math.floor((Date.now() - Number(value)) / (24 * 60 * 60 * 1000));
        return days <= 0 ? '今天推进' : `${days}天前推进`;
      },
      isFeedbackMessage(message = {}) {
        return message.type === 'customer_followup_feedback';
      },
      feedbackMessageParts(message = {}) {
        const rawContent = String(message.content || '');
        const statusLabel = message.feedback_status_label || (rawContent.match(/状态：([^，,]+)/) || [])[1] || (rawContent.includes('已签单') ? '已签单' : '进度更新');
        const contentText = message.feedback_content || (rawContent.match(/内容：([\s\S]+)$/) || [])[1] || '';
        let summary = rawContent
          .replace(/，?状态：[^，,]+/, '')
          .replace(/，?内容：[\s\S]+$/, '');
        if (!summary) summary = `${message.actor_name || '咨询师'}已反馈客户进度`;
        return { summary, statusLabel, content: contentText };
      },
      formatTime(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      },
    },
  };
</script>

<style lang="scss" scoped>
  page { background: #f4f7fb; }
  .page-body { min-height: 100%; padding: 24px; box-sizing: border-box; }
  .dashboard-layout { display: grid; grid-template-columns: minmax(0, 3fr) minmax(285px, 1fr); align-items: flex-start; gap: 20px; }
  .dashboard-main { min-width: 0; }
  .dashboard-hero, .section-heading, .message-heading { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
  .dashboard-title { color: #172b4d; font-size: 25px; font-weight: 700; letter-spacing: -.3px; }
  .dashboard-date { display: inline-flex; align-items: center; margin-top: 8px; padding: 6px 12px; border-radius: 999px; background: #eef5ff; color: #3978dc; font-size: 13px; font-weight: 700; }
  .dashboard-subtitle, .section-note, .message-subtitle { margin-top: 7px; color: #7b8ba6; font-size: 12px; line-height: 18px; }
  .hero-actions { display: flex; gap: 8px; flex: 0 0 auto; }
  .dashboard-hero ::v-deep .el-button--primary { border-color: #4f85ee; background: #4f85ee; }
  .dashboard-hero ::v-deep .el-button:not(.el-button--primary) { border-color: #dce6f3; color: #4676c5; background: #fff; }
  .dashboard-card { padding: 20px; background: #fff; border: 1px solid #e6edf6; border-radius: 12px; box-shadow: 0 6px 20px rgba(35, 65, 105, .045); box-sizing: border-box; }
  .metric-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; margin-top: 22px; }
  .metric-card { position: relative; min-height: 126px; overflow: hidden; padding: 16px; }
  .metric-card::after { position: absolute; right: -30px; bottom: -42px; width: 115px; height: 115px; border-radius: 50%; background: rgba(91, 143, 249, .055); content: ''; }
  .metric-top { display: flex; align-items: center; gap: 8px; position: relative; z-index: 1; }
  .metric-icon { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 8px; font-size: 15px; }
  .metric-blue .metric-icon { color: #4c86ed; background: #edf4ff; }.metric-cyan .metric-icon { color: #1aa6b7; background: #e9fbfd; }.metric-orange .metric-icon { color: #ec9b2d; background: #fff5e6; }.metric-purple .metric-icon { color: #8768d4; background: #f2eeff; }.metric-green .metric-icon { color: #27ae75; background: #eafaf3; }.metric-red .metric-icon { color: #e66b6b; background: #fff0ef; }
  .metric-label { color: #72829b; font-size: 12px; white-space: nowrap; }
  .metric-value { position: relative; z-index: 1; margin-top: 15px; color: #172b4d; font-size: 23px; font-weight: 700; line-height: 1; }
  .metric-caption { position: relative; z-index: 1; margin-top: 10px; overflow: hidden; color: #a1afc2; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
  .section-card { margin-top: 16px; }
  .section-title, .message-title { color: #172b4d; font-size: 15px; font-weight: 700; }
  .section-title i, .message-title i { margin-right: 8px; color: #5b8ff9; font-size: 16px; }.message-title i { color: #f5a623; }
  .section-count { padding: 5px 9px; border-radius: 6px; background: #edf4ff; color: #4c86ed; font-size: 12px; font-weight: 600; white-space: nowrap; }
  .task-list { margin-top: 16px; }.task-row, .focus-row { display: flex; align-items: center; gap: 11px; padding: 13px 0; border-top: 1px solid #edf2f7; cursor: pointer; transition: padding .2s ease, background .2s ease; }.task-row:first-child { border-top: 0; }.task-row:hover, .focus-row:hover { margin: 0 -8px; padding-right: 8px; padding-left: 8px; border-radius: 7px; background: #f8fbff; }.task-status { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 9px; font-size: 15px; }.task-status.first_followup { color: #ec9b2d; background: #fff5e6; }.task-status.status { color: #4c86ed; background: #edf4ff; }.task-main, .focus-main { min-width: 0; flex: 1; }.task-name, .focus-name { color: #30486b; font-size: 13px; font-weight: 600; }.task-desc, .focus-meta { margin-top: 4px; overflow: hidden; color: #8b9ab0; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }.row-arrow { color: #b5c1d2; font-size: 12px; }
  .content-grid { display: grid; grid-template-columns: 1.05fr .95fr; gap: 16px; }.funnel-list, .focus-list { margin-top: 18px; }.funnel-row { display: flex; align-items: center; gap: 9px; margin-top: 13px; }.funnel-row:first-child { margin-top: 0; }.funnel-step { display: flex; align-items: center; gap: 7px; width: 125px; }.funnel-index { display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 6px; background: #f0f5fc; color: #7690b2; font-size: 10px; }.funnel-label { color: #536581; font-size: 11px; white-space: nowrap; }.funnel-track { flex: 1; height: 8px; overflow: hidden; border-radius: 99px; background: #edf2f7; }.funnel-bar { height: 100%; min-width: 3px; border-radius: inherit; background: linear-gradient(90deg, #8bb5fb, #4f85ee); }.funnel-bar--4 { background: linear-gradient(90deg, #5ed0a0, #27ae75); }.funnel-count { width: 25px; color: #405675; font-size: 12px; font-weight: 600; text-align: right; }.focus-row { padding: 11px 0; }.focus-row ::v-deep .el-tag { flex: 0 0 auto; }.focus-star { margin-right: 4px; color: #f5a623; }.focus-meta { white-space: nowrap; }
  .live-flow { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }.live-flow-step { position: relative; padding: 18px 12px; border-radius: 14px; background: linear-gradient(135deg, #f7fbff, #eef6ff); text-align: center; }.live-flow-value { color: #172b4d; font-size: 25px; font-weight: 800; }.live-flow-label { margin-top: 7px; color: #6d7f99; font-size: 12px; }.live-flow-arrow { position: absolute; top: 50%; right: -14px; z-index: 1; color: #8db7f2; transform: translateY(-50%); }.live-consultant-table, .live-source-list, .live-recent-list { margin-top: 18px; }.live-table-row { display: grid; grid-template-columns: minmax(82px, 1.2fr) repeat(4, minmax(42px, .7fr)); align-items: center; gap: 8px; padding: 11px 0; border-bottom: 1px solid #edf2f7; color: #536581; font-size: 12px; }.live-table-head { color: #9aa9bf; font-size: 11px; font-weight: 600; }.live-table-name { overflow: hidden; color: #263b5d; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }.live-source-row, .live-recent-row { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid #edf2f7; cursor: pointer; }.live-source-row { cursor: default; }.live-source-name, .live-recent-name { color: #263b5d; font-size: 13px; font-weight: 700; }.live-source-meta, .live-recent-meta { margin-top: 5px; color: #8b9ab0; font-size: 11px; }.live-source-count { margin-left: auto; color: #2f7ce8; font-size: 20px; font-weight: 800; }.live-quality-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 18px; }.live-quality-item { padding: 13px 10px; border-radius: 12px; text-align: center; }.live-quality-high { background: #f6ffed; }.live-quality-normal { background: #edf4ff; }.live-quality-low { background: #fff8ed; }.live-quality-invalid { background: #fff2f1; }.live-quality-value { color: #263b5d; font-size: 20px; font-weight: 800; }.live-quality-label { margin-top: 5px; color: #7b8ba6; font-size: 11px; }.live-value-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #edf2f7; }.live-value-summary view { min-width: 0; }.live-value-summary text { display: block; color: #8b9ab0; font-size: 11px; }.live-value-summary strong { display: block; margin-top: 6px; color: #172b4d; font-size: 18px; }.live-recent-row:hover { margin: 0 -8px; padding-right: 8px; padding-left: 8px; border-radius: 8px; background: #f8fbff; }.live-recent-main { min-width: 0; flex: 1; }
  .live-flow-new { background: linear-gradient(135deg, #ecfeff, #dff8fb); }.live-flow-assigned { background: linear-gradient(135deg, #eef5ff, #dfeaff); }.live-flow-advanced { background: linear-gradient(135deg, #f5f0ff, #ebe1ff); }.live-flow-converted { background: linear-gradient(135deg, #ecfdf3, #dcfce7); }.live-flow-new .live-flow-value { color: #0891b2; }.live-flow-assigned .live-flow-value { color: #2563eb; }.live-flow-advanced .live-flow-value { color: #7c3aed; }.live-flow-converted .live-flow-value { color: #16a34a; }.live-recent-consultant { color: #2563eb; font-size: 12px; font-weight: 800; }
  .bottom-grid { margin-top: 0; }.reminder-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 18px; }.reminder-item { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 11px 8px; border-radius: 9px; cursor: pointer; transition: transform .2s ease, box-shadow .2s ease; }.reminder-item:hover, .performance-item:hover { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(35, 65, 105, .08); }.reminder-item--orange { background: #fff8ed; }.reminder-item--red { background: #fff2f1; }.reminder-item--purple { background: #f5f1ff; }.reminder-icon { font-size: 17px; }.reminder-item--orange .reminder-icon { color: #ec9b2d; }.reminder-item--red .reminder-icon { color: #e66b6b; }.reminder-item--purple .reminder-icon { color: #8768d4; }.reminder-value { color: #263b5d; font-size: 18px; font-weight: 700; }.reminder-label { margin-top: 3px; color: #8b9ab0; font-size: 10px; white-space: nowrap; }.performance-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 19px; }.performance-item { min-width: 0; padding: 8px; border-radius: 9px; cursor: pointer; transition: transform .2s ease, box-shadow .2s ease; }.performance-value { color: #263b5d; font-size: 20px; font-weight: 700; }.performance-label { margin-top: 5px; color: #8b9ab0; font-size: 10px; line-height: 15px; }
  .message-card { position: sticky; top: 24px; display: flex; flex-direction: column; height: calc(100vh - 148px); min-height: 520px; max-height: 760px; padding: 21px 18px; overflow: hidden; border-top: 3px solid #8bb4f2; }.message-subtitle { margin-top: 5px; }.message-unread-count { display: flex; align-items: center; justify-content: center; width: 23px; height: 23px; border-radius: 50%; background: #fff1f0; color: #f04438; font-size: 11px; font-weight: 700; }.message-tabs { display: flex; gap: 4px; margin-top: 18px; padding: 3px; border-radius: 8px; background: #f3f6fa; }.message-tab { flex: 1; padding: 7px 4px; border-radius: 6px; color: #8493a9; font-size: 11px; text-align: center; cursor: pointer; }.message-tab.active { background: #fff; color: #4f85ee; box-shadow: 0 2px 6px rgba(65, 91, 130, .1); font-weight: 600; }.message-list { flex: 1; min-height: 0; margin-top: 8px; overflow-y: auto; overscroll-behavior: contain; }.message-item { display: flex; align-items: flex-start; gap: 9px; padding: 16px 0; border-bottom: 1px solid #edf2f7; cursor: pointer; }.message-item:last-child { border-bottom: 0; }.message-dot { width: 7px; height: 7px; margin-top: 5px; border-radius: 50%; background: transparent; box-shadow: 0 0 0 3px transparent; flex: 0 0 auto; }.message-item.is-unread .message-dot { background: #f04438; box-shadow: 0 0 0 3px #fff1f0; }.message-main { min-width: 0; flex: 1; }.message-item-title { color: #263b5d; font-size: 12px; font-weight: 700; line-height: 18px; }.message-unread { margin-left: 6px; padding: 2px 4px; border-radius: 4px; background: #fff1f0; color: #f04438; font-size: 10px; font-weight: 400; }.message-content { margin-top: 5px; color: #73839d; font-size: 11px; line-height: 18px; }.message-time { margin-top: 5px; color: #9aa9bf; font-size: 10px; }.message-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 0; color: #a1afc2; font-size: 12px; }.message-empty i { margin-bottom: 8px; color: #c4d0df; font-size: 24px; }.message-footer { flex: 0 0 auto; margin-top: 14px; padding-top: 14px; border-top: 1px solid #edf2f7; color: #7b8ba6; font-size: 11px; text-align: center; cursor: pointer; }.message-footer i { margin-right: 5px; color: #5b8ff9; }
  .message-feedback { margin-top: 6px; color: #73839d; font-size: 11px; line-height: 18px; }.message-feedback-summary { color: #52647d; }.message-feedback-tags { display: flex; align-items: center; gap: 6px; margin-top: 7px; }.message-feedback-label { padding: 2px 5px; border-radius: 5px; background: #edf4ff; color: #4676c5; font-size: 10px; font-weight: 700; }.message-feedback-status { padding: 2px 7px; border-radius: 999px; background: #ecfdf3; color: #16a34a; font-size: 11px; font-weight: 800; }.message-feedback-content { margin-top: 7px; padding: 7px 8px; border-radius: 8px; background: #f8fbff; color: #263b5d; font-size: 11px; font-weight: 600; line-height: 18px; }.message-feedback-content text { margin-right: 6px; padding: 2px 5px; border-radius: 5px; background: #fff7ed; color: #ea580c; font-size: 10px; font-weight: 800; }
  .empty-state { padding: 25px 0; color: #9aa9bf; font-size: 12px; text-align: center; }.empty-state i { display: block; margin-bottom: 7px; color: #bfcbdc; font-size: 23px; }
  .dashboard-customer-dialog ::v-deep .el-dialog { overflow: hidden; border-radius: 16px; box-shadow: 0 24px 70px rgba(23, 43, 77, .18); }.dashboard-customer-dialog ::v-deep .el-dialog__header { padding: 22px 24px 14px; border-bottom: 1px solid #eef3f8; background: linear-gradient(180deg, #f8fbff 0%, #fff 100%); }.dashboard-customer-dialog ::v-deep .el-dialog__body { padding: 14px 20px 20px; }.dashboard-customer-dialog__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding-right: 28px; }.dashboard-customer-dialog__title { color: #172b4d; font-size: 17px; font-weight: 700; line-height: 24px; }.dashboard-customer-dialog__subtitle { margin-top: 5px; color: #8b9ab0; font-size: 12px; }.dashboard-customer-dialog__count { flex: 0 0 auto; padding: 5px 10px; border-radius: 999px; background: #edf4ff; color: #2f7ce8; font-size: 12px; font-weight: 700; }.dashboard-customer-list { max-height: 58vh; padding-right: 4px; overflow-y: auto; }.dashboard-customer-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; padding: 14px 14px; border: 1px solid #edf2f7; border-radius: 12px; background: #fff; cursor: pointer; transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease; }.dashboard-customer-row:first-child { margin-top: 0; }.dashboard-customer-row:hover { transform: translateY(-1px); border-color: #bcd6ff; box-shadow: 0 10px 24px rgba(47, 124, 232, .1); }.dashboard-customer-main { min-width: 0; flex: 1; }.dashboard-customer-name { color: #263b5d; font-size: 14px; font-weight: 700; }.dashboard-customer-meta { display: flex; align-items: center; gap: 4px; margin-top: 6px; overflow: hidden; color: #8b9ab0; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }.dashboard-customer-meta i { color: #9db4d0; font-size: 12px; }.dashboard-customer-action { display: flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 26px; height: 26px; border-radius: 50%; background: #f4f8ff; color: #8cb3ec; transition: background .2s ease, color .2s ease; }.dashboard-customer-row:hover .dashboard-customer-action { background: #2f7ce8; color: #fff; }
  .dashboard-customer-amount { flex: 0 0 auto; min-width: 48px; padding: 6px 11px; border-radius: 999px; background: #fff7e6; color: #ad6800; font-size: 15px; line-height: 18px; font-weight: 800; text-align: center; white-space: nowrap; }
  ::v-deep .dashboard-customer-dialog { overflow: hidden !important; border-radius: 16px !important; box-shadow: 0 24px 70px rgba(23, 43, 77, .18) !important; }
  ::v-deep .dashboard-customer-dialog .el-dialog__header { padding: 22px 24px 14px !important; border-bottom: 1px solid #eef3f8 !important; background: linear-gradient(180deg, #f8fbff 0%, #fff 100%) !important; }
  ::v-deep .dashboard-customer-dialog .el-dialog__body { padding: 14px 20px 20px !important; }
  ::v-deep .dashboard-customer-dialog .el-dialog__headerbtn { top: 23px !important; right: 22px !important; }
  @media screen and (max-width: 1180px) { .metric-grid { grid-template-columns: repeat(3, 1fr); }.dashboard-layout { grid-template-columns: minmax(0, 2.6fr) minmax(260px, 1fr); } }
  @media screen and (max-width: 900px) { .page-body { padding: 16px; }.dashboard-layout { grid-template-columns: 1fr; }.message-card { position: static; height: 420px; min-height: 360px; max-height: none; }.metric-grid { grid-template-columns: repeat(3, 1fr); } }
  @media screen and (max-width: 620px) { .dashboard-title { font-size: 20px; }.dashboard-hero { align-items: flex-start; flex-direction: column; }.hero-actions { width: 100%; }.hero-actions ::v-deep .el-button { flex: 1; }.metric-grid, .content-grid { grid-template-columns: 1fr; }.reminder-grid { grid-template-columns: 1fr; }.performance-grid { gap: 8px; }.funnel-step { width: 113px; }.funnel-label { font-size: 10px; } }
</style>

<style lang="scss">
  .dashboard-customer-dialog {
    overflow: hidden;
    border-radius: 16px;
    box-shadow: 0 24px 70px rgba(23, 43, 77, .18);

    .el-dialog__header {
      padding: 22px 24px 14px;
      border-bottom: 1px solid #eef3f8;
      background: linear-gradient(180deg, #f8fbff 0%, #fff 100%);
    }

    .el-dialog__body {
      padding: 14px 20px 20px;
    }

    .el-dialog__headerbtn {
      top: 23px;
      right: 22px;
    }
  }
</style>
