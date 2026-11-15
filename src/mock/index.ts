// ===== 业务数据引擎（v2.7.2 真实数据模式）=====
// 已彻底移除测试期机器人账号与全部派生假数据：
//  - 87 个随机中文名账号、500 条任务日志、120 条审计、15 条告警、设备绑定记录全部清空；
//  - 看板不再出现「12843 注册 / 42 在线 / 300~600 任务」等虚构指标，改为真实计数；
//  - 实时推送不再凭空生成假告警、假在线会话。
// 仅保留 3 个管理员登录凭证（删除会导致网站无法登录）。
// 所有业务数据统一落在 localStorage（v2 版本化 key），刷新不丢失、可审计、可清空。

import type {
  AdminUser,
  AlertItem,
  AuditLog,
  DashboardData,
  DeviceBinding,
  KpiCard,
  OnlineUser,
  PageResult,
  SystemConfig,
  TaskLog,
  UserAccount,
} from '@/types'

// ─────────── 工具 ───────────
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const pad = (n: number) => `${n}`.padStart(2, '0')

function nowText(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// ─────────── 本地持久化仓储 ───────────
const STORE_PREFIX = 'dsh_admin_real_v2_'

function loadRows<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function saveRows<T>(key: string, rows: T[]): void {
  try {
    localStorage.setItem(STORE_PREFIX + key, JSON.stringify(rows))
  } catch {
    // 存储配额不足或隐私模式：内存态仍可用，不影响本次操作
  }
}

function loadObject<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + key)
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : { ...fallback }
  } catch {
    return { ...fallback }
  }
}

function saveObject<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value))
  } catch {
    // 同上
  }
}

// ─────────── 管理员登录凭证（非机器人账号，保留）───────────
const ADMIN_PASSWORD = '201301' // 静态站点演示口令；接入真实后端后走哈希 + Secrets

const admins: AdminUser[] = [
  { id: 'a1', username: 'admin', nickname: '超级管理员', role: 'super', roleName: '超级管理员', lastLoginAt: nowText(), status: 'active' },
  { id: 'a2', username: 'operator', nickname: '运营管理员', role: 'operator', roleName: '运营管理员', lastLoginAt: nowText(), status: 'active' },
  { id: 'a3', username: 'viewer', nickname: '只读观察员', role: 'viewer', roleName: '只读观察员', lastLoginAt: nowText(), status: 'active' },
]

let currentAdmin: AdminUser = admins[0]

// ─────────── 业务数据：空库起步（机器人账号已全部清除）───────────
let users: UserAccount[] = loadRows<UserAccount>('users')
let devices: DeviceBinding[] = loadRows<DeviceBinding>('devices')
let tasks: TaskLog[] = loadRows<TaskLog>('tasks')
let audits: AuditLog[] = loadRows<AuditLog>('audits')
let alerts: AlertItem[] = loadRows<AlertItem>('alerts')

const defaultConfig: SystemConfig = {
  rateLimitPerMin: 60,
  dashboardRefreshSec: 5,
  alertThresholdConsecutiveFail: 3,
  alertHighFreqPerMin: 120,
  sessionTimeoutMin: 30,
  allowRemoteLogout: true,
}
let systemConfig: SystemConfig = loadObject<SystemConfig>('config', defaultConfig)

/** 审计留痕：所有管理动作写入真实日志并持久化 */
function audit(action: string, target: string, detail = ''): void {
  audits.unshift({
    id: `aud_${Date.now()}_${rand(100, 999)}`,
    operator: currentAdmin.nickname,
    action,
    target,
    detail,
    ip: '本地会话',
    createdAt: nowText(),
  })
  audits = audits.slice(0, 500)
  saveRows('audits', audits)
}

// ─────────── 看板：全部基于真实数据 ───────────
function zeroSeries(hours: number): { time: string; value: number }[] {
  const now = Date.now()
  const step = (24 / hours) * 3600000
  return Array.from({ length: hours }, (_, i) => {
    const t = new Date(now - (hours - 1 - i) * step)
    return { time: `${pad(t.getHours())}:00`, value: 0 }
  })
}

