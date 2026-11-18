<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { useAuthStore } from '@/store/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const form = reactive({ username: 'admin', password: '201301' })
const loading = ref(false)

async function onLogin() {
  if (!form.username || !form.password) {
    ElMessage.warning('请输入账号和密码')
    return
  }
  loading.value = true
  try {
    await auth.login(form.username, form.password)
    ElMessage.success('登录成功')
    const redirect = (route.query.redirect as string) || '/dashboard'
    router.push(redirect)
  } catch {
    // 错误已由 http 拦截器统一提示
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="brand">
        <span class="brand-mark">D</span>
        <div class="brand-text">
          <div class="brand-title">DSH Move</div>
          <div class="brand-sub">移动端管理后台</div>
        </div>
      </div>
      <el-form @submit.prevent="onLogin">
        <el-form-item>
          <el-input v-model="form.username" placeholder="管理员账号" size="large" :prefix-icon="User" />
        </el-form-item>
        <el-form-item>
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            size="large"
            :prefix-icon="Lock"
            show-password
            @keyup.enter="onLogin"
          />
        </el-form-item>
        <el-button type="primary" size="large" class="login-btn" :loading="loading" @click="onLogin">
          登 录
        </el-button>
      </el-form>
      <div class="beta-entry"><a href="beta.html" target="_blank">下载测试版</a><span>仅管理员测试通道</span></div>`n      <div class="login-hint">
        演示账号：admin / operator / viewer（密码均为 201301）
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1f2430 0%, #2f54eb 100%);
}

.login-card {
  width: 380px;
  background: #fff;
  border-radius: 12px;
  padding: 40px 36px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 30px;
}

.brand-mark {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: var(--c-primary);
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-title {
  font-size: 20px;
  font-weight: 700;
}

.brand-sub {
  font-size: 12px;
  color: var(--c-text-3);
}

.login-btn {
  width: 100%;
  margin-top: 6px;
}

.beta-entry { margin-top: 16px; padding-top: 14px; border-top: 1px solid #eef0f4; display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12px; }`n.beta-entry a { color: #2f54eb; font-weight: 700; text-decoration: none; }`n.beta-entry span { color: #98a2b3; }`n`n.login-hint {
  margin-top: 20px;
  font-size: 12px;
  color: var(--c-text-3);
  text-align: center;
}
</style>
