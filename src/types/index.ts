// ===== 管理后台全局类型定义 =====

// ── 管理员 / RBAC ──
export type RoleCode = 'super' | 'operator' | 'viewer'

export interface AdminUser {
  id: string
  username: string
  nickname: string
  role: RoleCode
  roleName: string
  lastLoginAt: string
  status: 'active' | 'disabled'
}

export interface LoginResult {
  token: string
  expiresAt: number
  admin: AdminUser
}

// ── 用户账号 ──
export interface UserAccount {
  id: string
  username: string
  deviceId: string
  deviceShort: string
  status: 'active' | 'frozen'
  createdAt: string
  lastLoginAt: string
  taskCount: number
  points: number
  clientVersion: string
  ipRegion: string
}

// ── 设备绑定 ──
export interface DeviceBinding {
  deviceId: string
  deviceShort: string
  username: string
  boundAt: string
  lastActiveAt: string
  clientVersion: string
  online: boolean
}

// ── Agent 任务日志 ──
export type TaskStatus = 'running' | 'success' | 'failed' | 'cancelled'
export type TaskType = 'chat' | 'agent' | 'automation'

export interface TaskLog {
  id: string
  taskNo: string
  username: string
  type: TaskType
  typeName: string
  status: TaskStatus
  statusName: string
  startAt: string
  endAt: string
  durationMs: number
  result: string
  deviceShort: string
}

// ── 审计日志 ──
export interface AuditLog {
  id: string
  operator: string
  action: string
  target: string
  detail: string
  ip: string
  createdAt: string
}

// ── 在线用户 ──
export interface OnlineUser {
  sessionId: string
  username: string
  deviceId: string
  deviceShort: string
  loginAt: string
  clientVersion: string
  ipRegion: string
  lastHeartbeat: string
}

// ── 告警 ──
export type AlertLevel = 'info' | 'warning' | 'critical'

export interface AlertItem {
  id: string
  level: AlertLevel
  levelName: string
  title: string
  detail: string
  time: string
  read: boolean
}

// ── 看板 KPI ──
export interface KpiCard {
  key: string
  label: string
  value: number
  unit?: string
  trend: number // 同比/环比百分比，正负
  trendLabel: string
  compareType: 'yoy' | 'mom'
}

export interface TimeSeriesPoint {
  time: string
  value: number
}

export interface DashboardData {
  kpis: KpiCard[]
  onlineTrend: TimeSeriesPoint[]
  registerTrend: TimeSeriesPoint[]
  dailyRegister: TimeSeriesPoint[]
  dailyTasks: TimeSeriesPoint[]
  taskTypeDist: { name: string; value: number }[]
  deviceDist: { name: string; value: number }[]
  funnel: { name: string; value: number }[]
  concurrency: number
}

// ── 全局配置 ──
export interface SystemConfig {
  rateLimitPerMin: number
  dashboardRefreshSec: number
  alertThresholdConsecutiveFail: number
  alertHighFreqPerMin: number
  sessionTimeoutMin: number
  allowRemoteLogout: boolean
}

// ── 分页 ──
export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export interface PageQuery {
  page: number
  pageSize: number
  [key: string]: unknown
}

// ── 插件全生命周期 ──
export type PluginStatus = 'published' | 'gray' | 'offline' | 'draft'

export interface PluginItem {
  id: string
  name: string
  category: 'UI 美化插件' | '实用插件' | '娱乐与便利插件' | 'AGI 架构探索'
  author: string
  version: string
  status: PluginStatus
  statusName: string
  installs: number
  rating: number
  grayPercent: number
  updatedAt: string
  desc: string
}

// ── 版本发布（OTA）──
export type ReleaseStatus = 'released' | 'gray' | 'archived'

export interface ReleaseRecord {
  version: string
  build: number
  date: string
  channel: string
  status: ReleaseStatus
  statusName: string
  apkUrl: string
  md5: string
  sha256: string
  size: number
  force: boolean
  notes: string
  changelog: string[]
}

export interface ReleasePayload {
  version: string
  build: number
  channel: string
  apkUrl: string
  md5: string
  sha256: string
  size: number
  force: boolean
  notes: string
  changelog: string[]
}

// ── 插件申请收录 ──
export type ApplyType = 'replicate' | 'developer' | 'idea'
export type VirusStatus = 'unknown' | 'clean' | 'infected'
export type ApplyStatus = 'pending' | 'reviewing' | 'approved' | 'rejected'

export interface ApplyAttachment {
  name: string
  mime: string
  size: number
  isImage: boolean
  /** 客户端本地路径（手机沙箱路径，服务端不可直接访问） */
  localPath?: string
  /** 临时签名下载链接（OSS/URL，带签名与过期时间） */
  signedUrl?: string
  /** 图片站内预览地址（可直接在网页打开观看 / 下载） */
  previewUrl?: string
  /** 站内导入的内联文件内容（data URL），可真实预览与下载 */
  dataUrl?: string
  /** 附件来源：backend=后端对象存储 / inline=站内导入 / client=仅客户端本地 */
  origin?: 'backend' | 'inline' | 'client'
}

export interface PluginApply {
  id: string
  applicantId: string
  type: ApplyType
  typeName: string
  pluginName: string
  pcPluginName: string
  description: string
  techNotes: string
  attachments: ApplyAttachment[]
  createdAt: string
  status: ApplyStatus
  statusName: string
  virus: VirusStatus
  virusName: string
  reply: string
  /** 数据来源：app=客户端提交 / admin=管理端录入 / import=JSON 导入 */
  source?: 'app' | 'admin' | 'import'
  /** 软删除标记（记录保留但不在列表展示） */
  deleted?: boolean
  replyAt?: string
  scannedAt?: string
  /** 原始 payload（客户端提交），便于溯源 */
  raw?: Record<string, unknown>
}

/** 管理端对申请的操作留痕 / 推送记录 */
export interface ApplyEvent {
  id: string
  applyId: string
  action: 'create' | 'reply' | 'scan' | 'delete' | 'soft-delete' | 'status' | 'import' | 'push'
  detail: string
  at: string
  operator: string
}
