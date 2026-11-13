// ===== axios 实例 + 请求拦截（JWT / 签名 / 防重放）=====
import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'

const API_BASE: string = import.meta.env.VITE_API_BASE || '/mock'

export const isMock = API_BASE === '/mock' || API_BASE === ''

const http: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
})

// 请求拦截：附带 JWT、防重放随机 nonce + 时间戳
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('dsh_admin_token') || ''
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // 防重放：随机 nonce + 毫秒时间戳，后端可据此拒绝旧请求
  config.headers['X-Nonce'] = crypto.randomUUID?.() || `${Date.now()}${Math.random()}`
  config.headers['X-Timestamp'] = `${Date.now()}`
  return config
})

// 响应拦截：统一错误处理 + 越权/未授权跳登录
http.interceptors.response.use(
  (resp) => resp.data,
  (err) => {
    const status = err?.response?.status
    const msg = err?.response?.data?.message || err?.message || '请求失败'
    if (status === 401) {
      // 未授权：清会话跳登录
      localStorage.removeItem('dsh_admin_token')
      localStorage.removeItem('dsh_admin_info')
      if (!location.hash.includes('/login')) {
        location.hash = '#/login'
      }
    } else if (status === 403) {
      ElMessage.error('无权限执行此操作')
    } else {
      ElMessage.error(msg)
    }
    return Promise.reject(err)
  },
)

export default http
