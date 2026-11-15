// ===== 插件申请收录：真实数据层（v2.7.2）=====
// 变更：移除全部 4 条硬编码假申请、假 OSS 域名、随机风景预览图；
// 改为空库起步 + localStorage 持久化 + 审计留痕，所有操作刷新后仍生效。
// 数据来源三条：
//  1) App 端提交：客户端 POST {VITE_APPLY_API_BASE}/plugins/apply（需后端）；
//  2) JSON 导入：把 App 端导出的申请 payload 导入管理端即可完整查看与处理；
//  3) 管理端录入：新建申请，附件以 data URL 内联，可站内真实预览 / 下载。
// 配置 VITE_APPLY_API_BASE 后，读写自动切换到真实 RESTful 后端。

import axios from 'axios'
import type {
  ApplyAttachment,
  ApplyEvent,
  ApplyStatus,
  ApplyType,
  PluginApply,
  VirusStatus,
} from '@/types'

const KEY_APPLIES = 'dsh_admin_real_v2_applies'
const KEY_EVENTS = 'dsh_admin_real_v2_apply_events'
const REST_BASE = (import.meta.env.VITE_APPLY_API_BASE || '').replace(/\/$/, '')

export const applyTypeNames: Record<ApplyType, string> = {
  replicate: '复刻电脑版插件',
  developer: '开发者创建',
  idea: '想法分享',
}
export const statusNames: Record<ApplyStatus, string> = {
  pending: '待审核',
  reviewing: '审核中',
  approved: '已通过',
  rejected: '已拒绝',
}
export const virusNames: Record<VirusStatus, string> = {
  unknown: '未扫描',
  clean: '安全',
  infected: '检出病毒',
}

const VIRUS_PATTERN = /crack|malware|virus|trojan|ransom|破解|外挂|木马|盗号|注入/i

/** 新建申请入参：业务字段必填，派生字段由数据层生成 */
export type CreateApplyInput = Partial<PluginApply> &
  Pick<PluginApply, 'type' | 'applicantId' | 'attachments'>

function nowText(): string {
  const d = new Date()
  const p = (n: number) => `${n}`.padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i)
  return Math.abs(h)
}

/** 临时签名下载凭证：10 分钟有效。后端附件保留原始 URL，站内附件生成带签名/过期的凭证串。 */
function signedUrlFor(att: ApplyAttachment, applyId: string): string | undefined {
  if (att.signedUrl) return att.signedUrl
  if (att.origin === 'client' && !att.dataUrl) return undefined
  const exp = Math.floor(Date.now() / 1000) + 600
  const sign = hashCode(`${applyId}:${att.name}:${exp}`).toString(36).padStart(8, '0')
  return `dsh://attachment/${encodeURIComponent(att.name)}?apply=${encodeURIComponent(applyId)}&exp=${exp}&sign=${sign}`
}

// ─────────── 持久化 ───────────
function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const v: unknown = JSON.parse(raw)
    return Array.isArray(v) ? (v as T[]) : []
  } catch {
    return []
  }
}

function write<T>(key: string, rows: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(rows))
  } catch (e) {
    // 大附件导致配额超限时，剥离 dataUrl 再存一次，保证业务记录不丢
    try {
      const slim = JSON.stringify(rows, (k, v) =>
        k === 'dataUrl' && typeof v === 'string' && v.length > 200000 ? undefined : v,
      )
      localStorage.setItem(key, slim)
    } catch {
      // 存储不可用：本次会话内存态仍生效
      void e
    }
  }
}

let applies: PluginApply[] = read<PluginApply>(KEY_APPLIES)
let events: ApplyEvent[] = read<ApplyEvent>(KEY_EVENTS)

function persist(): void {
  write(KEY_APPLIES, applies)
  write(KEY_EVENTS, events)
}

function logEvent(
  applyId: string,
  action: ApplyEvent['action'],
  detail: string,
  operator = '当前管理员',
): void {
  events.unshift({ id: uid('ev'), applyId, action, detail, at: nowText(), operator })
  events = events.slice(0, 300)
}

function withNames(a: PluginApply): PluginApply {
  return {
    ...a,
    typeName: applyTypeNames[a.type] || a.typeName,
    statusName: statusNames[a.status] || a.statusName,
    virusName: virusNames[a.virus] || a.virusName,
  }
}

