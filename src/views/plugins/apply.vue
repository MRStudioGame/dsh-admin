<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '@/api'
import { useAuthStore } from '@/store/auth'
import type { ApplyAttachment, PluginApply, VirusStatus } from '@/types'

const auth = useAuthStore()
const loading = ref(false)
const list = ref<PluginApply[]>([])

const query = reactive({ keyword: '', type: '', virus: '' })

const typeOptions = [
  { label: '复刻电脑版插件', value: 'replicate' },
  { label: '开发者创建', value: 'developer' },
  { label: '想法分享', value: 'idea' },
]
const virusOptions = [
  { label: '未扫描', value: 'unknown' },
  { label: '安全', value: 'clean' },
  { label: '检出病毒', value: 'infected' },
]

const filtered = computed(() =>
  list.value.filter((a) => {
    const kw = query.keyword.trim().toLowerCase()
    const hitKw =
      !kw ||
      a.applicantId.toLowerCase().includes(kw) ||
      a.pluginName.toLowerCase().includes(kw) ||
      a.pcPluginName.toLowerCase().includes(kw) ||
      a.description.toLowerCase().includes(kw)
    return hitKw && (!query.type || a.type === query.type) && (!query.virus || a.virus === query.virus)
  }),
)

const stats = computed(() => ({
  total: list.value.length,
  pending: list.value.filter((a) => a.status === 'pending').length,
  infected: list.value.filter((a) => a.virus === 'infected').length,
  approved: list.value.filter((a) => a.status === 'approved').length,
}))

async function load() {
  loading.value = true
  try {
    list.value = await api.pluginApplies()
  } finally {
    loading.value = false
  }
}

function guard(): boolean {
  if (auth.canPerm('plugin:apply')) return true
  ElMessage.warning('当前角色没有插件申请管理权限')
  return false
}

function fmtSize(n: number) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${n} B`
}

function typeTag(t: string) {
  return t === 'replicate' ? 'info' : t === 'developer' ? 'warning' : 'success'
}
function statusTag(s: string): 'info' | 'warning' | 'success' | 'danger' {
  return s === 'approved' ? 'success' : s === 'reviewing' ? 'warning' : s === 'rejected' ? 'danger' : 'info'
}
function virusTag(v: VirusStatus): 'info' | 'success' | 'danger' {
  return v === 'infected' ? 'danger' : v === 'clean' ? 'success' : 'info'
}

// ── 病毒扫描：命中即拒绝并删除申请记录 ──
async function onScan(row: PluginApply) {
  if (!guard()) return
  const r = await api.scanApply(row.id)
  if (r.removed) {
    ElMessage.warning(`「${row.pluginName || row.pcPluginName || row.id}」检出病毒，已拒绝并删除申请记录`)
  } else {
    ElMessage.success('扫描完成：未检出风险')
  }
  await load()
}

// ── 回复：富文本（此处用多行文本模拟） + 推送通知 ──
const replyVisible = ref(false)
const replyId = ref('')
const replyText = ref('')
function openReply(row: PluginApply) {
  if (!guard()) return
  replyId.value = row.id
  replyText.value = row.reply || ''
  replyVisible.value = true
}
async function submitReply() {
  if (!replyText.value.trim()) {
    ElMessage.warning('请填写回复内容')
    return
  }
  await api.replyApply(replyId.value, replyText.value.trim())
  ElMessage.success('已推送回复至 App 端（Push Notification）')
  replyVisible.value = false
  await load()
}

// ── 删除：二次确认 + 软/硬删除 ──
async function onDelete(row: PluginApply) {
  if (!guard()) return
  const name = row.pluginName || row.pcPluginName || row.id
  try {
    await ElMessageBox.confirm(`确认删除「${name}」的申请？此操作不可撤销，请谨慎。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '继续',
    })
  } catch {
    return
  }
  try {
    await ElMessageBox.confirm(
      '删除方式：点「硬删除」将永久移除记录；点「软删除」仅标记已拒绝并保留记录。',
      '选择删除方式',
      { type: 'warning', confirmButtonText: '硬删除', cancelButtonText: '软删除' },
    )
    await api.deleteApply(row.id, true)
    ElMessage.success('已硬删除')
  } catch (e) {
    if (e === 'cancel') {
      await api.deleteApply(row.id, false)
      ElMessage.success('已软删除（记录保留，标记为已拒绝）')
    } else {
      return
    }
  }
  await load()
}

// ── 图片站内预览 ──
const previewVisible = ref(false)
const previewUrl = ref('')
function openPreview(url: string) {
  previewUrl.value = url
  previewVisible.value = true
}

function download(name: string, url?: string) {
  if (!url) {
    ElMessage.info('该附件为离线 Mock，无可用下载链接')
    return
  }
  window.open(url, '_blank')
}

onMounted(load)
</script>

