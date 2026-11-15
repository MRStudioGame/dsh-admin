// ===== 插件申请收录 Mock 数据 + CRUD =====
// 与客户端「申请收录插件」业务流一一对应；真实后端接入后由 src/api/index.ts 的 realImpl 接管。
import type {
  ApplyAttachment,
  ApplyStatus,
  ApplyType,
  PluginApply,
  VirusStatus,
} from '@/types'

const applyTypeNames: Record<ApplyType, string> = {
  replicate: '复刻电脑版插件',
  developer: '开发者创建',
  idea: '想法分享',
}

const statusNames: Record<ApplyStatus, string> = {
  pending: '待审核',
  reviewing: '审核中',
  approved: '已通过',
  rejected: '已拒绝',
}

const virusNames: Record<VirusStatus, string> = {
  unknown: '未扫描',
  clean: '安全',
  infected: '检出病毒',
}

// 生成临时签名下载链接（模拟 OSS 签名 URL，带过期时间）
function signedUrl(name: string): string {
  const exp = Math.floor(Date.now() / 1000) + 600
  const sign = Math.abs(hashCode(name + exp))
    .toString(36)
    .padStart(8, '0')
  return `https://oss.mrstudio.game/signed/${encodeURIComponent(name)}?sign=${sign}&exp=${exp}`
}

// 图片站内预览地址（可直接在网页打开观看 / 下载）
function previewUrl(seed: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/480/320`
}

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i)
  return h
}

function att(
  name: string,
  kind: 'image' | 'code' | 'doc',
  size: number,
  seed = name,
): ApplyAttachment {
  const isImage = kind === 'image'
  return {
    name,
    mime: isImage ? 'image' : kind === 'code' ? 'application/zip' : 'application/octet-stream',
    size,
    isImage,
    signedUrl: signedUrl(name),
    previewUrl: isImage ? previewUrl(seed) : undefined,
  }
}

let applies: PluginApply[] = [
  {
    id: 'a_01HX9C',
    applicantId: 'u_8f3k2',
    type: 'replicate',
    typeName: applyTypeNames.replicate,
    pluginName: '',
    pcPluginName: '星卡校园',
    description: '希望把 Windows 端「星卡校园」积分与宠物系统移植到手机 Agent，支持断网可用。',
    techNotes: '',
    attachments: [att('星卡校园截图1.png', 'image', 182400, 'xk1'), att('星卡校园截图2.png', 'image', 203100, 'xk2')],
    createdAt: '2026-11-14 21:12',
    status: 'pending',
    statusName: statusNames.pending,
    virus: 'unknown',
    virusName: virusNames.unknown,
    reply: '',
  },
  {
    id: 'a_02KPL7',
    applicantId: 'u_2bd91',
    type: 'developer',
    typeName: applyTypeNames.developer,
    pluginName: '截图工具箱 Pro',
    pcPluginName: '',
    description: '在官方截图工具箱基础上增加长截图自动拼接。',
    techNotes: '宿主 Kotlin 桥接 + 独立 isolate 渲染，遵循沙箱隔离策略；包体 12MB。',
    attachments: [att('screenshot-pro.zip', 'code', 12_582_000), att('预览.png', 'image', 156_000, 'sp1')],
    createdAt: '2026-11-15 09:40',
    status: 'reviewing',
    statusName: statusNames.reviewing,
    virus: 'clean',
    virusName: virusNames.clean,
    reply: '',
  },
  {
    id: 'a_03ZQX1',
    applicantId: 'u_77ac0',
    type: 'idea',
    typeName: applyTypeNames.idea,
    pluginName: '晚间静默播报',
    pcPluginName: '',
    description: '一个想法：晚上 10 点后 Agent 任务完成时只用震动 + 极简文字，不打断家人。',
    techNotes: '',
    attachments: [att('草图.png', 'image', 98_300, 'idea1')],
    createdAt: '2026-11-15 11:05',
    status: 'pending',
    statusName: statusNames.pending,
    virus: 'unknown',
    virusName: virusNames.unknown,
    reply: '',
  },
  {
    id: 'a_04VIR9',
    applicantId: 'u_99zz1',
    type: 'developer',
    typeName: applyTypeNames.developer,
    pluginName: 'crack_helper',
    pcPluginName: '',
    description: '声称是加速插件。',
    techNotes: '无说明。',
    attachments: [att('crack_helper.apk', 'code', 3_210_000), att('malware_sample.bin', 'doc', 512_000)],
    createdAt: '2026-11-15 13:22',
    status: 'pending',
    statusName: statusNames.pending,
    virus: 'infected',
    virusName: virusNames.infected,
    reply: '',
  },
]

function sleep(ms = 200) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

// 简单病毒特征：附件名含 crack / malware / virus / 破解 即判为病毒
function detectVirus(a: PluginApply): boolean {
  return a.attachments.some((f) =>
    /crack|malware|virus|破解|外挂/i.test(f.name),
  )
}

export const applyApi = {
  async pluginApplies(): Promise<PluginApply[]> {
    await sleep()
    return applies.map((a) => ({ ...a, attachments: a.attachments.map((x) => ({ ...x })) }))
  },

  // 回复：触发消息推送（Push Notification）至 App 端（此处模拟推送）
  async replyApply(id: string, text: string): Promise<boolean> {
    await sleep(150)
    applies = applies.map((a) =>
      a.id === id
        ? {
            ...a,
            reply: text,
            status: a.status === 'rejected' ? a.status : 'approved',
            statusName:
              a.status === 'rejected' ? a.statusName : statusNames.approved,
          }
        : a,
    )
    // 模拟向 App 端推送：真实环境走 FCM / 厂商通道
    // eslint-disable-next-line no-console
    console.info(`[push] 已向 ${id} 的申请人推送回复：${text.slice(0, 30)}`)
    return true
  },

  // 删除：soft = 软删除（保留记录标记），否则硬删除
  async deleteApply(id: string, hard = false): Promise<boolean> {
    await sleep(120)
    if (hard) {
      applies = applies.filter((a) => a.id !== id)
    } else {
      applies = applies.map((a) =>
        a.id === id ? { ...a, status: 'rejected', statusName: statusNames.rejected } : a,
      )
    }
    return true
  },

  // 病毒扫描：命中即拒绝并删除申请记录
  async scanApply(
    id: string,
  ): Promise<{ virus: VirusStatus; removed: boolean }> {
    await sleep(400)
    const target = applies.find((a) => a.id === id)
    if (!target) return { virus: 'unknown', removed: false }
    if (detectVirus(target)) {
      applies = applies.filter((a) => a.id !== id)
      return { virus: 'infected', removed: true }
    }
    applies = applies.map((a) =>
      a.id === id ? { ...a, virus: 'clean', virusName: virusNames.clean } : a,
    )
    return { virus: 'clean', removed: false }
  },
}