function genDashboard(): DashboardData {
  const onlineNow = devices.filter((d) => d.online).length
  const activeUsers = users.filter((u) => u.status === 'active').length
  const taskTotal = tasks.length
  const taskSuccess = tasks.filter((t) => t.status === 'success').length
  const taskFailed = tasks.filter((t) => t.status === 'failed').length
  const runningTasks = tasks.filter((t) => t.status === 'running').length

  const kpis: KpiCard[] = [
    { key: 'totalUsers', label: '总注册账号数', value: users.length, trend: 0, trendLabel: '当前', compareType: 'mom' },
    { key: 'online', label: '实时在线设备', value: onlineNow, unit: '台', trend: 0, trendLabel: '当前', compareType: 'mom' },
    { key: 'activeUsers', label: '正常状态账号', value: activeUsers, trend: 0, trendLabel: '当前', compareType: 'mom' },
    { key: 'taskTotal', label: '任务总执行量', value: taskTotal, trend: 0, trendLabel: '当前', compareType: 'mom' },
    { key: 'taskSuccess', label: '任务成功量', value: taskSuccess, trend: 0, trendLabel: '当前', compareType: 'mom' },
    { key: 'taskFailed', label: '任务失败量', value: taskFailed, trend: 0, trendLabel: '当前', compareType: 'mom' },
    { key: 'concurrency', label: '执行中任务', value: runningTasks, unit: '个', trend: 0, trendLabel: '当前', compareType: 'mom' },
  ]

  return {
    kpis,
    onlineTrend: zeroSeries(24),
    registerTrend: zeroSeries(30),
    dailyRegister: zeroSeries(7),
    dailyTasks: zeroSeries(7),
    taskTypeDist: [
      { name: '对话', value: tasks.filter((t) => t.type === 'chat').length },
      { name: 'Agent 任务', value: tasks.filter((t) => t.type === 'agent').length },
      { name: '自动化', value: tasks.filter((t) => t.type === 'automation').length },
    ],
    deviceDist: [],
    funnel: [
      { name: '注册', value: users.length },
      { name: '绑定设备', value: devices.length },
      { name: '发起任务', value: taskTotal },
      { name: '完成任务', value: taskSuccess },
    ],
    concurrency: runningTasks,
  }
}

// ─────────── 实时推送（仅推送真实数据快照，不伪造告警）───────────
type Listener = (data: unknown) => void
const listeners = new Map<string, Set<Listener>>()

function emit(channel: string, data: unknown) {
  listeners.get(channel)?.forEach((fn) => fn(data))
}

let wsTimer: ReturnType<typeof setInterval> | null = null
let wsStarted = false

export function startRealtime() {
  if (wsStarted) return
  wsStarted = true
  wsTimer = setInterval(() => {
    emit('kpi', genDashboard())
    emit('online', genOnlineUsers())
  }, 3000)
}

export function subscribe(channel: string, fn: Listener): () => void {
  if (!listeners.has(channel)) listeners.set(channel, new Set())
  listeners.get(channel)!.add(fn)
  return () => listeners.get(channel)?.delete(fn)
}

export function stopRealtime() {
  if (wsTimer) clearInterval(wsTimer)
  wsStarted = false
}

/** 在线会话：仅来自真实设备绑定，无绑定即为空 */
function genOnlineUsers(): OnlineUser[] {
  return devices.filter((d) => d.online).map((d) => ({
    sessionId: `s_${d.deviceId.slice(-8)}`,
    username: d.username,
    deviceId: d.deviceId,
    deviceShort: d.deviceShort,
    loginAt: d.lastActiveAt,
    clientVersion: d.clientVersion,
    ipRegion: '—',
    lastHeartbeat: nowText(),
  }))
}

