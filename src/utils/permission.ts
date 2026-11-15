// ===== RBAC 权限模型 =====
// 菜单级权限：route.meta.roles 声明哪些角色可访问
// 按钮级权限：v-permission 指令 + hasPerm 函数
import type { RoleCode } from '@/types'

// 角色 → 可访问菜单 key 列表
export const roleMenus: Record<RoleCode, string[]> = {
  super: ['dashboard', 'users', 'devices', 'tasks', 'audit', 'plugins', 'plugins-apply', 'releases', 'settings'],
  operator: ['dashboard', 'users', 'devices', 'tasks', 'plugins', 'plugins-apply', 'releases', 'settings'],
  viewer: ['dashboard', 'users', 'devices', 'tasks', 'audit'],
}

// 按钮级权限点
export type PermCode =
  | 'user:freeze'
  | 'user:reset'
  | 'user:batch'
  | 'user:export'
  | 'device:unbind'
  | 'task:export'
  | 'online:kick'
  | 'config:edit'
  | 'alert:read'
  | 'release:publish'
  | 'plugin:manage'
  | 'plugin:apply'

const rolePerms: Record<RoleCode, PermCode[]> = {
  super: ['user:freeze', 'user:reset', 'user:batch', 'user:export', 'device:unbind', 'task:export', 'online:kick', 'config:edit', 'alert:read', 'release:publish', 'plugin:manage', 'plugin:apply'],
  operator: ['user:freeze', 'user:reset', 'user:batch', 'user:export', 'device:unbind', 'task:export', 'online:kick', 'alert:read', 'plugin:manage', 'plugin:apply'],
  viewer: ['user:export', 'task:export', 'alert:read'],
}

export function hasMenu(role: RoleCode, menu: string): boolean {
  return roleMenus[role]?.includes(menu) ?? false
}

export function hasPerm(role: RoleCode, perm: PermCode): boolean {
  return rolePerms[role]?.includes(perm) ?? false
}
