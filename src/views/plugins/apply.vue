<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '@/api'
import { useAuthStore } from '@/store/auth'
import type {
  ApplyAttachment,
  ApplyEvent,
  ApplyStatus,
  ApplyType,
  PluginApply,
  VirusStatus,
} from '@/types'

const auth = useAuthStore()
const loading = ref(false)
const list = ref<PluginApply[]>([])
const events = ref<ApplyEvent[]>([])
const dataSource = api.applyDataSource()

const query = reactive({ keyword: '', type: '', virus: '', status: '' })
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
const statusOptions = [
  { label: '待审核', value: 'pending' },
  { label: '审核中', value: 'reviewing' },
  { label: '已通过', value: 'approved' },
  { label: '已拒绝', value: 'rejected' },
]

const filtered = computed(() =>
  list.value.filter((a) => {
    const kw = query.keyword.trim().toLowerCase()
    const hitKw =
      !kw ||
      a.applicantId.toLowerCase().includes(kw) ||
      a.pluginName.toLowerCase().includes(kw) ||
      a.pcPluginName.toLowerCase().includes(kw) ||
      a.description.toLowerCase().includes(kw) ||
      a.id.toLowerCase().includes(kw)
    return (
      hitKw &&
      (!query.type || a.type === query.type) &&
      (!query.virus || a.virus === query.virus) &&
      (!query.status || a.status === query.status)
    )
  }),
)

const stats = computed(() => ({
  total: list.value.length,
  pending: list.value.filter((a) => a.status === 'pending').length,
  approved: list.value.filter((a) => a.status === 'approved').length,
  infected: list.value.filter((a) => a.virus === 'infected').length,
  files: list.value.reduce((n, a) => n + a.attachments.length, 0),
}))

async function load() {
  loading.value = true
  try {
    list.value = await api.pluginApplies()
    events.value = await api.applyEvents()
  } catch (e) {
    ElMessage.error(`加载申请失败：${String(e)}`)
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
function typeTag(t: string): 'info' | 'warning' | 'success' {
  return t === 'replicate' ? 'info' : t === 'developer' ? 'warning' : 'success'
}
function statusTag(s: string): 'info' | 'warning' | 'success' | 'danger' {
  return s === 'approved' ? 'success' : s === 'reviewing' ? 'warning' : s === 'rejected' ? 'danger' : 'info'
}
function virusTag(v: VirusStatus): 'info' | 'success' | 'danger' {
  return v === 'infected' ? 'danger' : v === 'clean' ? 'success' : 'info'
}
function originLabel(f: ApplyAttachment): string {
  return f.origin === 'backend' ? '后端存储' : f.origin === 'inline' ? '站内附件' : '客户端本地'
}
function displayName(row: PluginApply): string {
  return row.pluginName || row.pcPluginName || row.id
}
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '')
}

// ─────────── 附件：真实站内预览 / 下载 / 临时签名链接 ───────────
function usableUrl(f: ApplyAttachment): string {
  if (f.dataUrl) return f.dataUrl
  if (f.previewUrl && /^(data:|https?:|blob:)/.test(f.previewUrl)) return f.previewUrl
  if (f.signedUrl && /^https?:/.test(f.signedUrl)) return f.signedUrl
  return ''
}

function downloadAttachment(f: ApplyAttachment) {
  const href = usableUrl(f)
  if (!href) {
    ElMessage.warning('该附件仅存在于客户端本地沙箱，尚未上传到后端，无法下载。请接入后端对象存储后再试。')
    return
  }
  const a = document.createElement('a')
  a.href = href
  a.download = f.name
  a.target = '_blank'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  ElMessage.success(`已开始下载「${f.name}」`)
}

async function copySigned(f: ApplyAttachment) {
  if (!f.signedUrl) {
    ElMessage.warning('该附件无可用签名链接')
    return
  }
  try {
    await navigator.clipboard.writeText(f.signedUrl)
    ElMessage.success('临时签名链接已复制（10 分钟有效）')
  } catch {
    ElMessage.info(f.signedUrl)
  }
}

const previewVisible = ref(false)
const previewFile = ref<ApplyAttachment | null>(null)
function openAttachment(f: ApplyAttachment) {
  if (f.isImage && usableUrl(f)) {
    previewFile.value = f
    previewVisible.value = true
    return
  }
  downloadAttachment(f)
}

// ─────────── 详情 ───────────
const detailVisible = ref(false)
const detailRow = ref<PluginApply | null>(null)
function openDetail(row: PluginApply) {
  detailRow.value = row
  detailVisible.value = true
}

