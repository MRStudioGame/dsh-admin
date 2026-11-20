<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '@/api'
import { exportCsv } from '@/utils/export'
import type { UserAccount } from '@/types'

const loading = ref(false)
const list = ref<UserAccount[]>([])
const total = ref(0)
const selection = ref<UserAccount[]>([])

const query = reactive({
  page: 1,
  pageSize: 10,
  username: '',
  status: '',
  ipRegion: '',
})

const regions = ['广东·深圳', '北京', '上海', '浙江·杭州', '四川·成都', '湖北·武汉', '江苏·南京', '海外']

async function load() {
  loading.value = true
  try {
    const r = await api.users({ ...query })
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
  query.ipRegion = ''
  search()
}

async function toggleFreeze(row: UserAccount) {
  const freeze = row.status !== 'frozen'
  const tip = freeze ? '冻结后该账号将无法登录与发起任务' : '解封后该账号恢复正常使用'
  await ElMessageBox.confirm(`${freeze ? '冻结' : '解封'}账号「${row.username}」？${tip}`, '确认', { type: 'warning' })
  await api.freezeUser(row.id, freeze)
  ElMessage.success(freeze ? '已冻结' : '已解封')
  load()
}

async function resetPassword(row: UserAccount) {
  await ElMessageBox.confirm(`将「${row.username}」的密码重置为初始密码？`, '确认', { type: 'warning' })
  const r = await api.resetPassword(row.id)
  ElMessageBox.alert(`新密码：${r.newPassword}`, '密码已重置', { confirmButtonText: '知道了' })
}

async function adjustPoints(row: UserAccount) {
  const input = await ElMessageBox.prompt(
    `当前积分：${row.points ?? 0}\n输入调整后的积分（0 起，整数），或输入 +100 / -50 增减。`,
    `调整「${row.username}」的积分`,
    {
      inputValue: String(row.points ?? 0),
      inputPattern: /^[+-]?\d+$/,
      inputErrorMessage: '请输入整数，如 100、+100、-50',
      confirmButtonText: '保存',
      cancelButtonText: '取消',
    },
  )
  const raw = String(input.value).trim()
  const next = raw.startsWith('+') || raw.startsWith('-')
    ? Number(row.points ?? 0) + Number(raw)
    : Number(raw)
  const r = await api.setUserPoints(row.id, next)
  ElMessage.success(`已调整为 ${r.points} 积分`)
  load()
}

async function batchFreeze() {
  if (!selection.value.length) {
    ElMessage.warning('请先勾选账号')
    return
  }
  await ElMessageBox.confirm(`批量冻结 ${selection.value.length} 个账号？`, '确认', { type: 'warning' })
  await api.batchFreeze(selection.value.map((s) => s.id), true)
  ElMessage.success('批量冻结完成')
  load()
}

function exportCsvFile() {
  exportCsv(
    ['账号', 'DeviceId', '状态', '积分', '注册时间', '最后登录', '任务数', '版本', 'IP 属地'],
    list.value.map((u) => [u.username, u.deviceId, u.status === 'active' ? '正常' : '冻结', u.points ?? 0, u.createdAt, u.lastLoginAt, u.taskCount, u.clientVersion, u.ipRegion]),
    'users',
  )
}

function detail(row: UserAccount) {
  ElMessageBox.alert(
    `账号：${row.username}\n设备：${row.deviceShort}\n状态：${row.status === 'active' ? '正常' : '冻结'}\n积分：${row.points ?? 0}\n注册：${row.createdAt}\n最后登录：${row.lastLoginAt}\n任务数：${row.taskCount}\n版本：${row.clientVersion}\nIP 属地：${row.ipRegion}`,
    '账号详情',
    { confirmButtonText: '关闭' },
  )
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="panel-card">
      <!-- 多条件筛选 -->
      <div class="toolbar">
        <el-input v-model="query.username" placeholder="账号关键字" clearable style="width: 180px" @keyup.enter="search" />
        <el-select v-model="query.status" placeholder="状态" clearable style="width: 120px">
          <el-option label="正常" value="active" />
          <el-option label="冻结" value="frozen" />
        </el-select>
        <el-select v-model="query.ipRegion" placeholder="IP 属地" clearable style="width: 140px">
          <el-option v-for="r in regions" :key="r" :label="r" :value="r" />
        </el-select>
        <el-button type="primary" @click="search">查询</el-button>
        <el-button @click="reset">重置</el-button>
        <div class="spacer" />
        <el-button v-perm="'user:batch'" type="danger" plain @click="batchFreeze">批量冻结</el-button>
        <el-button v-perm="'user:export'" @click="exportCsvFile">导出</el-button>
      </div>

      <el-table v-loading="loading" :data="list" @selection-change="selection = $event">
        <el-table-column type="selection" width="46" />
        <el-table-column prop="username" label="账号" min-width="120" />
        <el-table-column prop="deviceShort" label="DeviceId" min-width="110" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">
              {{ row.status === 'active' ? '正常' : '冻结' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="注册时间" width="160" sortable />
        <el-table-column prop="lastLoginAt" label="最后登录" width="160" />
        <el-table-column prop="taskCount" label="任务数" width="90" sortable />
        <el-table-column prop="points" label="积分" width="100" sortable>
          <template #default="{ row }">
            <span class="points-cell">{{ row.points ?? 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="clientVersion" label="版本" width="80" />
        <el-table-column prop="ipRegion" label="IP 属地" width="110" />
        <el-table-column label="操作" width="270" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="detail(row)">详情</el-button>
            <el-button v-perm="'user:points'" link type="success" size="small" @click="adjustPoints(row)">积分</el-button>
            <el-button v-perm="'user:freeze'" link :type="row.status === 'active' ? 'danger' : 'success'" size="small" @click="toggleFreeze(row)">
              {{ row.status === 'active' ? '冻结' : '解封' }}
            </el-button>
            <el-button v-perm="'user:reset'" link type="warning" size="small" @click="resetPassword(row)">重置密码</el-button>
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
