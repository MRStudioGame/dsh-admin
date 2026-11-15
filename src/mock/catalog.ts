// ===== 插件市场 / 版本发布 Mock 数据 =====
// 与客户端插件目录三大分类保持一致；真实后端接入后由 src/api/index.ts 的 realImpl 接管。
import type { PluginItem, PluginStatus, ReleasePayload, ReleaseRecord, ReleaseStatus } from '@/types'

const statusName: Record<PluginStatus, string> = {
  published: '已上架',
  gray: '灰度中',
  offline: '已下架',
  draft: '待发布',
}

let plugins: PluginItem[] = [
  { id: 'ui_theme', name: '沉浸式主题', category: 'UI 美化插件', author: 'MR Studio', version: '1.8.2', status: 'published', statusName: '已上架', installs: 12840, rating: 4.8, grayPercent: 100, updatedAt: '2026-11-14', desc: '全局配色、圆角与动效统一，支持按会话切换主题。' },
  { id: 'ui_font', name: '字阶精调', category: 'UI 美化插件', author: 'MR Studio', version: '1.2.0', status: 'published', statusName: '已上架', installs: 9261, rating: 4.7, grayPercent: 100, updatedAt: '2026-11-11', desc: '六级字阶与行高，长文阅读与代码块独立字号。' },
  { id: 'ui_motion', name: '弹性动效包', category: 'UI 美化插件', author: 'MR Studio', version: '2.0.1', status: 'gray', statusName: '灰度中', installs: 3410, rating: 4.6, grayPercent: 20, updatedAt: '2026-11-15', desc: '统一 380ms 弹簧曲线与下拉手势回弹。' },
  { id: 'util_notice', name: '通知聚合', category: '实用插件', author: 'MR Studio', version: '3.1.0', status: 'published', statusName: '已上架', installs: 21390, rating: 4.9, grayPercent: 100, updatedAt: '2026-11-13', desc: '长任务前台进度通知，支持暂停与取消。' },
  { id: 'util_screenshot', name: '截图工具箱', category: '实用插件', author: 'MR Studio', version: '1.6.4', status: 'published', statusName: '已上架', installs: 15720, rating: 4.5, grayPercent: 100, updatedAt: '2026-11-09', desc: '区域 / 长截图，敏感信息自动打码归档。' },
  { id: 'modsearch', name: '网页搜索', category: '实用插件', author: 'MR Studio', version: '2.4.0', status: 'published', statusName: '已上架', installs: 18433, rating: 4.7, grayPercent: 100, updatedAt: '2026-11-08', desc: '任务需要外部信息时联网检索并回传来源。' },
  { id: 'util_export', name: '多格式导出', category: '实用插件', author: 'MR Studio', version: '1.9.3', status: 'offline', statusName: '已下架', installs: 7721, rating: 4.2, grayPercent: 0, updatedAt: '2026-10-26', desc: 'docx / xlsx / pdf / html 导出，等待签名更新。' },
  { id: 'fun_pet', name: '桌面宠物', category: '娱乐与便利插件', author: 'MR Studio', version: '1.3.2', status: 'published', statusName: '已上架', installs: 11092, rating: 4.6, grayPercent: 100, updatedAt: '2026-11-07', desc: '跟随任务状态变化的轻量桌面伙伴。' },
  { id: 'fun_voice', name: '语音播报', category: '娱乐与便利插件', author: 'MR Studio', version: '1.1.0', status: 'draft', statusName: '待发布', installs: 0, rating: 0, grayPercent: 0, updatedAt: '2026-11-15', desc: '动作流自然语言播报，适配车载场景。' },
  { id: 'agi_memory', name: '记忆治理', category: 'AGI 架构探索', author: 'MR Studio', version: '0.9.8', status: 'gray', statusName: '灰度中', installs: 842, rating: 4.3, grayPercent: 5, updatedAt: '2026-11-10', desc: '多 Agent 记忆合并与去重，按主题归档。' },
  { id: 'agi_guard', name: '能力守卫', category: 'AGI 架构探索', author: 'MR Studio', version: '1.0.0', status: 'published', statusName: '已上架', installs: 5623, rating: 4.8, grayPercent: 100, updatedAt: '2026-11-15', desc: '常驻能力校验与静默降级自愈。' },
  { id: 'agi_trace', name: '全链路追踪', category: 'AGI 架构探索', author: 'MR Studio', version: '0.7.1', status: 'draft', statusName: '待发布', installs: 0, rating: 0, grayPercent: 0, updatedAt: '2026-11-15', desc: '结构化调试日志矩阵与终态核对表。' },
]