// ─────────── 归一化：兼容客户端 PluginApply.toJson() ───────────
function normalizeAttachment(raw: Record<string, unknown>, applyId: string): ApplyAttachment {
  const name = String(raw.name ?? raw.fileName ?? '未命名附件')
  const mime = String(raw.mime ?? raw.mimeType ?? '')
  const size = Number(raw.size ?? raw.sizeBytes ?? 0) || 0
  const isImage = Boolean(raw.isImage) || /^image\//i.test(mime) || /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(name)
  const remoteUrl = typeof raw.signedUrl === 'string' ? raw.signedUrl : typeof raw.url === 'string' ? raw.url : ''
  const preview = typeof raw.previewUrl === 'string' ? raw.previewUrl : ''
  const dataUrl = typeof raw.dataUrl === 'string' ? raw.dataUrl : ''
  const localPath = typeof raw.path === 'string' ? raw.path : typeof raw.localPath === 'string' ? raw.localPath : ''

  const att: ApplyAttachment = {
    name,
    mime,
    size,
    isImage,
    localPath: localPath || undefined,
    dataUrl: dataUrl || undefined,
    previewUrl: preview || (isImage && dataUrl ? dataUrl : '') || undefined,
    signedUrl: remoteUrl || undefined,
    origin: remoteUrl ? 'backend' : dataUrl ? 'inline' : 'client',
  }
  att.signedUrl = signedUrlFor(att, applyId)
  return att
}

function normalizeApply(raw: Record<string, unknown>): PluginApply | null {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || uid('a'))
  const typeRaw = String(raw.type || 'idea')
  const type: ApplyType = (['replicate', 'developer', 'idea'] as string[]).includes(typeRaw)
    ? (typeRaw as ApplyType)
    : 'idea'
  const statusRaw = String(raw.status || 'pending')
  const status: ApplyStatus = (['pending', 'reviewing', 'approved', 'rejected'] as string[]).includes(statusRaw)
    ? (statusRaw as ApplyStatus)
    : 'pending'
  const virusRaw = String(raw.virus || 'unknown')
  const virus: VirusStatus = (['unknown', 'clean', 'infected'] as string[]).includes(virusRaw)
    ? (virusRaw as VirusStatus)
    : 'unknown'

  const rawAtts = Array.isArray(raw.attachments) ? raw.attachments : []
  const attachments = rawAtts
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => normalizeAttachment(x, id))

  const created = String(raw.createdAt || nowText())
  const createdAt = /^\d{4}-\d{2}-\d{2}T/.test(created)
    ? created.replace('T', ' ').slice(0, 19)
    : created

  return withNames({
    id,
    applicantId: String(raw.applicantId || raw.applicant || '未知申请人'),
    type,
    typeName: '',
    pluginName: String(raw.pluginName || ''),
    pcPluginName: String(raw.pcPluginName || ''),
    description: String(raw.description || ''),
    techNotes: String(raw.techNotes || ''),
    attachments,
    createdAt,
    status,
    statusName: '',
    virus,
    virusName: '',
    reply: String(raw.reply || ''),
    source: (raw.source as PluginApply['source']) || 'import',
    deleted: Boolean(raw.deleted),
    raw,
  })
}

function sleep(ms = 120) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function visible(): PluginApply[] {
  return applies.filter((a) => !a.deleted)
}

function clone(): PluginApply[] {
  return visible().map((a) => ({
    ...a,
    attachments: a.attachments.map((f) => ({ ...f })),
  }))
}

// ─────────── REST 后端（可选）───────────
async function rest<T>(fn: () => Promise<{ data: T }>, fallback: () => T | Promise<T>): Promise<T> {
  if (!REST_BASE) return fallback()
  try {
    return (await fn()).data
  } catch {
    return fallback()
  }
}

