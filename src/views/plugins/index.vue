<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '@/api'
import { useAuthStore } from '@/store/auth'
import type { PluginItem, PluginStatus } from '@/types'

const auth = useAuthStore()
const loading = ref(false)
const list = ref<PluginItem[]>([])
const selection = ref<PluginItem[]>([])

const query = reactive({ keyword: '', category: '', status: '' })

const categories = ['UI 美化插件', '实用插件', '娱乐与便利插件', 'AGI 架构探索']
const statusOptions: { label: string; value: PluginStatus }[] = [
  { label: '已上架', value: 'published' },
  { label: '灰度中', value: 'gray' },
  { label: '已下架', value: 'offline' },
  { label: '待发布', value: 'draft' },
]

const filtered = computed(() =>
  list.value.filter((p) => {
    const kw = query.keyword.trim().toLowerCase()
    const hitKw = !kw || p.name.toLowerCase().includes(kw) || p.id.toLowerCase().includes(kw) || p.desc.toLowerCase().includes(kw)
    return hitKw && (!query.category || p.category === query.category) && (!query.status || p.status === query.status)
  }),
)

const stats = computed(() => ({
  total: list.value.length,
  published: list.value.filter((p) => p.status === 'published').length,
  gray: list.value.filter((p) => p.status === 'gray').length,
  draft: list.value.filter((p) => p.status === 'draft').length,
  installs: list.value.reduce((sum, p) => sum + p.installs, 0),
}))

async function load() {
  loading.value = true
  try {
    list.value = await api.plugins()
  } finally {
    loading.value = false
  }
}

function onSelect(rows: PluginItem[]) {
  selection.value = rows
}

function guard(): boolean {
  if (auth.canPerm('plugin:manage')) return true
  ElMessage.warning('当前角色没有插件管理权限')
  return false
}

async function setStatus(row: PluginItem, status: PluginStatus) {
  if (!guard()) return
  let grayPercent = 0
  if (status === 'gray') {
    try {
      const r = await ElMessageBox.prompt('输入灰度比例（1 - 99）', '灰度发布', {
        inputValue: '10',
        inputPattern: /^\d{1,2}$/,
        inputErrorMessage: '请输入 1 - 99 的整数',
      })
      grayPercent = Number(r.value)
      if (grayPercent < 1 || grayPercent > 99) {
        ElMessage.warning('灰度比例需在 1 - 99 之间')
        return
      }
    } catch {
      return
    }
  } else if (status === 'offline') {
    try {
      await ElMessageBox.confirm(`确认下架「${row.name}」？下架后客户端不再展示该插件。`, '下架确认', { type: 'warning' })
    } catch {
      return
    }
  }
  await api.setPluginStatus(row.id, status, grayPercent)
  ElMessage.success(`「${row.name}」已${{ published: '上架', gray: '进入灰度', offline: '下架', draft: '转为待发布' }[status]}`)
  await load()
}

async function batch(status: PluginStatus) {
  if (!guard()) return
  if (!selection.value.length) {
    ElMessage.warning('请先选择插件')
    return
  }
  const ids = selection.value.map((p) => p.id)
  for (const id of ids) await api.setPluginStatus(id, status, status === 'gray' ? 10 : 0)
  ElMessage.success(`已批量处理 ${ids.length} 个插件`)
  await load()
}

type TagType = 'success' | 'warning' | 'info' | 'danger'
const statusTag: Record<PluginStatus, TagType> = {
  published: 'success',
  gray: 'warning',
  offline: 'info',
  draft: 'info',
}
function tagType(status: PluginStatus): TagType {
  return statusTag[status]
}

function fmtNum(n: number) {
  return n >= 10000 ? `${(n / 10000).toFixed(1)} 万` : n.toLocaleString()
}

onMounted(load)
</script>

