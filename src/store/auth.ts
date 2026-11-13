// ===== Auth 状态 + 会话超时管理 =====
import { defineStore } from 'pinia'
import { api } from '@/api'
import type { AdminUser, RoleCode } from '@/types'
import { hasMenu, hasPerm, type PermCode } from '@/utils/permission'

const TOKEN_KEY = 'dsh_admin_token'
const INFO_KEY = 'dsh_admin_info'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) || '',
    admin: JSON.parse(localStorage.getItem(INFO_KEY) || 'null') as AdminUser | null,
    expiresAt: Number(localStorage.getItem('dsh_admin_exp') || 0),
  }),

  getters: {
    loggedIn: (s) => !!s.token && !!s.admin,
    role: (s): RoleCode => s.admin?.role ?? 'viewer',
    roleName: (s) => s.admin?.roleName ?? '',
    nickname: (s) => s.admin?.nickname ?? '',
  },

  actions: {
    async login(username: string, password: string) {
      const r = await api.login(username, password)
      this.token = r.token
      this.admin = r.admin
      this.expiresAt = r.expiresAt
      localStorage.setItem(TOKEN_KEY, r.token)
      localStorage.setItem(INFO_KEY, JSON.stringify(r.admin))
      localStorage.setItem('dsh_admin_exp', String(r.expiresAt))
      this._startTimeout()
    },

    logout() {
      this.token = ''
      this.admin = null
      this.expiresAt = 0
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(INFO_KEY)
      localStorage.removeItem('dsh_admin_exp')
      this._clearTimeout()
    },

    // 会话超时自动销毁
    _startTimeout() {
      this._clearTimeout()
      const remain = this.expiresAt - Date.now()
      if (remain > 0) {
        ;(this as unknown as { _timer?: number })._timer = window.setTimeout(() => {
          this.logout()
          if (!location.hash.includes('/login')) location.hash = '#/login'
        }, remain)
      }
    },

    _clearTimeout() {
      const t = (this as unknown as { _timer?: number })._timer
      if (t) window.clearTimeout(t)
    },

    canMenu(menu: string): boolean {
      return hasMenu(this.role, menu)
    },

    canPerm(perm: PermCode): boolean {
      return hasPerm(this.role, perm)
    },
  },
})
