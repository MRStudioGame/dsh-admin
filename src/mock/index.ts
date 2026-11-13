// ===== Mock 数据引擎 =====
// 提供与真实后端一致的数据结构与行为：
//  - 内存数据源（种子数据 + 随机演化）
//  - 模拟 WebSocket 实时推送（在线人数/KPI/告警）
//  - 短轮询降级接口
// 所有方法签名与 src/api 的真实接口一一对应，切换真实后端零改动。

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

// ─────────── 随机工具 ───────────
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = <T>(arr: readonly T[]): T => arr[rand(0, arr.length - 1)]
const pad = (n: number) => `${n}`.padStart(2, '0')

function randTime(base = Date.now(), spanDays = 30): string {
  const t = base - rand(0, spanDays * 86400000)
  const d = new Date(t)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const REGIONS = ['广东·深圳', '北京', '上海', '浙江·杭州', '四川·成都', '湖北·武汉', '江苏·南京', '海外']
const VERSIONS = ['2.2.2', '2.2.1', '2.2.0', '2.0.3']

const firstNames = ['星', '云', '海', '山', '风', '月', '林', '雪', '晨', '宇']
const secondNames = ['卡', '航', '泽', '宁', '辰', '安', '沐', '昕', '涵', '博']

function genUsername(i: number): string {
  return `${pick(firstNames)}${pick(secondNames)}_${rand(100, 999)}`
}

function shortDevice(id: string): string {
  return id.length <= 10 ? id : `${id.slice(0, 6)}…${id.slice(-4)}`
}

function genDeviceId(): string {
  return `a${rand(100000000, 999999999)}${rand(100000000, 999999999)}`
}

// ─────────── 种子数据 ───────────
const ADMIN_PASSWORD = '201301' // 仅 Mock 用；真实后端走哈希 + Secrets

const admins: AdminUser[] = [
  { id: 'a1', username: 'admin', nickname: '超级管理员', role: 'super', roleName: '超级管理员', lastLoginAt: randTime(), status: 'active' },
  { id: 'a2', username: 'operator', nickname: '运营小王', role: 'operator', roleName: '运营管理员', lastLoginAt: randTime(), status: 'active' },
  { id: 'a3', username: 'viewer', nickname: '观察员小李', role: 'viewer', roleName: '只读观察员', lastLoginAt: randTime(), status: 'active' },
]

const users: UserAccount[] = Array.from({ length: 87 }, (_, i) => {
  const deviceId = genDeviceId()
  const status = i % 9 === 0 ? 'frozen' : 'active'
  return {
    id: `u_${1000 + i}`,
    username: genUsername(i),
    deviceId,
    deviceShort: shortDevice(deviceId),
    status: status as 'active' | 'frozen',
    createdAt: randTime(Date.now(), 120),
    lastLoginAt: randTime(Date.now(), 14),
    taskCount: rand(0, 240),
    clientVersion: pick(VERSIONS),
    ipRegion: pick(REGIONS),
  }
})

const devices: DeviceBinding[] = users.map((u) => ({
  deviceId: u.deviceId,
  deviceShort: u.deviceShort,
  username: u.username,
  boundAt: u.createdAt,
  lastActiveAt: u.lastLoginAt,
  clientVersion: u.clientVersion,
  online: Math.random() > 0.7,
}))

const TASK_TYPES = ['chat', 'agent', 'automation'] as const
const TASK_TYPE_NAMES: Record<string, string> = { chat: '对话', agent: 'Agent 任务', automation: '自动化' }
const TASK_STATUSES = ['success', 'failed', 'running', 'cancelled'] as const
const TASK_STATUS_NAMES: Record<string, string> = { success: '成功', failed: '失败', running: '执行中', cancelled: '已取消' }

const tasks: TaskLog[] = Array.from({ length: 500 }, (_, i) => {
  const type = pick(TASK_TYPES)
  const status = pick(TASK_STATUSES)
  const start = Date.now() - rand(0, 30 * 86400000)
  const duration = rand(300, 120000)
  return {
    id: `t_${20000 + i}`,
    taskNo: `DSH${Date.now().toString().slice(-6)}${i}`.slice(0, 14),
    username: pick(users).username,
    type,
    typeName: TASK_TYPE_NAMES[type],
    status,
    statusName: TASK_STATUS_NAMES[status],
    startAt: randTime(start, 0),
    endAt: status === 'running' ? '' : randTime(start + duration, 0),
    durationMs: status === 'running' ? 0 : duration,
    result: status === 'success' ? '任务执行完成' : status === 'failed' ? '执行异常：节点超时' : '',
    deviceShort: pick(devices).deviceShort,
  }
})

const auditActions = ['冻结账号', '解封账号', '重置密码', '解绑设备', '强制下线', '修改限流阈值', '导出任务日志', '修改告警规则']
const audits: AuditLog[] = Array.from({ length: 120 }, (_, i) => ({
  id: `aud_${i}`,
  operator: pick(admins).nickname,
  action: pick(auditActions),
  target: pick(users).username,
  detail: '操作详情留痕',
  ip: `10.0.${rand(0, 255)}.${rand(0, 255)}`,
  createdAt: randTime(Date.now(), 30),
}))

let alerts: AlertItem[] = Array.from({ length: 15 }, (_, i) => {
  const level = pick(['info', 'warning', 'critical'] as const)
  return {
    id: `al_${i}`,
    level,
    levelName: level === 'info' ? '提示' : level === 'warning' ? '警告' : '严重',
    title: pick(['高频请求触发限流', '任务连续异常', '异常设备访问', '并发负载过高', '新设备首次登录']),
    detail: pick(users).username,
    time: randTime(Date.now(), 3),
    read: Math.random() > 0.5,
  }
})

let systemConfig: SystemConfig = {
  rateLimitPerMin: 60,
  dashboardRefreshSec: 5,
  alertThresholdConsecutiveFail: 3,
  alertHighFreqPerMin: 120,
  sessionTimeoutMin: 30,
  allowRemoteLogout: true,
}

// 在线人数演化基线
let onlineBase = 42
let concurrencyBase = 8

// ─────────── 看板数据生成 ───────────
function genSeries(hours: number, base: number, amp: number): { time: string; value: number }[] {
  const now = Date.now()
  const out: { time: string; value: number }[] = []
  const step = (24 / hours) * 3600000
  for (let i = hours - 1; i >= 0; i--) {
    const t = new Date(now - i * step)
    const v = Math.max(0, Math.round(base + Math.sin((i / hours) * Math.PI * 2) * amp + rand(-3, 3)))
    out.push({ time: `${pad(t.getHours())}:00`, value: v })
  }
  return out
}

function genDashboard(): DashboardData {
  const onlineNow = onlineBase + rand(-4, 6)
  const regToday = rand(8, 30)
  const taskTotal = rand(300, 600)
  const taskSuccess = Math.round(taskTotal * (0.78 + Math.random() * 0.1))
  const taskFailed = taskTotal - taskSuccess

  const kpis: KpiCard[] = [
    { key: 'totalUsers', label: '总注册账号数', value: 12843, trend: 12.4, trendLabel: '较上月', compareType: 'mom' },
    { key: 'online', label: '实时在线用户', value: onlineNow, unit: '人', trend: 5.2, trendLabel: '较昨日', compareType: 'mom' },
    { key: 'regToday', label: '今日新增注册', value: regToday, trend: -3.1, trendLabel: '较昨日', compareType: 'mom' },
    { key: 'taskTotal', label: '任务总执行量', value: taskTotal, trend: 18.9, trendLabel: '较昨日', compareType: 'mom' },
    { key: 'taskSuccess', label: '任务成功量', value: taskSuccess, trend: 21.3, trendLabel: '较昨日', compareType: 'mom' },
    { key: 'taskFailed', label: '任务失败量', value: taskFailed, trend: -8.6, trendLabel: '较昨日', compareType: 'mom' },
    { key: 'concurrency', label: '系统并发负载', value: concurrencyBase + rand(-2, 4), unit: '任务/分', trend: 7.7, trendLabel: '较昨日', compareType: 'mom' },
  ]

  return {
    kpis,
    onlineTrend: genSeries(24, 40, 18),
    registerTrend: genSeries(30, 20, 12),
    dailyRegister: genSeries(7, 18, 8),
    dailyTasks: genSeries(7, 420, 120),
    taskTypeDist: [
      { name: '对话', value: Math.round(taskTotal * 0.52) },
      { name: 'Agent 任务', value: Math.round(taskTotal * 0.33) },
      { name: '自动化', value: Math.round(taskTotal * 0.15) },
    ],
    deviceDist: [
      { name: '小米', value: rand(30, 40) },
      { name: '华为', value: rand(20, 30) },
      { name: 'OPPO', value: rand(15, 22) },
      { name: 'vivo', value: rand(12, 20) },
      { name: '其他', value: rand(8, 15) },
    ],
    funnel: [
      { name: '注册', value: 12843 },
      { name: '登录', value: 9850 },
      { name: '发起任务', value: 6340 },
      { name: '完成任务', value: 5110 },
    ],
    concurrency: concurrencyBase + rand(-2, 4),
  }
}

// ─────────── 模拟实时推送（WebSocket 风格）───────────
type Listener = (data: unknown) => void
const listeners = new Map<string, Set<Listener>>()

function emit(channel: string, data: unknown) {
  listeners.get(channel)?.forEach((fn) => fn(data))
}

let wsTimer: ReturnType<typeof setInterval> | null = null
let wsStarted = false

/** 启动模拟实时推送（每 3 秒推在线人数 + KPI 快照 + 随机告警） */
export function startRealtime() {
  if (wsStarted) return
  wsStarted = true
  wsTimer = setInterval(() => {
    onlineBase = Math.max(8, onlineBase + rand(-3, 3))
    concurrencyBase = Math.max(2, concurrencyBase + rand(-2, 2))
    emit('kpi', genDashboard())
    emit('online', genOnlineUsers())
    // 随机新告警
    if (Math.random() > 0.6) {
      const level = pick(['info', 'warning', 'critical'] as const)
      const a: AlertItem = {
        id: `al_${Date.now()}`,
        level,
        levelName: level === 'info' ? '提示' : level === 'warning' ? '警告' : '严重',
        title: pick(['高频请求触发限流', '任务连续异常', '异常设备访问', '并发负载过高']),
        detail: pick(users).username,
        time: randTime(),
        read: false,
      }
      alerts = [a, ...alerts].slice(0, 50)
      emit('alert', alerts)
    }
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

// ─────────── 在线用户 ───────────
function genOnlineUsers(): OnlineUser[] {
  const count = Math.max(3, onlineBase)
  return Array.from({ length: Math.min(count, 30) }, () => {
    const u = pick(users)
    return {
      sessionId: `s_${rand(10000, 99999)}`,
      username: u.username,
      deviceId: u.deviceId,
      deviceShort: u.deviceShort,
      loginAt: randTime(Date.now(), 1),
      clientVersion: u.clientVersion,
      ipRegion: u.ipRegion,
      lastHeartbeat: randTime(),
    }
  })
}

// ─────────── Mock API 实现（与真实接口同签名）───────────
export const mockApi = {
  // 登录
  async login(username: string, password: string) {
    await sleep(400)
    const admin = admins.find((a) => a.username === username)
    if (!admin || password !== ADMIN_PASSWORD || admin.status === 'disabled') {
      throw { response: { status: 401, data: { message: '账号或密码错误' } } }
    }
    const token = btoa(`${username}:${Date.now()}:mock-jwt`)
    const expiresAt = Date.now() + (systemConfig.sessionTimeoutMin * 60000)
    return { token, expiresAt, admin }
  },

  async me() {
    await sleep(100)
    return admins[0]
  },

  // 看板
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
    return true
  },

  async onlineUsers(): Promise<OnlineUser[]> {
    await sleep(100)
    return genOnlineUsers()
  },

  async forceLogout(sessionId: string) {
    await sleep(300)
    audits.unshift({
      id: `aud_${Date.now()}`,
      operator: '超级管理员',
      action: '强制下线',
      target: sessionId,
      detail: '远程强制下线会话',
      ip: '10.0.0.1',
      createdAt: randTime(),
    })
    return true
  },

  // 用户账号
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
    audits.unshift({ id: `aud_${Date.now()}`, operator: '超级管理员', action: freeze ? '冻结账号' : '解封账号', target: u?.username || id, detail: '', ip: '10.0.0.1', createdAt: randTime() })
    return true
  },

  async resetPassword(id: string) {
    await sleep(300)
    audits.unshift({ id: `aud_${Date.now()}`, operator: '超级管理员', action: '重置密码', target: id, detail: '密码已重置为初始密码', ip: '10.0.0.1', createdAt: randTime() })
    return { newPassword: '1234' }
  },

  async batchFreeze(ids: string[], freeze: boolean) {
    await sleep(400)
    users.forEach((u) => { if (ids.includes(u.id)) u.status = freeze ? 'frozen' : 'active' })
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
    const idx = devices.findIndex((d) => d.deviceId === deviceId)
    if (idx >= 0) devices.splice(idx, 1)
    audits.unshift({ id: `aud_${Date.now()}`, operator: '超级管理员', action: '解绑设备', target: deviceId, detail: '', ip: '10.0.0.1', createdAt: randTime() })
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

  // 系统配置
  async getConfig(): Promise<SystemConfig> {
    await sleep(200)
    return { ...systemConfig }
  },

  async saveConfig(cfg: SystemConfig) {
    await sleep(400)
    systemConfig = { ...cfg }
    audits.unshift({ id: `aud_${Date.now()}`, operator: '超级管理员', action: '修改系统配置', target: '全局配置', detail: '更新限流/看板/告警参数', ip: '10.0.0.1', createdAt: randTime() })
    return true
  },
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
