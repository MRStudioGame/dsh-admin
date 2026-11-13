<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '@/api'
import type { SystemConfig } from '@/types'

const loading = ref(false)
const saving = ref(false)

const form = reactive<SystemConfig>({
  rateLimitPerMin: 60,
  dashboardRefreshSec: 5,
  alertThresholdConsecutiveFail: 3,
  alertHighFreqPerMin: 120,
  sessionTimeoutMin: 30,
  allowRemoteLogout: true,
})

async function load() {
  loading.value = true
  try {
    Object.assign(form, await api.getConfig())
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    await api.saveConfig({ ...form })
    ElMessage.success('配置已保存')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="panel-card" v-loading="loading" style="max-width: 640px">
      <div class="panel-title">系统全局配置</div>
      <el-form label-width="180px" label-position="left">
        <el-form-item label="接口限流阈值（次/分）">
          <el-input-number v-model="form.rateLimitPerMin" :min="1" :max="10000" />
        </el-form-item>
        <el-form-item label="看板刷新周期（秒）">
          <el-input-number v-model="form.dashboardRefreshSec" :min="1" :max="300" />
        </el-form-item>
        <el-form-item label="任务连续失败告警阈值（次）">
          <el-input-number v-model="form.alertThresholdConsecutiveFail" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="高频请求告警阈值（次/分）">
          <el-input-number v-model="form.alertHighFreqPerMin" :min="10" :max="10000" />
        </el-form-item>
        <el-form-item label="会话超时（分钟）">
          <el-input-number v-model="form.sessionTimeoutMin" :min="5" :max="1440" />
        </el-form-item>
        <el-form-item label="允许远程强制下线">
          <el-switch v-model="form.allowRemoteLogout" />
        </el-form-item>
        <el-form-item>
          <el-button v-perm="'config:edit'" type="primary" :loading="saving" @click="save">保存配置</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>
