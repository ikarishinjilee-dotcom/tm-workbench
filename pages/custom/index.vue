<template>
  <view class="page-body">
    <vk-data-page-header title="客户信息管理" sub-title="记录客户进度和咨询信息" />

    <view class="page-card">
      <view class="page-card-title">客户管理</view>
      <view class="page-card-content">
        客户管理页面入口已创建，下一步将接入客户列表、客户资料和进度记录。
      </view>
    </view>
  </view>
</template>

<script>
  export default {
    onLoad() {},
  };
</script>

<style lang="scss" scoped>
  .page-body {
    min-height: 100%;
    padding: 20px;
    box-sizing: border-box;
  }

  .page-card {
    margin-top: 16px;
    padding: 20px;
    background: #fff;
    border-radius: 4px;
  }

  .page-card-title {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
  }

  .page-card-content {
    margin-top: 16px;
    color: #606266;
  }
</style>
