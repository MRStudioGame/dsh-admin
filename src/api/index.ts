// ===== API 门面：Mock / 真实后端统一出口 =====
// 通过 VITE_API_BASE 切换：
//  - 默认（/mock）：走 Mock 引擎（本文件上半部分）
//  - 真实后端：走 http 实例的 REST 调用（下半部分）
// 上层组件只依赖这里的方法签名，切换数据源零改动。

import axios from 'axios'
import http, { isMock } from './http'
import { mockApi } from '@/mock'
import { catalogApi } from '@/mock/catalog'
import type {
  AdminUser,
  AlertItem,
  AuditLog,
  DashboardData,
  DeviceBinding,
  LoginResult,
  OnlineUser,
  PageResult,
  PluginItem,
  PluginStatus,
  ReleasePayload,
  ReleaseRecord,
  SystemConfig,
  TaskLog,
  UserAccount,
} from '@/types'

export interface Api {
  login(username: string, password: string): Promise<LoginResult>
  me(): Promise<AdminUser>
  dashboard(): Promise<DashboardData>
  alerts(): Promise<AlertItem[]>
  markAlertRead(id: string): Promise<boolean>
  onlineUsers(): Promise<OnlineUser[]>
  forceLogout(sessionId: string): Promise<boolean>
  users(query: Record<string, unknown>): Promise<PageResult<UserAccount>>
  freezeUser(id: string, freeze: boolean): Promise<boolean>
  resetPassword(id: string): Promise<{ newPassword: string }>
  batchFreeze(ids: string[], freeze: boolean): Promise<boolean>
  devices(query: Record<string, unknown>): Promise<PageResult<DeviceBinding>>
  unbindDevice(deviceId: string): Promise<boolean>
  tasks(query: Record<string, unknown>): Promise<PageResult<TaskLog>>
  exportTasks(): Promise<Blob>
  audits(query: Record<string, unknown>): Promise<PageResult<AuditLog>>
  getConfig(): Promise<SystemConfig>
  saveConfig(cfg: SystemConfig): Promise<boolean>
  plugins(): Promise<PluginItem[]>
  setPluginStatus(id: string, status: PluginStatus, grayPercent?: number): Promise<boolean>
  releases(): Promise<ReleaseRecord[]>
  publishRelease(payload: ReleasePayload): Promise<boolean>
}

// ── Mock 实现 ──
const mockImpl: Api = {
  ...mockApi,
  ...catalogApi,
  exportTasks: mockApi.exportTasks,
}

// ── 真实后端实现（REST）──
const realImpl: Api = {
  login: (u, p) => http.post('/admin/login', { username: u, password: p }),
  me: () => http.get('/admin/me'),
  dashboard: () => http.get('/dashboard/overview'),
  alerts: () => http.get('/dashboard/alerts'),
  markAlertRead: (id) => http.post(`/dashboard/alerts/${id}/read`),
  onlineUsers: () => http.get('/dashboard/online'),
  forceLogout: (sessionId) => http.post(`/dashboard/online/${sessionId}/logout`),
  users: (q) => http.get('/users', { params: q }),
  freezeUser: (id, freeze) => http.post(`/users/${id}/freeze`, { freeze }),
  resetPassword: (id) => http.post(`/users/${id}/reset-password`),
  batchFreeze: (ids, freeze) => http.post('/users/batch-freeze', { ids, freeze }),
  devices: (q) => http.get('/devices', { params: q }),
  unbindDevice: (deviceId) => http.post(`/devices/${deviceId}/unbind`),
  tasks: (q) => http.get('/tasks', { params: q }),
  exportTasks: () => http.get('/tasks/export', { responseType: 'blob' }),
  audits: (q) => http.get('/audits', { params: q }),
  getConfig: () => http.get('/config'),
  saveConfig: (cfg) => http.post('/config', cfg),
  plugins: () => http.get('/plugins'),
  setPluginStatus: (id, status, grayPercent) =>
    http.post(`/plugins/${id}/status`, { status, grayPercent }),
  releases: () => http.get('/releases'),
  publishRelease: (payload) => http.post('/releases', payload),
}

export const api: Api = isMock ? mockImpl : realImpl

// ── 客户端 App 内更新：版本发布接口 ──────────────────────────────
// 客户端不依赖管理端 UI，直接 GET 同一个清单：
//  - 静态 Pages 部署：GET {BASE_URL}api/app-version.json（public/ 下原样发布）
//  - 接入独立后端后：GET {VITE_API_BASE}/app-version.json
// 字段即「版本信息 / 更新日志 / APK 直链 / MD5 / 包大小」，无明文密钥。
export interface AppRelease {
  app: string
  package: string
  channel: string
  version: string
  build: number
  minSdk: number
  date: string
  notes: string
  changelog: string[]
  apkUrl: string
  apkFallbackUrls: string[]
  md5: string
  sha256: string
  size: number
  force: boolean
}

export async function fetchAppRelease(): Promise<AppRelease> {
  const apiBase = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
  const staticBase = new URL(import.meta.env.BASE_URL, window.location.href).toString()
  const url = apiBase
    ? `${apiBase}/app-version.json`
    : new URL('api/app-version.json', staticBase).toString()
  const res = await axios.get<AppRelease>(url, { params: { t: Date.now() } })
  return res.data
}