<template>
  <div class="page" v-loading="loading">
    <div class="page-head">
      <div>
        <h2>插件全生命周期</h2>
        <p>三大分类 + 实时检索；覆盖上架、灰度、下架、回滚与批量操作。客户端操作符统一为 Refresh。</p>
      </div>
    </div>

    <div class="kpi-row">
      <div class="kpi"><span>插件总数</span><b>{{ stats.total }}</b></div>
      <div class="kpi"><span>已上架</span><b>{{ stats.published }}</b></div>
      <div class="kpi"><span>灰度中</span><b>{{ stats.gray }}</b></div>
      <div class="kpi"><span>待发布</span><b>{{ stats.draft }}</b></div>
      <div class="kpi"><span>累计安装</span><b>{{ fmtNum(stats.installs) }}</b></div>
    </div>

    <el-card shadow="never" class="card">
      <div class="toolbar">
        <el-input v-model="query.keyword" placeholder="搜索插件名称 / ID / 简介" clearable style="width: 260px" />
        <el-select v-model="query.category" placeholder="全部分类" clearable style="width: 170px">
          <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
        </el-select>
        <el-select v-model="query.status" placeholder="全部状态" clearable style="width: 140px">
          <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
        <div class="spacer" />
        <el-button size="small" :disabled="!auth.canPerm('plugin:manage')" @click="batch('published')">批量上架</el-button>
        <el-button size="small" :disabled="!auth.canPerm('plugin:manage')" @click="batch('offline')">批量下架</el-button>
      </div>

      <el-table :data="filtered" size="small" stripe @selection-change="onSelect">
        <el-table-column type="selection" width="46" />
        <el-table-column prop="name" label="插件" min-width="150">
          <template #default="{ row }">
            <div class="name-cell">
              <b>{{ row.name }}</b>
              <span>{{ row.id }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="分类" width="150" />
        <el-table-column prop="version" label="版本" width="90" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="tagType(row.status)" size="small">
              {{ row.statusName }}{{ row.status === 'gray' ? ` ${row.grayPercent}%` : '' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="安装量" width="110">
          <template #default="{ row }">{{ fmtNum(row.installs) }}</template>
        </el-table-column>
        <el-table-column label="评分" width="80">
          <template #default="{ row }">{{ row.rating ? row.rating.toFixed(1) : '—' }}</template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="120" />
        <el-table-column prop="desc" label="业务简介" min-width="220" show-overflow-tooltip />
        <el-table-column label="操作" width="190" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" :disabled="!auth.canPerm('plugin:manage')" @click="setStatus(row, 'published')">上架</el-button>
            <el-button link type="warning" size="small" :disabled="!auth.canPerm('plugin:manage')" @click="setStatus(row, 'gray')">灰度</el-button>
            <el-button link type="info" size="small" :disabled="!auth.canPerm('plugin:manage')" @click="setStatus(row, 'offline')">下架</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="foot">共 {{ filtered.length }} 条记录 · 已选 {{ selection.length }} 条</div>
    </el-card>
  </div>
</template>

<style scoped>
.page { padding: 4px 2px 24px; }
.page-head h2 { margin: 0 0 6px; font-size: 20px; font-weight: 650; }
.page-head p { margin: 0; color: #8a94a6; font-size: 12.5px; }
.kpi-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin: 16px 0; }
.kpi { background: #fff; border: 1px solid #eceff5; border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; }
.kpi span { color: #8a94a6; font-size: 12px; }
.kpi b { font-size: 22px; font-weight: 650; }
.card { border-radius: 12px; }
.toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.spacer { flex: 1; }
.name-cell { display: flex; flex-direction: column; line-height: 1.35; }
.name-cell span { color: #9aa3b2; font-size: 11px; font-family: 'SFMono-Regular', Consolas, monospace; }
.foot { margin-top: 12px; color: #9aa3b2; font-size: 12px; }
@media (max-width: 900px) { .kpi-row { grid-template-columns: repeat(2, 1fr); } }
</style>
