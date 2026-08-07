<template>
  <el-popover v-model="visible" placement="bottom-end" width="280" trigger="click" popper-class="message-center-popper">
    <view class="message-center__panel">
      <view class="message-center__panel-header">
        <text class="message-center__panel-title">消息中心</text>
        <el-button v-if="unreadCount" type="text" size="mini" @click="markAllRead">全部已读</el-button>
      </view>
      <view v-if="localMessages.length" class="message-center__list">
        <view v-for="message in localMessages" :key="message._id || message.id" class="message-center__item" :class="{ 'is-unread': !message.read }" @click="handleMessageClick(message)">
          <view class="message-center__item-dot"></view>
          <view class="message-center__item-body">
            <view class="message-center__item-title">{{ message.title || '消息提醒' }}<text v-if="!message.read" class="message-center__item-status">未读</text></view>
            <view class="message-center__item-content">{{ message.content || '' }}</view>
            <view v-if="message.create_time || message.time" class="message-center__item-time">{{ formatTime(message.create_time || message.time) }}</view>
          </view>
        </view>
      </view>
      <view v-else class="message-center__empty"><i class="el-icon-bell"></i><text>暂无新消息</text></view>
    </view>
    <view slot="reference" class="message-center__trigger" title="消息提醒">
      <el-badge :value="badgeValue" :hidden="unreadCount === 0">
        <vk-data-icon name="el-icon-bell" :size="20" :color="color"></vk-data-icon>
      </el-badge>
    </view>
  </el-popover>
</template>

<script>
  export default {
    name: 'MessageCenter',
    props: {
      // 消息由父级或消息服务传入，组件本身不绑定具体业务场景。
      messages: { type: Array, default: () => [] },
      color: { type: String, default: '#999' },
    },
    data() {
      return { visible: false, localMessages: [] };
    },
    computed: {
      // 直接从 prop 计算未读数（保证与父级数据源实时一致，避免 panel 与 trigger 显示不一致）。
      unreadCount() {
        return (this.messages || []).filter((message) => !message.read).length;
      },
      badgeValue() {
        return this.unreadCount > 99 ? '99+' : this.unreadCount;
      },
    },
    watch: {
      messages: {
        immediate: true,
        deep: true,
        handler(value) {
          this.localMessages = (Array.isArray(value) ? value : []).map((message) => ({ ...message }));
        },
      },
    },
    methods: {
      handleMessageClick(message) {
        const target = this.localMessages.find((item) => (item._id || item.id) === (message._id || message.id));
        if (target) target.read = true;
        this.$emit('message-click', message);
      },
      markAllRead() {
        this.localMessages = this.localMessages.map((message) => ({ ...message, read: true }));
        this.$emit('mark-all-read');
      },
      formatTime(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        const pad = (number) => String(number).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
      },
    },
  };
</script>

<style lang="scss">
  .message-center__trigger { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 5px; cursor: pointer; transition: background-color .2s; }
  .message-center__trigger:hover { background: rgba(64, 158, 255, .08); }
  .message-center__panel { color: #344054; }
  .message-center__panel-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid #edf1f6; }
  .message-center__panel-title { color: #1d2939; font-size: 15px; font-weight: 600; }
  .message-center__list { max-height: 360px; overflow-y: auto; }
  .message-center__item { display: flex; gap: 10px; padding: 13px 2px; border-bottom: 1px solid #f2f4f7; cursor: pointer; }
  .message-center__item:hover { background: #f8fbff; }
  .message-center__item-dot { flex: 0 0 auto; width: 7px; height: 7px; margin-top: 6px; border-radius: 50%; background: transparent; }
  .message-center__item.is-unread .message-center__item-dot { background: #f04438; }
  .message-center__item-body { min-width: 0; flex: 1; }
  .message-center__item-title { color: #344054; font-size: 13px; font-weight: 600; line-height: 20px; }
  .message-center__item-status { margin-left: 6px; padding: 1px 5px; border-radius: 3px; background: #fff1f0; color: #f04438; font-size: 11px; font-weight: 400; }
  .message-center__item-content { margin-top: 3px; overflow: hidden; color: #667085; font-size: 12px; line-height: 19px; text-overflow: ellipsis; white-space: nowrap; }
  .message-center__item-time { margin-top: 4px; color: #98a2b3; font-size: 11px; }
  .message-center__empty { display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 9px; height: 150px; color: #98a2b3; font-size: 13px; }
  .message-center__empty i { color: #cbd5e1; font-size: 28px; }
</style>
