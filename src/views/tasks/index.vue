<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '@/api'
import { exportCsv } from '@/utils/export'
import type { TaskLog } from '@/types'

const loading = ref(false)
const list = ref<TaskLog[]>([])
const total = ref(0)
const exporting = ref(false)

const query = reactive({
  page: 1,
  pageSize: 10,
  username: '',
  status: '',
  type: '',
})

async function load() {
  loading.value = true
  try {
    const r = await api.tasks({ ...query })
    list.value = r.list
    total.value = r.total
  } finally {
    loading.value = false
  }
}

function search() {
  query.page = 1
  load()
}

function reset() {
  query.username = ''
  query.status = ''
  query.type = ''
  search()
}

function detail(row: TaskLog) {
  ElMessageBox.alert(
    `任务编号：${row.taskNo}\n账号：${row.username}\n类型：${row.typeName}\n状态：${row.statusName}\n开始：${row.startAt}\n结束：${row.endAt || '—'}\n耗时：${row.durationMs} ms\n结果：${row.result || '—'}\n设备：${row.deviceShort}`,
    '任务详情',
    { confirmButtonText: '关闭' },
  )
}

async function exportExcel() {
  exporting.value = true
  try {
    // 真实后端：请求全量 Excel/CSV 二进制；Mock：全量 CSV
    const blob = await api.exportTasks()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `任务日志_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } finally {
    exporting.value = false
  }
}

function exportPage() {
  exportCsv(
    ['任务编号', '账号', '类型', '状态', '开始时间', '结束时间', '耗时(ms)', '结果', '设备'],
    list.value.map((t) => [t.taskNo, t.username, t.typeName, t.statusName, t.startAt, t.endAt, t.durationMs, t.result, t.deviceShort]),
    'tasks-page',
  )
}

const statusType: Record<string, string> = {
  success: 'success',
  failed: 'danger',
  running: 'warning',
  cancelled: 'info',
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="panel-card">
      <div class="toolbar">
        <el-input v-model="query.username" placeholder="账号" clearable style="width: 150px" @keyup.enter="search" />
        <el-select v-model="query.status" placeholder="任务状态" clearable style="width: 130px">
          <el-option label="成功" value="success" />
          <el-option label="失败" value="failed" />
          <el-option label="执行中" value="running" />
          <el-option label="已取消" value="cancelled" />
        </el-select>
        <el-select v-model="query.type" placeholder="任务类型" clearable style="width: 130px">
          <el-option label="对话" value="chat" />
          <el-option label="Agent 任务" value="agent" />
          <el-option label="自动化" value="automation" />
        </el-select>
        <el-button type="primary" @click="search">查询</el-button>
        <el-button @click="reset">重置</el-button>
        <div class="spacer" />
        <el-button @click="exportPage">导出本页</el-button>
        <el-button v-perm="'task:export'" type="primary" :loading="exporting" @click="exportExcel">批量导出 Excel</el-button>
      </div>

      <el-table v-loading="loading" :data="list">
        <el-table-column prop="taskNo" label="任务编号" min-width="150" />
        <el-table-column prop="username" label="账号" width="110" />
        <el-table-column prop="typeName" label="类型" width="100" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="(statusType[row.status] as any) || 'info'" size="small">{{ row.statusName }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="startAt" label="开始时间" width="160" sortable />
        <el-table-column prop="endAt" label="结束时间" width="160" />
        <el-table-column label="耗时" width="100">
          <template #default="{ row }">{{ row.durationMs ? `${(row.durationMs / 1000).toFixed(1)}s` : '—' }}</template>
        </el-table-column>
        <el-table-column prop="deviceShort" label="设备" width="110" />
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="detail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="load"
          @size-change="search"
        />
      </div>
    </div>
  </div>
</template>
