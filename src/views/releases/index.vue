<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { api, fetchAppRelease, type AppRelease } from '@/api'
import { useAuthStore } from '@/store/auth'
import type { ReleasePayload, ReleaseRecord } from '@/types'

const auth = useAuthStore()
const loading = ref(false)
const publishing = ref(false)
const current = ref<AppRelease | null>(null)
const history = ref<ReleaseRecord[]>([])
const dialog = ref(false)

const form = reactive<ReleasePayload>({
  version: '',
  build: 0,
  channel: 'stable',
  apkUrl: '',
  md5: '',
  sha256: '',
  size: 0,
  force: false,
  notes: '',
  changelog: [],
})
const changelogText = ref('')

const md5Valid = computed(() => /^[a-fA-F0-9]{32}$/.test(form.md5.trim()))
const urlValid = computed(() => /^https?:\/\/.+\.apk(\?.*)?$/i.test(form.apkUrl.trim()))
const canPublish = computed(
  () =>
    auth.canPerm('release:publish') &&
    /^\d+\.\d+\.\d+$/.test(form.version.trim()) &&
    form.build > 0 &&
    md5Valid.value &&
    urlValid.value &&
    form.size > 0,
)

function fmtSize(n: number) {
  return `${(n / 1048576).toFixed(1)} MB`
}

async function load() {
  loading.value = true
  try {
    const [manifest, records] = await Promise.all([
      fetchAppRelease().catch(() => null),
      api.releases(),
    ])
    current.value = manifest
    history.value = records
  } finally {
    loading.value = false
  }
}

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(`已复制${label}`)
  } catch {
    ElMessage.warning('浏览器未授权剪贴板，请手动选择复制')
  }
}

function openPublish() {
  if (!auth.canPerm('release:publish')) {
    ElMessage.warning('当前角色没有发布权限')
    return
  }
  form.version = ''
  form.build = 0
  form.apkUrl = ''
  form.md5 = ''
  form.sha256 = ''
  form.size = 0
  form.force = false
  form.notes = ''
  changelogText.value = ''
  dialog.value = true
}

/** 生成客户端读取的 app-version.json 清单，供发布流程替换 public/api/ 下文件 */
function buildManifest(): Record<string, unknown> {
  return {
    app: 'DeepSeek Harness Move',
    package: 'com.dshmove.app',
    channel: form.channel,
    version: form.version.trim(),
    build: form.build,
    minSdk: 26,
    date: new Date().toISOString().slice(0, 10),
    notes: form.notes.trim(),
    changelog: changelogText.value.split('\n').map((s) => s.trim()).filter(Boolean),
    apkUrl: form.apkUrl.trim(),
    apkFallbackUrls: [],
    md5: form.md5.trim().toLowerCase(),
    sha256: form.sha256.trim().toLowerCase(),
    size: form.size,
    force: form.force,
  }
}

