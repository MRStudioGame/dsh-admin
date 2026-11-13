<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { api } from '@/api'
import { exportCsv } from '@/utils/export'
import type { AuditLog } from '@/types'

const loading = ref(false)
const list = ref<AuditLog[]>([])
const total = ref(0)

const query = reactive({
  page: 1,
  pageSize: 10,
  operator: '',
  action: '',
})

const actions = ['冻结账号', '解封账号', '重置密码', '解绑设备', '强制下线', '修改限流阈值', '导出任务日志', '修改告警规则', '修改系统配置']

async function load() {
  loading.value = true
  try {
    const r = await api.audits({ ...query })
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
  query.operator = ''
  query.action = ''
  search()
}

function exportFile() {
  exportCsv(
    ['操作人', '操作', '目标', '详情', 'IP', '时间'],
    list.value.map((a) => [a.operator, a.action, a.target, a.detail, a.ip, a.createdAt]),
    'audit-logs',
  )
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="panel-card">
      <el-alert type="info" :closable="false" show-icon title="审计日志只读，不可删除或修改，用于安全溯源。" style="margin-bottom: 14px" />
      <div class="toolbar">
        <el-input v-model="query.operator" placeholder="操作人" clearable style="width: 150px" @keyup.enter="search" />
        <el-select v-model="query.action" placeholder="操作类型" clearable style="width: 160px">
          <el-option v-for="a in actions" :key="a" :label="a" :value="a" />
        </el-select>
        <el-button type="primary" @click="search">查询</el-button>
        <el-button @click="reset">重置</el-button>
        <div class="spacer" />
        <el-button @click="exportFile">导出</el-button>
      </div>

      <el-table v-loading="loading" :data="list">
        <el-table-column prop="operator" label="操作人" width="120" />
        <el-table-column prop="action" label="操作" width="140" />
        <el-table-column prop="target" label="目标对象" width="140" />
        <el-table-column prop="detail" label="详情" min-width="200" />
        <el-table-column prop="ip" label="IP" width="130" />
        <el-table-column prop="createdAt" label="时间" width="170" sortable />
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @current-change="load"
          @size-change="search"
        />
      </div>
    </div>
  </div>
</template>
