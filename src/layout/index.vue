<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { deviceKind } from '@/utils/device'
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
// 手机/平板：侧栏默认收起成抽屉，点汉堡才展开
const drawerOpen = ref(false)
const isCompact = computed(() => deviceKind.value !== 'desktop')

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

// 路由变化后自动收起抽屉，避免挡住内容
watch(() => route.fullPath, () => { drawerOpen.value = false })

// 从手机宽度拉宽到桌面时，清掉抽屉遮罩状态
watch(deviceKind, (v) => { if (v === 'desktop') drawerOpen.value = false })

function onLogout() {
  auth.logout()
  router.push('/login')
}

function onMenuSelect() {
  if (isCompact.value) drawerOpen.value = false
}

onMounted(() => document.body.classList.toggle('is-compact', isCompact.value))
watch(isCompact, (v) => document.body.classList.toggle('is-compact', v))
onBeforeUnmount(() => document.body.classList.remove('is-compact'))
</script>

<template>
  <div class="layout" :class="{ compact: isCompact }">
    <!-- 手机端抽屉遮罩 -->
    <div v-if="isCompact && drawerOpen" class="drawer-mask" @click="drawerOpen = false" />

    <!-- 侧边导航栏：桌面固定，手机端浮层抽屉 -->
    <aside class="sidebar" :class="{ collapsed, open: drawerOpen }">
      <div class="logo">
        <span class="logo-mark">D</span>
        <span v-if="!collapsed || isCompact" class="logo-text">DSH Move</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        :collapse="collapsed && !isCompact"
        router
        background-color="transparent"
        text-color="#c7cbd4"
        active-text-color="#ffffff"
        class="menu"
        @select="onMenuSelect"
      >
        <el-menu-item v-for="m in visibleMenus" :key="m.key" :index="m.path">
          <el-icon><component :is="m.icon" /></el-icon>
          <template #title>{{ m.title }}</template>
        </el-menu-item>
      </el-menu>
      <div v-if="!isCompact" class="sidebar-footer">
        <el-button text class="collapse-btn" @click="collapsed = !collapsed">
          <el-icon><Expand v-if="collapsed" /><Fold v-else /></el-icon>
        </el-button>
      </div>
    </aside>

    <!-- 主内容区 -->
    <div class="main">
      <header class="header">
        <div class="header-left">
          <el-button v-if="isCompact" text class="hamburger" aria-label="展开菜单" @click="drawerOpen = !drawerOpen">
            <span class="burger" :class="{ x: drawerOpen }"><i /><i /><i /></span>
          </el-button>
          <div class="header-title">{{ route.meta.title }}</div>
        </div>
        <div class="header-right">
          <el-tag v-if="!isCompact" size="small" effect="plain">{{ auth.roleName }}</el-tag>
          <el-dropdown @command="onLogout">
            <span class="admin-name">
              <el-icon><User /></el-icon>
              <span class="admin-nick">{{ auth.nickname }}</span>
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
  -webkit-overflow-scrolling: touch;
}

/* ===== 手机 / 平板自适应 ===== */
.drawer-mask {
  position: fixed;
  inset: 0;
  background: rgba(17, 20, 28, 0.5);
  z-index: 999;
  animation: fadeIn 0.18s ease;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.hamburger {
  padding: 0 6px;
  color: var(--c-text);
}

/* 自绘汉堡图标：三横线，展开时变成 X */
.burger {
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  width: 20px;
  height: 20px;
}

.burger i {
  display: block;
  width: 18px;
  height: 2px;
  border-radius: 2px;
  background: var(--c-text);
  transition: transform 0.2s, opacity 0.2s;
}

.burger.x i:nth-child(1) {
  transform: translateY(6px) rotate(45deg);
}

.burger.x i:nth-child(2) {
  opacity: 0;
}

.burger.x i:nth-child(3) {
  transform: translateY(-6px) rotate(-45deg);
}

.layout.compact .sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 248px;
  max-width: 78vw;
  z-index: 1000;
  transform: translateX(-100%);
  transition: transform 0.22s ease;
  box-shadow: 6px 0 24px rgba(0, 0, 0, 0.28);
  padding-top: env(safe-area-inset-top);
}

.layout.compact .sidebar.open {
  transform: translateX(0);
}

.layout.compact .main {
  width: 100%;
}

.layout.compact .header {
  height: 52px;
  padding: 0 8px 0 10px;
  padding-top: env(safe-area-inset-top);
  height: calc(52px + env(safe-area-inset-top));
}

.layout.compact .header-title {
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.layout.compact .header-right {
  gap: 8px;
  flex-shrink: 0;
}

.layout.compact .admin-nick {
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
  vertical-align: middle;
}

.layout.compact .admin-name {
  font-size: 13px;
  gap: 4px;
}

.layout.compact .content {
  padding-bottom: env(safe-area-inset-bottom);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
