<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import {
  Odometer,
  User,
  Monitor,
  List,
  Document,
  Box,
  Files,
  Upload,
  Setting,
  SwitchButton,
  Fold,
  Expand,
  ArrowDown,
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const collapsed = ref(false)

const menus = [
  { key: 'dashboard', title: '实时监控看板', icon: Odometer, path: '/dashboard' },
  { key: 'users', title: '用户账号管理', icon: User, path: '/users' },
  { key: 'devices', title: '设备绑定管理', icon: Monitor, path: '/devices' },
  { key: 'tasks', title: '任务日志管理', icon: List, path: '/tasks' },
  { key: 'audit', title: '操作审计日志', icon: Document, path: '/audit' },
  { key: 'plugins', title: '插件全生命周期', icon: Box, path: '/plugins' },
  { key: 'plugins-apply', title: '插件申请管理', icon: Files, path: '/plugins/apply' },
  { key: 'releases', title: '客户端版本发布', icon: Upload, path: '/releases' },
  { key: 'settings', title: '系统全局配置', icon: Setting, path: '/settings' },
]

// 按角色过滤菜单
const visibleMenus = computed(() => menus.filter((m) => auth.canMenu(m.key)))

const activeMenu = computed(() => (route.meta.menu as string) || 'dashboard')

function onLogout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="layout">
    <!-- 侧边导航栏 -->
    <aside class="sidebar" :class="{ collapsed }">
      <div class="logo">
        <span class="logo-mark">D</span>
        <span v-if="!collapsed" class="logo-text">DSH Move</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        :collapse="collapsed"
        router
        background-color="transparent"
        text-color="#c7cbd4"
        active-text-color="#ffffff"
        class="menu"
      >
        <el-menu-item v-for="m in visibleMenus" :key="m.key" :index="m.path">
          <el-icon><component :is="m.icon" /></el-icon>
          <template #title>{{ m.title }}</template>
        </el-menu-item>
      </el-menu>
      <div class="sidebar-footer">
        <el-button text class="collapse-btn" @click="collapsed = !collapsed">
          <el-icon><Expand v-if="collapsed" /><Fold v-else /></el-icon>
        </el-button>
      </div>
    </aside>

    <!-- 主内容区 -->
    <div class="main">
      <header class="header">
        <div class="header-title">{{ route.meta.title }}</div>
        <div class="header-right">
          <el-tag size="small" effect="plain">{{ auth.roleName }}</el-tag>
          <el-dropdown @command="onLogout">
            <span class="admin-name">
              <el-icon><User /></el-icon>
              {{ auth.nickname }}
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">
                  <el-icon><SwitchButton /></el-icon> 退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>
      <main class="content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  width: 220px;
  background: #1f2430;
  display: flex;
  flex-direction: column;
  transition: width 0.25s;
  flex-shrink: 0;
}

.sidebar.collapsed {
  width: 64px;
}

.logo {
  height: 56px;
  display: flex;
  align-items: center;
  padding: 0 18px;
  gap: 10px;
  color: #fff;
}

.logo-mark {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: var(--c-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 15px;
  flex-shrink: 0;
}

.logo-text {
  font-weight: 700;
  font-size: 16px;
  white-space: nowrap;
}

.menu {
  flex: 1;
  border-right: none;
  --el-menu-bg-color: transparent;
  --el-menu-hover-bg-color: rgba(255, 255, 255, 0.06);
  --el-menu-active-color: #fff;
}

.menu :deep(.el-menu-item.is-active) {
  background: var(--c-primary);
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.collapse-btn {
  color: #c7cbd4;
  width: 100%;
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  height: 56px;
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 14px;
}

.admin-name {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 14px;
  color: var(--c-text);
  outline: none;
}

.content {
  flex: 1;
  overflow: auto;
  background: var(--c-bg);
}
</style>
