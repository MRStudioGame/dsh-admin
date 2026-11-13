// ===== API 门面：Mock / 真实后端统一出口 =====
// 通过 VITE_API_BASE 切换：
//  - 默认（/mock）：走 Mock 引擎（本文件上半部分）
//  - 真实后端：走 http 实例的 REST 调用（下半部分）
// 上层组件只依赖这里的方法签名，切换数据源零改动。

import http, { isMock } from './http'
import { mockApi } from '@/mock'
import type {
  AdminUser,
  AlertItem,
  AuditLog,
  DashboardData,
  DeviceBinding,
  LoginResult,
  OnlineUser,
  PageResult,
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
}

// ── Mock 实现 ──
const mockImpl: Api = {
  ...mockApi,
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
}

export const api: Api = isMock ? mockImpl : realImpl
