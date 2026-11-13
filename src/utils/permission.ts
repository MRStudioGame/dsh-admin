// ===== RBAC 权限模型 =====
// 菜单级权限：route.meta.roles 声明哪些角色可访问
// 按钮级权限：v-permission 指令 + hasPerm 函数
import type { RoleCode } from '@/types'

// 角色 → 可访问菜单 key 列表
export const roleMenus: Record<RoleCode, string[]> = {
  super: ['dashboard', 'users', 'devices', 'tasks', 'audit', 'settings'],
  operator: ['dashboard', 'users', 'devices', 'tasks', 'settings'],
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

const rolePerms: Record<RoleCode, PermCode[]> = {
  super: ['user:freeze', 'user:reset', 'user:batch', 'user:export', 'device:unbind', 'task:export', 'online:kick', 'config:edit', 'alert:read'],
  operator: ['user:freeze', 'user:reset', 'user:batch', 'user:export', 'device:unbind', 'task:export', 'online:kick', 'alert:read'],
  viewer: ['user:export', 'task:export', 'alert:read'],
}

export function hasMenu(role: RoleCode, menu: string): boolean {
  return roleMenus[role]?.includes(menu) ?? false
}

export function hasPerm(role: RoleCode, perm: PermCode): boolean {
  return rolePerms[role]?.includes(perm) ?? false
}