// ─────────── 病毒审核 ───────────
async function onScan(row: PluginApply) {
  if (!guard()) return
  const r = await api.scanApply(row.id)
  if (r.removed) {
    ElMessage.error(`「${displayName(row)}」${r.reason}，已拒绝并删除申请记录`)
  } else {
    ElMessage.success(`扫描完成：${r.reason}`)
  }
  await load()
}

// ─────────── 状态流转 ───────────
async function onStatus(row: PluginApply, status: ApplyStatus) {
  if (!guard()) return
  await api.setApplyStatus(row.id, status)
  ElMessage.success('状态已更新并留痕')
  await load()
}

// ─────────── 回复（富文本 + 站内消息推送记录）───────────
const replyVisible = ref(false)
const replyId = ref('')
const replyTarget = ref<PluginApply | null>(null)
const editor = ref<HTMLElement | null>(null)
function openReply(row: PluginApply) {
  if (!guard()) return
  replyId.value = row.id
  replyTarget.value = row
  replyVisible.value = true
  setTimeout(() => {
    if (editor.value) editor.value.innerHTML = sanitizeHtml(row.reply || '')
  }, 0)
}
function exec(cmd: string, value?: string) {
  editor.value?.focus()
  document.execCommand(cmd, false, value)
}
function insertLink() {
  const url = window.prompt('请输入链接地址（https://…）', 'https://')
  if (!url) return
  exec('createLink', url)
}
async function submitReply() {
  const html = editor.value?.innerHTML || ''
  if (!stripHtml(html)) {
    ElMessage.warning('请填写回复内容')
    return
  }
  await api.replyApply(replyId.value, sanitizeHtml(html))
  ElMessage.success('回复已保存，并推送站内消息至申请人（Push Notification）')
  replyVisible.value = false
  await load()
}

// ─────────── 删除（明确二次确认 + 软/硬分支）───────────
const deleteVisible = ref(false)
const deleteRow = ref<PluginApply | null>(null)
function openDelete(row: PluginApply) {
  if (!guard()) return
  deleteRow.value = row
  deleteVisible.value = true
}
async function doDelete(hard: boolean) {
  if (!deleteRow.value) return
  await api.deleteApply(deleteRow.value.id, hard)
  ElMessage.success(hard ? '已硬删除：记录永久移除' : '已软删除：记录保留并标记为已拒绝')
  deleteVisible.value = false
  await load()
}

// ─────────── 新建申请（含真实附件内联）───────────
const createVisible = ref(false)
const draft = reactive({
  applicantId: '',
  type: 'idea' as ApplyType,
  pluginName: '',
  pcPluginName: '',
  description: '',
  techNotes: '',
  attachments: [] as ApplyAttachment[],
})
function openCreate() {
  if (!guard()) return
  Object.assign(draft, {
    applicantId: '', type: 'idea' as ApplyType, pluginName: '', pcPluginName: '',
    description: '', techNotes: '', attachments: [] as ApplyAttachment[],
  })
  createVisible.value = true
}
function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result || ''))
    r.onerror = () => reject(new Error('读取文件失败'))
    r.readAsDataURL(file)
  })
}
async function onFilesPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  for (const f of files) {
    if (f.size > 2 * 1024 * 1024) {
      ElMessage.warning(`「${f.name}」超过 2 MB，站内内联将占用过多存储，已跳过。请改用后端对象存储。`)
      continue
    }
    const isImage = /^image\//.test(f.type) || /\.(png|jpe?g|gif|webp|bmp)$/i.test(f.name)
    const dataUrl = await readDataUrl(f)
    draft.attachments.push({
      name: f.name,
      mime: f.type || 'application/octet-stream',
      size: f.size,
      isImage,
      dataUrl,
      previewUrl: isImage ? dataUrl : undefined,
      origin: 'inline',
    })
  }
  input.value = ''
}
function removeDraftAtt(i: number) {
  draft.attachments.splice(i, 1)
}
async function submitCreate() {
  if (!draft.applicantId.trim()) return ElMessage.warning('请填写申请人 ID')
  if (draft.type === 'replicate' && !draft.pcPluginName.trim())
    return ElMessage.warning('复刻申请必须填写 PC 端插件名')
  if (!draft.description.trim()) return ElMessage.warning('请填写需求描述')
  await api.createApply({
    applicantId: draft.applicantId.trim(),
    type: draft.type,
    pluginName: draft.pluginName.trim(),
    pcPluginName: draft.pcPluginName.trim(),
    description: draft.description.trim(),
    techNotes: draft.techNotes.trim(),
    attachments: draft.attachments,
    status: 'pending',
    virus: 'unknown',
    reply: '',
  })
  ElMessage.success('申请已创建并持久化')
  createVisible.value = false
  await load()
}