// ─────────── 数据引擎 API（与真实后端同签名）───────────
export const mockApi = {
  async login(username: string, password: string) {
    await sleep(400)
    const admin = admins.find((a) => a.username === username)
    if (!admin || password !== ADMIN_PASSWORD || admin.status === 'disabled') {
      throw { response: { status: 401, data: { message: '账号或密码错误' } } }
    }
    currentAdmin = admin
    admin.lastLoginAt = nowText()
    audit('管理员登录', username)
    const token = btoa(`${username}:${Date.now()}:mock-jwt`)
    const expiresAt = Date.now() + systemConfig.sessionTimeoutMin * 60000
    return { token, expiresAt, admin }
  },

  async me() {
    await sleep(100)
    return currentAdmin
  },

  async dashboard(): Promise<DashboardData> {
    await sleep(200)
    return genDashboard()
  },

  async alerts(): Promise<AlertItem[]> {
    await sleep(100)
    return alerts
  },

  async markAlertRead(id: string) {
    alerts = alerts.map((a) => (a.id === id ? { ...a, read: true } : a))
    saveRows('alerts', alerts)
    return true
  },

  async onlineUsers(): Promise<OnlineUser[]> {
    await sleep(100)
    return genOnlineUsers()
  },

  async forceLogout(sessionId: string) {
    await sleep(300)
    const target = genOnlineUsers().find((u) => u.sessionId === sessionId)
    if (target) {
      devices = devices.map((d) =>
        d.deviceId === target.deviceId ? { ...d, online: false } : d,
      )
      saveRows('devices', devices)
    }
    audit('强制下线', sessionId, '远程强制下线会话')
    return true
  },

  // 用户账号（空库起步，支持真实账号写入）
  async users(query: Record<string, unknown>): Promise<PageResult<UserAccount>> {
    await sleep(300)
    let list = [...users]
    if (query.username) list = list.filter((u) => u.username.includes(String(query.username)))
    if (query.status) list = list.filter((u) => u.status === query.status)
    if (query.ipRegion) list = list.filter((u) => u.ipRegion === query.ipRegion)
    const page = Number(query.page) || 1
    const pageSize = Number(query.pageSize) || 10
    const total = list.length
    const start = (page - 1) * pageSize
    return { list: list.slice(start, start + pageSize), total, page, pageSize }
  },

  async freezeUser(id: string, freeze: boolean) {
    await sleep(300)
    const u = users.find((x) => x.id === id)
    if (u) u.status = freeze ? 'frozen' : 'active'
    saveRows('users', users)
    audit(freeze ? '冻结账号' : '解封账号', u?.username || id)
    return true
  },

  async resetPassword(id: string) {
    await sleep(300)
    audit('重置密码', id, '密码已重置为初始密码')
    return { newPassword: '1234' }
  },

  async batchFreeze(ids: string[], freeze: boolean) {
    await sleep(400)
    users.forEach((u) => {
      if (ids.includes(u.id)) u.status = freeze ? 'frozen' : 'active'
    })
    saveRows('users', users)
    audit(freeze ? '批量冻结' : '批量解封', `${ids.length} 个账号`)
    return true
  },

  // 设备绑定
  async devices(query: Record<string, unknown>): Promise<PageResult<DeviceBinding>> {
    await sleep(300)
    let list = [...devices]
    if (query.username) list = list.filter((d) => d.username.includes(String(query.username)))
    if (query.online !== undefined && query.online !== '') list = list.filter((d) => d.online === (query.online === 'true'))
    const page = Number(query.page) || 1
    const pageSize = Number(query.pageSize) || 10
    const total = list.length
    const start = (page - 1) * pageSize
    return { list: list.slice(start, start + pageSize), total, page, pageSize }
  },

  async unbindDevice(deviceId: string) {
    await sleep(300)
    devices = devices.filter((d) => d.deviceId !== deviceId)
    saveRows('devices', devices)
    audit('解绑设备', deviceId)
    return true
  },

  // 任务日志
  async tasks(query: Record<string, unknown>): Promise<PageResult<TaskLog>> {
    await sleep(300)
    let list = [...tasks]
    if (query.username) list = list.filter((t) => t.username.includes(String(query.username)))
    if (query.status) list = list.filter((t) => t.status === query.status)
    if (query.type) list = list.filter((t) => t.type === query.type)
    const page = Number(query.page) || 1
    const pageSize = Number(query.pageSize) || 10
    const total = list.length
    const start = (page - 1) * pageSize
    return { list: list.slice(start, start + pageSize), total, page, pageSize }
  },

  async exportTasks(): Promise<Blob> {
    await sleep(500)
    const header = '任务编号,账号,类型,状态,开始时间,结束时间,耗时(ms),结果,设备\n'
    const rows = tasks.map((t) => `${t.taskNo},${t.username},${t.typeName},${t.statusName},${t.startAt},${t.endAt},${t.durationMs},${t.result},${t.deviceShort}`).join('\n')
    const csv = '\uFEFF' + header + rows
    return new Blob([csv], { type: 'text/csv;charset=utf-8' })
  },

  // 审计日志
  async audits(query: Record<string, unknown>): Promise<PageResult<AuditLog>> {
    await sleep(300)
    let list = [...audits]
    if (query.operator) list = list.filter((a) => a.operator.includes(String(query.operator)))
    if (query.action) list = list.filter((a) => a.action === query.action)
    const page = Number(query.page) || 1
    const pageSize = Number(query.pageSize) || 10
    const total = list.length
    const start = (page - 1) * pageSize
    return { list: list.slice(start, start + pageSize), total, page, pageSize }
  },

  async getConfig(): Promise<SystemConfig> {
    await sleep(200)
    return { ...systemConfig }
  },

  async saveConfig(cfg: SystemConfig) {
    await sleep(400)
    systemConfig = { ...cfg }
    saveObject('config', systemConfig)
    audit('修改系统配置', '全局配置', '更新限流/看板/告警参数')
    return true
  },
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
