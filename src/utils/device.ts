/**
 * 设备自适应：自动识别手机 / 平板 / 桌面，并把结果写到 <html data-device="...">。
 * 样式层（styles/index.css、各页面 @media）据此切换布局，保证手机端可用。
 */
import { ref } from 'vue'

export type DeviceKind = 'mobile' | 'tablet' | 'desktop'

function ua(): string {
  return navigator.userAgent || ''
}

export function detectDevice(): DeviceKind {
  const u = ua()
  const touch = (navigator.maxTouchPoints ?? 0) > 1
  const vw = window.innerWidth || 0
  // 视口已经达到桌面宽度（含横屏平板 / 折叠屏展开）就按桌面布局，信息密度更高
  if (vw >= 1200) return 'desktop'
  // iPadOS 13+ 伪装成 macOS，用触点数兜底
  const iPad = /iPad/.test(u) || (/Macintosh/.test(u) && touch)
  if (iPad || /Tablet|PlayBook|Silk|Kindle/i.test(u)) return 'tablet'

  // 安卓平板/手机：UA 里 Android 且不带 Mobile 的通常是平板
  if (/Android/i.test(u)) {
    if (!/Mobile/i.test(u)) return 'tablet'
    // 很多安卓平板 UA 也带 Mobile；只要视口够宽就按平板处理
    // （不再要求 maxTouchPoints，某些 webview / 折叠屏浏览器不上报触点数）
    if (window.innerWidth >= 700) return 'tablet'
    return 'mobile'
  }
  if (/iPhone|iPod|Mobile|HarmonyOS|Windows Phone|Mobi/i.test(u)) {
    if (touch && window.innerWidth >= 700 && !/iPhone|iPod/i.test(u)) return 'tablet'
    return 'mobile'
  }
  if (/HarmonyOS|OpenHarmony/i.test(u)) return 'tablet'

  // UA 不可靠时按视口宽度 + 触屏判断（横竖屏都能覆盖）
  const w = window.innerWidth || 0
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
  if (w <= 820 && (touch || coarse)) return 'mobile'
  if (w <= 1180 && (touch || coarse)) return 'tablet'
  return 'desktop'
}

export const deviceKind = ref<DeviceKind>('desktop')

export const isMobile = () => deviceKind.value === 'mobile'
export const isPhoneLike = () => deviceKind.value === 'mobile' || deviceKind.value === 'tablet'

let bound = false

export function applyDeviceClass() {
  const kind = detectDevice()
  deviceKind.value = kind
  const el = document.documentElement
  el.dataset.device = kind
  el.dataset.touch = navigator.maxTouchPoints > 0 ? '1' : '0'

  if (bound) return
  bound = true

  const sync = () => {
    const next = detectDevice()
    if (next === deviceKind.value) return
    deviceKind.value = next
    el.dataset.device = next
    // 注意：这里绝对不能再 dispatch('resize')——它会再次触发本监听器，
    // 造成 Maximum call stack size exceeded。布局切换由 CSS 自行生效，
    // 真正改窗口大小时浏览器本来就会发 resize。
  }
  window.addEventListener('resize', sync, { passive: true })
  window.addEventListener('orientationchange', () => setTimeout(sync, 120))
  // 部分安卓机外层 webview 的 resize 触发不及时，再兜一次
  window.visualViewport?.addEventListener('resize', sync, { passive: true })
}
