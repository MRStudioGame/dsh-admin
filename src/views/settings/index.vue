<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { api, fetchAppRelease, type AppRelease } from '@/api'
import type { SystemConfig } from '@/types'

const loading = ref(false)
const saving = ref(false)
const release = ref<AppRelease | null>(null)

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

async function loadRelease() {
  try {
    release.value = await fetchAppRelease()
  } catch {
    release.value = null
  }
}

onMounted(() => {
  void load()
  void loadRelease()
})
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

    <div class="panel-card" style="max-width: 640px; margin-top: 16px">
      <div class="panel-title">客户端版本发布（App 内更新接口）</div>
      <div v-if="release" class="release-info">
        <div><span>当前版本</span><b>v{{ release.version }}（{{ release.build }}）</b></div>
        <div><span>发布渠道</span><b>{{ release.channel }} · {{ release.date }}</b></div>
        <div><span>APK 直链</span><b class="release-url">{{ release.apkUrl }}</b></div>
        <div><span>MD5 校验</span><b class="release-url">{{ release.md5 || '待写入' }}</b></div>
        <div><span>包大小</span><b>{{ release.size ? (release.size / 1048576).toFixed(1) + ' MB' : '待写入' }}</b></div>
        <div style="margin-top: 10px">
          <span>更新日志</span>
          <ul class="release-log">
            <li v-for="(line, i) in release.changelog" :key="i">{{ line }}</li>
          </ul>
        </div>
      </div>
      <div v-else style="color: #909399; font-size: 13px">版本清单读取失败，请检查 public/api/app-version.json</div>
    </div>
  </div>
</template>

<style scoped>
.release-info {
  font-size: 13px;
  color: #303133;
}
.release-info > div {
  display: flex;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid #f2f3f5;
}
.release-info span {
  flex: 0 0 92px;
  color: #909399;
}
.release-url {
  word-break: break-all;
  font-weight: 400;
}
.release-log {
  margin: 0;
  padding-left: 18px;
  color: #606266;
  line-height: 1.8;
}
</style>
