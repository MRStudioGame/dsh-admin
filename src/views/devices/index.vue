<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '@/api'
import { exportCsv } from '@/utils/export'
import type { DeviceBinding } from '@/types'

const loading = ref(false)
const list = ref<DeviceBinding[]>([])
const total = ref(0)

const query = reactive({
  page: 1,
  pageSize: 10,
  username: '',
  online: '',
})

async function load() {
  loading.value = true
  try {
    const r = await api.devices({ ...query })
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

async function unbind(row: DeviceBinding) {
  await ElMessageBox.confirm(
    `解绑设备「${row.deviceShort}」？解绑后该设备需重新注册绑定账号。`,
    '确认',
    { type: 'warning' },
  )
  await api.unbindDevice(row.deviceId)
  ElMessage.success('已解绑')
  load()
}

function exportFile() {
  exportCsv(
    ['DeviceId', '账号', '绑定时间', '最后活跃', '版本', '在线状态'],
    list.value.map((d) => [d.deviceId, d.username, d.boundAt, d.lastActiveAt, d.clientVersion, d.online ? '在线' : '离线']),
    'devices',
  )
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="panel-card">
      <div class="toolbar">
        <el-input v-model="query.username" placeholder="账号关键字" clearable style="width: 180px" @keyup.enter="search" />
        <el-select v-model="query.online" placeholder="在线状态" clearable style="width: 130px">
          <el-option label="在线" value="true" />
          <el-option label="离线" value="false" />
        </el-select>
        <el-button type="primary" @click="search">查询</el-button>
        <el-button @click="() => { query.username = ''; query.online = ''; search() }">重置</el-button>
        <div class="spacer" />
        <el-button @click="exportFile">导出</el-button>
      </div>

      <el-table v-loading="loading" :data="list">
        <el-table-column prop="deviceShort" label="DeviceId" min-width="130" />
        <el-table-column prop="username" label="绑定账号" min-width="120" />
        <el-table-column prop="boundAt" label="绑定时间" width="160" sortable />
        <el-table-column prop="lastActiveAt" label="最后活跃" width="160" />
        <el-table-column prop="clientVersion" label="客户端版本" width="110" />
        <el-table-column label="在线状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.online ? 'success' : 'info'" size="small">{{ row.online ? '在线' : '离线' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button v-perm="'device:unbind'" link type="danger" size="small" @click="unbind(row)">解绑设备</el-button>
          </template>
        </el-table-column>
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