let releases: ReleaseRecord[] = [
  {
    version: '2.4.0', build: 2400, date: '2026-11-15', channel: 'stable', status: 'released', statusName: '已发布',
    apkUrl: 'https://ghfast.top/https://github.com/MRStudioGame/dsh-move/releases/download/v2.4.0/DeepSeek-Harness-Move-2.4.0-arm64.apk',
    md5: '1b62ca8c9b992dc79bc44df6d4fe8ab7',
    sha256: 'b9755abee893fa5870717e2a98833537b9057550fe510ad01fba14af70f8739b',
    size: 39460843, force: false,
    notes: '全局登录状态分流与自研用户信息面板；全应用统一自研弹窗容器；App 内更新。',
    changelog: ['账号入口分流', '统一自研弹窗容器', 'App 内更新链路'],
  },
  {
    version: '2.3.0', build: 2300, date: '2026-11-15', channel: 'stable', status: 'archived', statusName: '已归档',
    apkUrl: 'https://ghfast.top/https://github.com/MRStudioGame/dsh-move/releases/download/v2.3.0/DeepSeek-Harness-Move-2.3.0-arm64.apk',
    md5: 'a1c4e7f90b2d58361a1c4e7f90b2d5836',
    sha256: '369f099dc0bf967392141110d8f8753fc86005148e319f820962ef1dffac1eec',
    size: 39420318, force: false,
    notes: '固化 Agent 常驻能力规约。',
    changelog: ['能力状态持久化', '前置三权限探针', '控件失败重试与上报'],
  },
  {
    version: '2.2.2', build: 2202, date: '2026-11-14', channel: 'stable', status: 'archived', statusName: '已归档',
    apkUrl: 'https://ghfast.top/https://github.com/MRStudioGame/dsh-move/releases/download/v2.2.2/DeepSeek-Harness-Move-2.2.2-arm64.apk',
    md5: '2f020725d4e8b391f6a0c5d7e14b3f8a92',
    sha256: '2f020725d4e8b391f6a0c5d7e14b3f8a92f31c6b0d9e4a7f18c2d5b6e9301aa4c7',
    size: 39380112, force: false,
    notes: '注册密码规则调整为 4 位以上字母或数字。',
    changelog: ['密码规则调整'],
  },
]

function sleep(ms = 200) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export const catalogApi = {
  async plugins(): Promise<PluginItem[]> {
    await sleep()
    return plugins.map((p) => ({ ...p }))
  },

  async setPluginStatus(id: string, status: PluginStatus, grayPercent = 0): Promise<boolean> {
    await sleep(120)
    plugins = plugins.map((p) =>
      p.id === id
        ? { ...p, status, statusName: statusName[status], grayPercent: status === 'gray' ? grayPercent : status === 'published' ? 100 : 0 }
        : p,
    )
    return true
  },

  async releases(): Promise<ReleaseRecord[]> {
    await sleep()
    return releases.map((r) => ({ ...r }))
  },

  async publishRelease(payload: ReleasePayload): Promise<boolean> {
    await sleep(300)
    releases = releases.map((r) => ({ ...r, status: 'archived' as ReleaseStatus, statusName: '已归档' }))
    releases.unshift({
      ...payload,
      date: new Date().toISOString().slice(0, 10),
      status: 'released',
      statusName: '已发布',
    })
    return true
  },
}