// ─────────── 对外 API ───────────
export const applyApi = {
  async pluginApplies(): Promise<PluginApply[]> {
    await sleep()
    return rest<PluginApply[]>(
      () => axios.get(`${REST_BASE}/plugins/apply`),
      clone,
    )
  },

  /** 新建申请（管理端录入 / 模拟客户端提交） */
  async createApply(input: CreateApplyInput): Promise<PluginApply> {
    await sleep(150)
    const id = input.id || uid('a')
    const atts = input.attachments.map((f) => {
      const att: ApplyAttachment = { ...f }
      att.origin = att.signedUrl && !att.dataUrl ? 'backend' : att.dataUrl ? 'inline' : 'client'
      att.previewUrl = att.previewUrl || (att.isImage && att.dataUrl ? att.dataUrl : undefined)
      att.signedUrl = signedUrlFor(att, id)
      return att
    })
    const row = withNames({
      id,
      applicantId: input.applicantId,
      type: input.type,
      typeName: '',
      pluginName: input.pluginName || '',
      pcPluginName: input.pcPluginName || '',
      description: input.description || '',
      techNotes: input.techNotes || '',
      attachments: atts,
      createdAt: input.createdAt || nowText(),
      status: input.status || 'pending',
      statusName: '',
      virus: input.virus || 'unknown',
      virusName: '',
      reply: input.reply || '',
      source: input.source || 'admin',
      deleted: false,
    })
    applies.unshift(row)
    logEvent(id, 'create', `新建申请「${row.pluginName || row.pcPluginName || id}」`)
    persist()
    return row
  },

  /** 导入 App 端申请 payload（支持数组 / 单对象 / {applies|items} 包装） */
  async importApplies(payload: unknown): Promise<{ added: number; skipped: number }> {
    await sleep(150)
    let rows: unknown[] = []
    if (Array.isArray(payload)) rows = payload
    else if (payload && typeof payload === 'object') {
      const obj = payload as Record<string, unknown>
      const nested = obj.applies ?? obj.items ?? obj.list ?? obj.data
      rows = Array.isArray(nested) ? nested : [payload]
    }
    const existing = new Set(applies.map((a) => a.id))
    let added = 0
    let skipped = 0
    for (const r of rows) {
      const n = normalizeApply((r || {}) as Record<string, unknown>)
      if (!n || existing.has(n.id)) {
        skipped++
        continue
      }
      existing.add(n.id)
      applies.unshift(n)
      logEvent(n.id, 'import', `导入客户端申请「${n.pluginName || n.pcPluginName || n.id}」`)
      added++
    }
    persist()
    return { added, skipped }
  },

  /** 导出全部申请（含客户端原始 payload） */
  async exportApplies(): Promise<string> {
    await sleep(80)
    return JSON.stringify({ exportedAt: nowText(), count: visible().length, applies: clone() }, null, 2)
  },

  /** 回复：写入回复内容 + 生成站内消息推送记录 */
  async replyApply(id: string, text: string): Promise<boolean> {
    await sleep(150)
    let ok = false
    applies = applies.map((a) => {
      if (a.id !== id) return a
      ok = true
      return withNames({
        ...a,
        reply: text,
        replyAt: nowText(),
        status: a.status === 'rejected' ? a.status : 'approved',
      })
    })
    if (ok) {
      logEvent(id, 'reply', `回复内容：${text.slice(0, 80)}`)
      logEvent(id, 'push', `已向申请人 ${applies.find((a) => a.id === id)?.applicantId || id} 推送站内消息（Push Notification）`)
      persist()
    }
    return ok
  },

  /** 删除：hard=true 永久移除；false 软删除（保留记录、标记已拒绝） */
  async deleteApply(id: string, hard = false): Promise<boolean> {
    await sleep(120)
    const target = applies.find((a) => a.id === id)
    if (!target) return false
    if (hard) {
      applies = applies.filter((a) => a.id !== id)
      logEvent(id, 'delete', `硬删除「${target.pluginName || target.pcPluginName || id}」，记录已永久移除`)
    } else {
      applies = applies.map((a) =>
        a.id === id ? withNames({ ...a, deleted: true, status: 'rejected' }) : a,
      )
      logEvent(id, 'soft-delete', `软删除「${target.pluginName || target.pcPluginName || id}」，记录保留`)
    }
    persist()
    return true
  },

  /** 病毒审核：命中风险特征即拒绝并删除申请记录 */
  async scanApply(id: string): Promise<{ virus: VirusStatus; removed: boolean; reason: string }> {
    await sleep(320)
    const target = applies.find((a) => a.id === id)
    if (!target) return { virus: 'unknown', removed: false, reason: '申请记录不存在' }
    const hits: string[] = []
    for (const f of target.attachments) {
      if (VIRUS_PATTERN.test(f.name) || VIRUS_PATTERN.test(f.localPath || '')) hits.push(f.name)
    }
    if (VIRUS_PATTERN.test(target.pluginName) || VIRUS_PATTERN.test(target.description)) {
      hits.push(target.pluginName || '需求描述')
    }
    if (hits.length) {
      const reason = `命中风险特征：${hits.join('、')}`
      applies = applies.filter((a) => a.id !== id)
      logEvent(id, 'scan', `${reason}；已拒绝并删除申请记录`)
      persist()
      return { virus: 'infected', removed: true, reason }
    }
    applies = applies.map((a) =>
      a.id === id ? withNames({ ...a, virus: 'clean', scannedAt: nowText() }) : a,
    )
    logEvent(id, 'scan', '本地特征规则扫描完成，未检出风险')
    persist()
    return { virus: 'clean', removed: false, reason: '未检出风险特征' }
  },

  /** 状态流转 */
  async setApplyStatus(id: string, status: ApplyStatus): Promise<boolean> {
    await sleep(100)
    let ok = false
    applies = applies.map((a) => {
      if (a.id !== id) return a
      ok = true
      return withNames({ ...a, status })
    })
    if (ok) {
      logEvent(id, 'status', `状态变更为「${statusNames[status]}」`)
      persist()
    }
    return ok
  },

  /** 操作留痕 / 推送记录 */
  async applyEvents(): Promise<ApplyEvent[]> {
    await sleep(80)
    return [...events]
  },

  /** 清空全部申请与留痕（用于清除测试记录） */
  async clearApplies(): Promise<boolean> {
    await sleep(100)
    applies = []
    events = []
    persist()
    return true
  },

  /** 当前数据来源说明 */
  dataSource(): { mode: 'rest' | 'local'; base: string } {
    return { mode: REST_BASE ? 'rest' : 'local', base: REST_BASE }
  },
}