async function publish() {
  if (!canPublish.value) {
    ElMessage.warning('请完整填写版本号、构建号、APK 直链（.apk）、32 位 MD5 与包大小')
    return
  }
  publishing.value = true
  try {
    const payload: ReleasePayload = {
      ...form,
      version: form.version.trim(),
      apkUrl: form.apkUrl.trim(),
      md5: form.md5.trim().toLowerCase(),
      sha256: form.sha256.trim().toLowerCase(),
      notes: form.notes.trim(),
      changelog: changelogText.value.split('\n').map((s) => s.trim()).filter(Boolean),
    }
    await api.publishRelease(payload)
    const manifest = buildManifest()
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'app-version.json'
    a.click()
    URL.revokeObjectURL(url)
    dialog.value = false
    ElMessage.success('发布记录已创建，清单文件已下载；请替换 public/api/app-version.json 后部署生效')
    await load()
  } finally {
    publishing.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page" v-loading="loading">
    <div class="page-head">
      <div>
        <h2>客户端版本发布</h2>
        <p>OTA 直链分发、MD5 / SHA-256 校验与版本清单生成。客户端只读取本清单，不跳转官网。</p>
      </div>
      <el-button type="primary" :disabled="!auth.canPerm('release:publish')" @click="openPublish">
        发布新版本
      </el-button>
    </div>

    <!-- 当前线上清单 -->
    <el-card shadow="never" class="card">
      <template #header>
        <div class="card-head">
          <span>当前线上版本清单</span>
          <el-tag v-if="current" type="success" size="small">v{{ current.version }} ({{ current.build }})</el-tag>
          <el-tag v-else type="danger" size="small">清单不可用</el-tag>
        </div>
      </template>
      <template v-if="current">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="渠道">{{ current.channel }}</el-descriptions-item>
          <el-descriptions-item label="发布日期">{{ current.date }}</el-descriptions-item>
          <el-descriptions-item label="包大小">{{ fmtSize(current.size) }}</el-descriptions-item>
          <el-descriptions-item label="强制更新">{{ current.force ? '是' : '否' }}</el-descriptions-item>
          <el-descriptions-item label="MD5">
            <span class="mono">{{ current.md5 }}</span>
            <el-button link type="primary" size="small" @click="copy(current.md5, 'MD5')">复制</el-button>
          </el-descriptions-item>
          <el-descriptions-item label="SHA-256">
            <span class="mono short">{{ current.sha256 }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="APK 直链" :span="2">
            <span class="mono short">{{ current.apkUrl }}</span>
            <el-button link type="primary" size="small" @click="copy(current.apkUrl, '直链')">复制</el-button>
          </el-descriptions-item>
          <el-descriptions-item label="更新说明" :span="2">{{ current.notes }}</el-descriptions-item>
        </el-descriptions>
      </template>
      <el-empty v-else description="版本清单获取失败，请检查 public/api/app-version.json 是否随部署发布" :image-size="70" />
    </el-card>

    <!-- 发布记录 -->
    <el-card shadow="never" class="card">
      <template #header><span>版本发布记录</span></template>
      <el-table :data="history" size="small" stripe>
        <el-table-column prop="version" label="版本" width="100" />
        <el-table-column prop="build" label="构建号" width="90" />
        <el-table-column prop="channel" label="渠道" width="100" />
        <el-table-column prop="date" label="发布日期" width="120" />
        <el-table-column label="包大小" width="110">
          <template #default="{ row }">{{ fmtSize(row.size) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'released' ? 'success' : 'info'" size="small">{{ row.statusName }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="md5" label="MD5 Checksum" min-width="280" show-overflow-tooltip>
          <template #default="{ row }"><span class="mono">{{ row.md5 }}</span></template>
        </el-table-column>
        <el-table-column prop="notes" label="说明" min-width="240" show-overflow-tooltip />
      </el-table>
    </el-card>

    <!-- 发布弹窗 -->
    <el-dialog v-model="dialog" title="发布新版本" width="640px" :close-on-click-modal="false">
      <el-form label-width="110px" size="default">
        <el-form-item label="版本号">
          <el-input v-model="form.version" placeholder="例如 2.5.0" />
        </el-form-item>
        <el-form-item label="构建号">
          <el-input-number v-model="form.build" :min="1" :max="999999" />
        </el-form-item>
        <el-form-item label="发布渠道">
          <el-select v-model="form.channel" style="width: 100%">
            <el-option label="stable（正式）" value="stable" />
            <el-option label="beta（测试）" value="beta" />
          </el-select>
        </el-form-item>
        <el-form-item label="APK 直链" :error="form.apkUrl && !urlValid ? '必须以 .apk 结尾的文件直链' : ''">
          <el-input v-model="form.apkUrl" placeholder="https://.../xxx.apk" />
        </el-form-item>
        <el-form-item label="MD5" :error="form.md5 && !md5Valid ? '需为 32 位十六进制字符串' : ''">
          <el-input v-model="form.md5" placeholder="32 位 MD5 Checksum" />
        </el-form-item>
        <el-form-item label="SHA-256">
          <el-input v-model="form.sha256" placeholder="可选，64 位十六进制" />
        </el-form-item>
        <el-form-item label="包大小（字节）">
          <el-input-number v-model="form.size" :min="1" :step="1024" style="width: 100%" />
        </el-form-item>
        <el-form-item label="强制更新">
          <el-switch v-model="form.force" />
        </el-form-item>
        <el-form-item label="更新说明">
          <el-input v-model="form.notes" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="更新日志">
          <el-input v-model="changelogText" type="textarea" :rows="4" placeholder="每行一条" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="publishing" :disabled="!canPublish" @click="publish">
          发布并生成清单
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page { padding: 4px 2px 24px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 20px; font-weight: 650; }
.page-head p { margin: 0; color: #8a94a6; font-size: 12.5px; }
.card { margin-bottom: 16px; border-radius: 12px; }
.card-head { display: flex; align-items: center; gap: 10px; font-weight: 600; }
.mono { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px; }
.short { display: inline-block; max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle; }
</style>