<template>
  <div class="page" v-loading="loading">
    <div class="page-head">
      <div>
        <h2>插件申请管理</h2>
        <p>全量用户插件收录申请：复刻 / 开发者 / 想法三类；支持病毒扫描、回复推送与软硬删除。</p>
      </div>
    </div>

    <div class="kpi-row">
      <div class="kpi"><span>申请总数</span><b>{{ stats.total }}</b></div>
      <div class="kpi"><span>待审核</span><b>{{ stats.pending }}</b></div>
      <div class="kpi"><span>已通过</span><b>{{ stats.approved }}</b></div>
      <div class="kpi"><span>病毒命中</span><b class="danger">{{ stats.infected }}</b></div>
    </div>

    <el-card shadow="never" class="card">
      <div class="toolbar">
        <el-input v-model="query.keyword" placeholder="搜索申请人 / 插件名 / 描述" clearable style="width: 260px" />
        <el-select v-model="query.type" placeholder="全部类型" clearable style="width: 160px">
          <el-option v-for="t in typeOptions" :key="t.value" :label="t.label" :value="t.value" />
        </el-select>
        <el-select v-model="query.virus" placeholder="病毒状态" clearable style="width: 140px">
          <el-option v-for="v in virusOptions" :key="v.value" :label="v.label" :value="v.value" />
        </el-select>
        <div class="spacer" />
        <el-button size="small" @click="load">刷新</el-button>
      </div>

      <el-table :data="filtered" size="small" stripe>
        <el-table-column prop="applicantId" label="申请人ID" width="110" />
        <el-table-column label="类型" width="120">
          <template #default="{ row }">
            <el-tag :type="typeTag(row.type)" size="small">{{ row.typeName }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="插件命名" min-width="150">
          <template #default="{ row }">
            <b>{{ row.pluginName || row.pcPluginName || '—' }}</b>
            <div v-if="row.pcPluginName" class="sub">PC：{{ row.pcPluginName }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="需求描述" min-width="220" show-overflow-tooltip />
        <el-table-column label="附件" min-width="260">
          <template #default="{ row }">
            <div class="atts">
              <template v-for="(f, i) in row.attachments" :key="i">
                <el-image
                  v-if="f.isImage && f.previewUrl"
                  :src="f.previewUrl"
                  fit="cover"
                  class="thumb"
                  @click="openPreview(f.previewUrl!)"
                />
                <div v-else class="file-chip" @click="download(f.name, f.signedUrl)">
                  <el-icon><Document /></el-icon>
                  <span>{{ f.name }}</span>
                  <em>{{ fmtSize(f.size) }}</em>
                </div>
              </template>
              <span v-if="!row.attachments.length" class="sub">无附件</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="病毒审核" width="150">
          <template #default="{ row }">
            <el-tag :type="virusTag(row.virus)" size="small">{{ row.virusName }}</el-tag>
            <el-button link type="primary" size="small" :disabled="!auth.canPerm('plugin:apply')" @click="onScan(row)">扫描</el-button>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status)" size="small">{{ row.statusName }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="190" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" :disabled="!auth.canPerm('plugin:apply')" @click="openReply(row)">回复</el-button>
            <el-button link type="danger" size="small" :disabled="!auth.canPerm('plugin:apply')" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="foot">共 {{ filtered.length }} 条记录</div>
    </el-card>

    <!-- 回复对话框 -->
    <el-dialog v-model="replyVisible" title="回复申请人（将推送至 App 端）" width="520px">
      <el-input
        v-model="replyText"
        type="textarea"
        :rows="5"
        placeholder="支持富文本说明：审核结论、上架计划、补充材料要求等"
      />
      <template #footer>
        <el-button @click="replyVisible = false">取消</el-button>
        <el-button type="primary" @click="submitReply">推送回复</el-button>
      </template>
    </el-dialog>

    <!-- 图片站内预览 -->
    <el-dialog v-model="previewVisible" title="附件预览" width="640px">
      <img :src="previewUrl" style="width: 100%; border-radius: 8px" />
      <div class="foot">图片在网站内直接打开观看，亦可右键 / 通过签名链接下载。</div>
    </el-dialog>
  </div>
</template>

<style scoped>
.page { padding: 4px 2px 24px; }
.page-head h2 { margin: 0 0 6px; font-size: 20px; font-weight: 650; }
.page-head p { margin: 0; color: #8a94a6; font-size: 12.5px; }
.kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
.kpi { background: #fff; border: 1px solid #eceff5; border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; }
.kpi span { color: #8a94a6; font-size: 12px; }
.kpi b { font-size: 22px; font-weight: 650; }
.kpi b.danger { color: #f56c6c; }
.card { border-radius: 12px; }
.toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.spacer { flex: 1; }
.sub { color: #9aa3b2; font-size: 11px; margin-top: 2px; }
.atts { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.thumb { width: 44px; height: 44px; border-radius: 6px; cursor: pointer; border: 1px solid #eceff5; }
.file-chip { display: inline-flex; align-items: center; gap: 4px; max-width: 160px; padding: 3px 8px; background: #f4f6fa; border-radius: 6px; cursor: pointer; font-size: 11px; color: #5b6577; }
.file-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-chip em { color: #9aa3b2; font-style: normal; }
.foot { margin-top: 12px; color: #9aa3b2; font-size: 12px; }
@media (max-width: 900px) { .kpi-row { grid-template-columns: repeat(2, 1fr); } }
</style>
