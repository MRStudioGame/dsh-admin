import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/store/auth'

// 使用 hash 路由：GitHub Pages 静态托管下无需服务端 rewrite 配置即可正确刷新/直达
const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', public: true },
  },
  {
    path: '/',
    component: () => import('@/layout/index.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '实时监控看板', menu: 'dashboard', roles: ['super', 'operator', 'viewer'] },
      },
      {
        path: 'users',
        name: 'users',
        component: () => import('@/views/users/index.vue'),
        meta: { title: '用户账号管理', menu: 'users', roles: ['super', 'operator', 'viewer'] },
      },
      {
        path: 'devices',
        name: 'devices',
        component: () => import('@/views/devices/index.vue'),
        meta: { title: '设备绑定管理', menu: 'devices', roles: ['super', 'operator', 'viewer'] },
      },
      {
        path: 'tasks',
        name: 'tasks',
        component: () => import('@/views/tasks/index.vue'),
        meta: { title: '任务日志管理', menu: 'tasks', roles: ['super', 'operator', 'viewer'] },
      },
      {
        path: 'audit',
        name: 'audit',
        component: () => import('@/views/audit/index.vue'),
        meta: { title: '操作审计日志', menu: 'audit', roles: ['super', 'viewer'] },
      },
      {
        path: 'plugins',
        name: 'plugins',
        component: () => import('@/views/plugins/index.vue'),
        meta: { title: '插件全生命周期', menu: 'plugins', roles: ['super', 'operator'] },
      },
      {
        path: 'plugins/apply',
        name: 'plugins-apply',
        component: () => import('@/views/plugins/apply.vue'),
        meta: { title: '插件申请管理', menu: 'plugins-apply', roles: ['super', 'operator'] },
      },
      {
        path: 'releases',
        name: 'releases',
        component: () => import('@/views/releases/index.vue'),
        meta: { title: '客户端版本发布', menu: 'releases', roles: ['super', 'operator'] },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/settings/index.vue'),
        meta: { title: '系统全局配置', menu: 'settings', roles: ['super', 'operator'] },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

// 路由守卫：拦截未授权访问
router.beforeEach((to) => {
  document.title = to.meta.title ? `${to.meta.title as string} · DSH Move 管理后台` : 'DSH Move 管理后台'
  const auth = useAuthStore()

  // 公开页放行
  if (to.meta.public) {
    if (to.path === '/login' && auth.loggedIn) return { path: '/dashboard' }
    return true
  }

  // 未登录 → 登录页
  if (!auth.loggedIn) return { path: '/login', query: { redirect: to.fullPath } }

  // 角色无菜单权限 → 首页兜底
  const roles = to.meta.roles as string[] | undefined
  if (roles && !roles.includes(auth.role)) return { path: '/dashboard' }

  return true
})

export default router