// ─────────── 导入 / 导出 / 清空 ───────────
const importVisible = ref(false)
const importText = ref('')
async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  if (!f) return
  importText.value = await f.text()
  input.value = ''
}
async function doImport() {
  let payload: unknown
  try {
    payload = JSON.parse(importText.value)
  } catch {
    ElMessage.error('JSON 解析失败，请检查内容')
    return
  }
  const r = await api.importApplies(payload)
  ElMessage.success(`导入完成：新增 ${r.added} 条，跳过重复/无效 ${r.skipped} 条`)
  importText.value = ''
  importVisible.value = false
  await load()
}
function triggerDownload(text: string, name: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function doExport() {
  const text = await api.exportApplies()
  triggerDownload(text, `plugin-applies-${Date.now()}.json`, 'application/json')
  ElMessage.success('申请数据已导出')
}
async function doClear() {
  if (!guard()) return
  try {
    await ElMessageBox.confirm(
      '将永久清空全部插件申请与操作留痕（含客户端导入记录），且不可恢复。确认继续？',
      '清空全部申请',
      { type: 'warning', confirmButtonText: '确认清空', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  await api.clearApplies()
  ElMessage.success('已清空全部申请记录')
  await load()
}

// ─────────── 操作留痕 ───────────
const eventsVisible = ref(false)
async function openEvents() {
  events.value = await api.applyEvents()
  eventsVisible.value = true
}

onMounted(load)
</script>

<template>
  <div class="page" v-loading="loading">
    <div class="page-head">
      <div>
        <h2>插件申请管理</h2>
        <p>
          真实申请数据（当前数据源：
          <b>{{ dataSource.mode === 'rest' ? `REST 后端 ${dataSource.base}` : '本机持久化仓储' }}</b>）。
          所有审核、回复、删除操作刷新后仍生效并留痕。
        </p>
      </div>
    </div>

    <div class="kpi-row">
      <div class="kpi"><span>申请总数</span><b>{{ stats.total }}</b></div>
      <div class="kpi"><span>待审核</span><b>{{ stats.pending }}</b></div>
      <div class="kpi"><span>已通过</span><b>{{ stats.approved }}</b></div>
      <div class="kpi"><span>病毒命中</span><b class="danger">{{ stats.infected }}</b></div>
      <div class="kpi"><span>附件总数</span><b>{{ stats.files }}</b></div>
    </div>

    <el-card shadow="never" class="card">
      <div class="toolbar">
        <el-input v-model="query.keyword" placeholder="搜索申请人ID / 插件名 / 描述 / 申请ID" clearable style="width: 260px" />
        <el-select v-model="query.type" placeholder="全部类型" clearable style="width: 155px">
          <el-option v-for="t in typeOptions" :key="t.value" :label="t.label" :value="t.value" />
        </el-select>
        <el-select v-model="query.virus" placeholder="病毒状态" clearable style="width: 130px">
          <el-option v-for="v in virusOptions" :key="v.value" :label="v.label" :value="v.value" />
        </el-select>
        <el-select v-model="query.status" placeholder="审核状态" clearable style="width: 130px">
          <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
        <el-button size="small" @click="load">刷新</el-button>
        <div class="spacer" />
        <el-button size="small" @click="openEvents">操作留痕</el-button>
        <el-button size="small" @click="doExport">导出</el-button>
        <el-button size="small" @click="importVisible = true">导入申请 JSON</el-button>
        <el-button size="small" type="primary" :disabled="!auth.canPerm('plugin:apply')" @click="openCreate">新建申请</el-button>
        <el-button size="small" type="danger" plain :disabled="!auth.canPerm('plugin:apply')" @click="doClear">清空</el-button>
      </div>

      <el-table :data="filtered" size="small" stripe>
        <template #empty>
          <div class="empty">
            <b>暂无插件申请记录</b>
            <span>测试机器人数据已全部清除。可「新建申请」或「导入申请 JSON」载入客户端提交的真实 payload。</span>
          </div>
        </template>
        <el-table-column prop="id" label="申请ID" width="150" />
        <el-table-column prop="applicantId" label="申请人ID" width="130" />
        <el-table-column label="类型" width="120">
          <template #default="{ row }">
            <el-tag :type="typeTag(row.type)" size="small">{{ row.typeName }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="插件命名" min-width="160">
          <template #default="{ row }">
            <el-link type="primary" :underline="false" @click="openDetail(row)">{{ displayName(row) }}</el-link>
            <div v-if="row.pcPluginName" class="sub">PC：{{ row.pcPluginName }}</div>
            <div class="sub">来源：{{ row.source === 'app' ? '客户端提交' : row.source === 'admin' ? '管理端录入' : 'JSON 导入' }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="需求描述" min-width="200" show-overflow-tooltip />
        <el-table-column label="附件" min-width="270">
          <template #default="{ row }">
            <div class="atts">
              <template v-for="(f, i) in row.attachments" :key="i">
                <el-tooltip :content="`${f.name} · ${fmtSize(f.size)} · ${originLabel(f)}`" placement="top">
                  <div class="att" @click="openAttachment(f)">
                    <img v-if="f.isImage && usableUrl(f)" :src="usableUrl(f)" class="thumb" :alt="f.name" />
                    <span v-else class="file-chip"><el-icon><Document /></el-icon>{{ f.name }}</span>
                  </div>
                </el-tooltip>
                <el-button class="att-copy" link size="small" @click="copySigned(f)" title="复制临时签名下载链接">链接</el-button>
              </template>
              <span v-if="!row.attachments.length" class="sub">无附件</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="病毒审核" width="150">
          <template #default="{ row }">
            <el-tag :type="virusTag(row.virus)" size="small">{{ row.virusName }}</el-tag>
            <el-button link type="primary" size="small" :disabled="!auth.canPerm('plugin:apply')" @click="onScan(row)">扫描</el-button>
            <div v-if="row.scannedAt" class="sub">{{ row.scannedAt }}</div>
          </template>
        </el-table-column>
        <el-table-column label="审核状态" width="130">
          <template #default="{ row }">
            <el-select :model-value="row.status" size="small" :disabled="!auth.canPerm('plugin:apply')"
              @change="onStatus(row, $event)">
              <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="回复" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.reply" type="success" size="small" effect="plain">已回复</el-tag>
            <span v-else class="sub">未回复</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openDetail(row)">详情</el-button>
            <el-button link type="primary" size="small" :disabled="!auth.canPerm('plugin:apply')" @click="openReply(row)">回复</el-button>
            <el-button link type="danger" size="small" :disabled="!auth.canPerm('plugin:apply')" @click="openDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="foot">共 {{ filtered.length }} 条记录 · 数据修改即时持久化</div>
    </el-card>

    <!-- 申请详情 -->
    <el-drawer v-model="detailVisible" title="申请详情" size="520px">
      <template v-if="detailRow">
        <div class="detail-grid">
          <span>申请ID</span><b>{{ detailRow.id }}</b>
          <span>申请人ID</span><b>{{ detailRow.applicantId }}</b>
          <span>申请类型</span><b>{{ detailRow.typeName }}</b>
          <span>插件命名</span><b>{{ detailRow.pluginName || '—' }}</b>
          <span>PC 端插件名</span><b>{{ detailRow.pcPluginName || '—' }}</b>
          <span>提交时间</span><b>{{ detailRow.createdAt }}</b>
          <span>审核状态</span><b>{{ detailRow.statusName }}</b>
          <span>病毒审核</span><b>{{ detailRow.virusName }}</b>
        </div>
        <h4>需求描述</h4>
        <p class="pre">{{ detailRow.description || '—' }}</p>
        <h4>技术备注</h4>
        <p class="pre">{{ detailRow.techNotes || '—' }}</p>
        <h4>附件（{{ detailRow.attachments.length }}）</h4>
        <div v-for="(f, i) in detailRow.attachments" :key="i" class="att-row">
          <span>{{ f.name }} · {{ fmtSize(f.size) }} · {{ originLabel(f) }}</span>
          <span>
            <el-button link type="primary" size="small" @click="openAttachment(f)">预览/下载</el-button>
            <el-button link size="small" @click="copySigned(f)">签名链接</el-button>
          </span>
        </div>
        <h4>回复内容</h4>
        <div v-if="detailRow.reply" class="reply-html" v-html="sanitizeHtml(detailRow.reply)" />
        <p v-else class="pre">尚未回复</p>
        <h4>原始 Payload</h4>
        <pre class="raw">{{ JSON.stringify(detailRow.raw || detailRow, null, 2) }}</pre>
      </template>
    </el-drawer>

    <!-- 新建申请 -->
    <el-dialog v-model="createVisible" title="新建插件收录申请" width="640px">
      <el-form label-width="110px">
        <el-form-item label="申请人ID" required>
          <el-input v-model="draft.applicantId" placeholder="如 u_8f3k2" />
        </el-form-item>
        <el-form-item label="申请类型">
          <el-select v-model="draft.type" style="width: 100%">
            <el-option v-for="t in typeOptions" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="draft.type === 'replicate'" label="PC 端插件名" required>
          <el-input v-model="draft.pcPluginName" placeholder="需与电脑版 DSH 已有插件名一致" />
        </el-form-item>
        <el-form-item v-else label="插件命名">
          <el-input v-model="draft.pluginName" placeholder="自定义插件名称" />
        </el-form-item>
        <el-form-item label="需求描述" required>
          <el-input v-model="draft.description" type="textarea" :rows="3" placeholder="多行需求描述" />
        </el-form-item>
        <el-form-item label="技术备注">
          <el-input v-model="draft.techNotes" type="textarea" :rows="2" placeholder="宿主语言栈 / 沙箱隔离 / API 配额 / 生命周期" />
        </el-form-item>
        <el-form-item label="附件">
          <div>
            <input type="file" multiple @change="onFilesPicked" />
            <div class="sub">单文件 ≤ 2 MB 会以 data URL 内联，可在站内直接预览与下载；大文件需接入后端对象存储。</div>
            <div v-for="(f, i) in draft.attachments" :key="i" class="att-row">
              <span>{{ f.name }} · {{ fmtSize(f.size) }}</span>
              <el-button link type="danger" size="small" @click="removeDraftAtt(i)">移除</el-button>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">创建申请</el-button>
      </template>
    </el-dialog>

    <!-- 导入 App 端 payload -->
    <el-dialog v-model="importVisible" title="导入客户端申请 JSON" width="620px">
      <p class="tip">
        支持 App 端 <code>PluginApply.toJson()</code> 单条对象、数组，或 <code>{ applies: [...] }</code> 包装。
        按申请 ID 去重；客户端本地沙箱附件仅保留元数据，接入后端上传后可生成真实签名链接。
      </p>
      <input type="file" accept=".json,application/json" @change="onImportFile" />
      <el-input v-model="importText" type="textarea" :rows="10" placeholder="也可直接粘贴 JSON 内容" style="margin-top: 10px" />
      <template #footer>
        <el-button @click="importVisible = false">取消</el-button>
        <el-button type="primary" @click="doImport">解析并导入</el-button>
      </template>
    </el-dialog>

    <!-- 回复：富文本 + 推送 -->
    <el-dialog v-model="replyVisible" title="回复申请人（推送站内消息 / Push Notification）" width="620px">
      <p class="tip">申请人：<b>{{ replyTarget?.applicantId }}</b> · 申请：<b>{{ replyTarget && displayName(replyTarget) }}</b></p>
      <div class="rt-bar">
        <el-button size="small" @click="exec('bold')"><b>B</b></el-button>
        <el-button size="small" @click="exec('italic')"><i>I</i></el-button>
        <el-button size="small" @click="exec('insertUnorderedList')">列表</el-button>
        <el-button size="small" @click="insertLink">插入链接</el-button>
        <el-button size="small" @click="exec('removeFormat')">清除格式</el-button>
      </div>
      <div ref="editor" class="rt-editor" contenteditable="true" data-placeholder="填写审核结论、上架计划、补充材料要求等…" />
      <template #footer>
        <el-button @click="replyVisible = false">取消</el-button>
        <el-button type="primary" @click="submitReply">保存并推送回复</el-button>
      </template>
    </el-dialog>

    <!-- 删除二次确认 -->
    <el-dialog v-model="deleteVisible" title="删除申请（防误触二次确认）" width="480px">
      <p>即将删除申请「<b>{{ deleteRow && displayName(deleteRow) }}</b>」（{{ deleteRow?.applicantId }}）。</p>
      <p class="tip">软删除：保留记录并标记为已拒绝，可追溯；硬删除：永久移除，不可恢复。</p>
      <template #footer>
        <el-button @click="deleteVisible = false">取消</el-button>
        <el-button @click="doDelete(false)">软删除</el-button>
        <el-button type="danger" @click="doDelete(true)">硬删除</el-button>
      </template>
    </el-dialog>

    <!-- 图片站内预览 -->
    <el-dialog v-model="previewVisible" title="附件站内预览" width="700px">
      <template v-if="previewFile">
        <img :src="usableUrl(previewFile)" class="preview-img" :alt="previewFile.name" />
        <div class="foot">
          {{ previewFile.name }} · {{ fmtSize(previewFile.size) }} · {{ originLabel(previewFile) }}
        </div>
        <div class="foot">临时签名链接：<code>{{ previewFile.signedUrl }}</code></div>
        <el-button size="small" type="primary" @click="downloadAttachment(previewFile)">下载原文件</el-button>
        <el-button size="small" @click="copySigned(previewFile)">复制签名链接</el-button>
      </template>
    </el-dialog>

    <!-- 操作留痕 -->
    <el-dialog v-model="eventsVisible" title="申请管理操作留痕 / 推送记录" width="760px">
      <el-table :data="events" size="small" stripe max-height="420">
        <el-table-column prop="at" label="时间" width="160" />
        <el-table-column prop="action" label="动作" width="120" />
        <el-table-column prop="applyId" label="申请ID" width="160" />
        <el-table-column prop="operator" label="操作人" width="120" />
        <el-table-column prop="detail" label="详情" min-width="220" show-overflow-tooltip />
      </el-table>
      <div class="foot">共 {{ events.length }} 条留痕</div>
    </el-dialog>
  </div>
</template>

<style scoped>
.page { padding: 4px 2px 24px; }
.page-head h2 { margin: 0 0 6px; font-size: 20px; font-weight: 650; }
.page-head p { margin: 0; color: #8a94a6; font-size: 12.5px; }
.kpi-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin: 16px 0; }
.kpi { background: #fff; border: 1px solid #eceff5; border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; }
.kpi span { color: #8a94a6; font-size: 12px; }
.kpi b { font-size: 22px; font-weight: 650; }
.kpi b.danger { color: #f56c6c; }
.card { border-radius: 12px; }
.toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
.spacer { flex: 1; }
.sub { color: #9aa3b2; font-size: 11px; margin-top: 2px; }
.atts { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.att { display: inline-flex; align-items: center; cursor: pointer; }
.att-copy { margin-left: -4px; }
.thumb { width: 44px; height: 44px; border-radius: 6px; object-fit: cover; border: 1px solid #eceff5; }
.file-chip { display: inline-flex; align-items: center; gap: 3px; max-width: 150px; padding: 3px 8px; background: #f4f6fa; border-radius: 6px; font-size: 11px; color: #5b6577; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.foot { margin-top: 12px; color: #9aa3b2; font-size: 12px; }
.empty { display: flex; flex-direction: column; gap: 6px; padding: 18px; color: #8a94a6; font-size: 12.5px; }
.empty b { color: #5b6577; font-size: 14px; }
.detail-grid { display: grid; grid-template-columns: 110px 1fr; gap: 8px 12px; font-size: 13px; }
.detail-grid span { color: #8a94a6; }
h4 { margin: 18px 0 8px; font-size: 14px; }
.pre, .raw { white-space: pre-wrap; word-break: break-all; font-size: 12.5px; line-height: 1.6; color: #5b6577; background: #f7f9fc; padding: 10px; border-radius: 8px; margin: 0; }
.raw { max-height: 240px; overflow: auto; }
.att-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 12px; padding: 6px 0; border-bottom: 1px solid #f0f2f6; }
.reply-html { font-size: 13px; line-height: 1.7; background: #f7f9fc; border-radius: 8px; padding: 10px; }
.tip { font-size: 12.5px; color: #8a94a6; line-height: 1.6; margin: 0 0 10px; }
.tip code { background: #f2f4f8; padding: 1px 4px; border-radius: 4px; }
.rt-bar { display: flex; gap: 6px; margin-bottom: 8px; }
.rt-editor { min-height: 160px; border: 1px solid #dcdfe6; border-radius: 8px; padding: 10px 12px; font-size: 13px; line-height: 1.7; outline: none; }
.rt-editor:focus { border-color: #409eff; }
.rt-editor:empty::before { content: attr(data-placeholder); color: #a8abb2; }
.preview-img { width: 100%; border-radius: 8px; }
@media (max-width: 1100px) { .kpi-row { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 900px) { .kpi-row { grid-template-columns: repeat(2, 1fr); } }
</style>
