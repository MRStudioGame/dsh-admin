<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, nextTick } from 'vue'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'
import { api } from '@/api'
import { startRealtime, subscribe, stopRealtime } from '@/mock'
import { exportChartPng, exportCsv } from '@/utils/export'
import type { AlertItem, DashboardData, OnlineUser } from '@/types'

// ── 时间维度筛选 ──
const timeRange = ref('24h')
const timeRanges = [
  { label: '小时', value: '1h' },
  { label: '日', value: '24h' },
  { label: '周', value: '7d' },
  { label: '月', value: '30d' },
]

const data = ref<DashboardData | null>(null)
const alerts = ref<AlertItem[]>([])
const onlineUsers = ref<OnlineUser[]>([])
const loading = ref(false)

// 图表实例
const onlineChart = ref<echarts.ECharts>()
const registerChart = ref<echarts.ECharts>()
const barChart = ref<echarts.ECharts>()
const pieChart = ref<echarts.ECharts>()
const devicePieChart = ref<echarts.ECharts>()
const funnelChart = ref<echarts.ECharts>()
const gaugeChart = ref<echarts.ECharts>()

const chartEls = {
  online: ref<HTMLElement>(),
  register: ref<HTMLElement>(),
  bar: ref<HTMLElement>(),
  pie: ref<HTMLElement>(),
  devicePie: ref<HTMLElement>(),
  funnel: ref<HTMLElement>(),
  gauge: ref<HTMLElement>(),
}

// ── 加载看板 ──
async function loadDashboard() {
  loading.value = true
  try {
    data.value = await api.dashboard()
    alerts.value = await api.alerts()
    onlineUsers.value = await api.onlineUsers()
    await nextTick()
    renderCharts()
  } finally {
    loading.value = false
  }
}

// ── 渲染图表 ──
function renderCharts() {
  const d = data.value
  if (!d) return

  // 在线人数折线
  if (!onlineChart.value) onlineChart.value = echarts.init(chartEls.online.value!)
  onlineChart.value.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 30, bottom: 30 },
    xAxis: { type: 'category', data: d.onlineTrend.map((p) => p.time), boundaryGap: false },
    yAxis: { type: 'value', name: '人' },
    series: [
      {
        name: '在线人数',
        type: 'line',
        smooth: true,
        data: d.onlineTrend.map((p) => p.value),
        areaStyle: { opacity: 0.15 },
        itemStyle: { color: '#2f54eb' },
      },
    ],
  })

  // 用户增长趋势
  if (!registerChart.value) registerChart.value = echarts.init(chartEls.register.value!)
  registerChart.value.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 30, bottom: 30 },
    xAxis: { type: 'category', data: d.registerTrend.map((p) => p.time), boundaryGap: false },
    yAxis: { type: 'value', name: '人' },
    series: [
      {
        name: '新增注册',
        type: 'line',
        smooth: true,
        data: d.registerTrend.map((p) => p.value),
        areaStyle: { opacity: 0.15 },
        itemStyle: { color: '#13c2c2' },
      },
    ],
  })

  // 日注册/任务量柱状图
  if (!barChart.value) barChart.value = echarts.init(chartEls.bar.value!)
  barChart.value.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['注册量', '任务量'] },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: d.dailyRegister.map((p) => p.time) },
    yAxis: [
      { type: 'value', name: '注册' },
      { type: 'value', name: '任务' },
    ],
    series: [
      { name: '注册量', type: 'bar', data: d.dailyRegister.map((p) => p.value), itemStyle: { color: '#2f54eb' } },
      { name: '任务量', type: 'bar', yAxisIndex: 1, data: d.dailyTasks.map((p) => p.value), itemStyle: { color: '#13c2c2' } },
    ],
  })

  // 任务类型分布饼图
  if (!pieChart.value) pieChart.value = echarts.init(chartEls.pie.value!)
  pieChart.value.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['40%', '65%'],
        data: d.taskTypeDist,
        label: { formatter: '{b}\n{d}%' },
      },
    ],
  })

  // 设备占比饼图
  if (!devicePieChart.value) devicePieChart.value = echarts.init(chartEls.devicePie.value!)
  devicePieChart.value.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0 },
    series: [{ type: 'pie', radius: '60%', data: d.deviceDist }],
  })

  // 转化漏斗
  if (!funnelChart.value) funnelChart.value = echarts.init(chartEls.funnel.value!)
  funnelChart.value.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c}' },
    series: [
      {
        type: 'funnel',
        left: '10%',
        width: '80%',
        sort: 'descending',
        gap: 2,
        label: { formatter: '{b}' },
        data: d.funnel,
        itemStyle: { opacity: 0.9 },
      },
    ],
  })

  // 并发仪表盘
  if (!gaugeChart.value) gaugeChart.value = echarts.init(chartEls.gauge.value!)
  gaugeChart.value.setOption({
    series: [
      {
        type: 'gauge',
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: 50,
        progress: { show: true, width: 14 },
        axisLine: { lineStyle: { width: 14 } },
        axisTick: { show: false },
        splitLine: { length: 12 },
        pointer: { show: false },
        title: { show: false },
        detail: {
          valueAnimation: true,
          formatter: '{value}',
          fontSize: 28,
          offsetCenter: [0, '0%'],
        },
        data: [{ value: d.concurrency, name: '任务/分' }],
      },
    ],
  })
}

// ── 实时订阅 ──
let unsubs: (() => void)[] = []

onMounted(async () => {
  await loadDashboard()
  // 启动模拟推送（真实后端时由 WebSocket 客户端替代）
  startRealtime()
  unsubs.push(
    subscribe('kpi', (d) => {
      data.value = d as DashboardData
      renderCharts()
    }),
    subscribe('alert', (a) => {
      alerts.value = a as AlertItem[]
    }),
    subscribe('online', (o) => {
      onlineUsers.value = o as OnlineUser[]
    }),
  )
})

onUnmounted(() => {
  unsubs.forEach((u) => u())
  stopRealtime()
  ;[
    onlineChart, registerChart, barChart, pieChart, devicePieChart, funnelChart, gaugeChart,
  ].forEach((c) => c.value?.dispose())
  window.removeEventListener('resize', onResize)
})

function onResize() {
  ;[
    onlineChart, registerChart, barChart, pieChart, devicePieChart, funnelChart, gaugeChart,
  ].forEach((c) => c.value?.resize())
}
window.addEventListener('resize', onResize)

// ── 告警操作 ──
async function markRead(a: AlertItem) {
  if (a.read) return
  await api.markAlertRead(a.id)
  a.read = true
}

// ── 在线用户强制下线 ──
async function kickUser(u: OnlineUser) {
  await api.forceLogout(u.sessionId)
  ElMessage.success(`已强制下线 ${u.username}`)
  onlineUsers.value = await api.onlineUsers()
}

// ── 导出 ──
function exportPng(chart: echarts.ECharts | undefined, name: string) {
  if (chart) exportChartPng(chart, name)
}

function exportKpiCsv() {
  const d = data.value
  if (!d) return
  exportCsv(
    ['指标', '数值', '环比(%)'],
    d.kpis.map((k) => [k.label, k.value, k.trend]),
    'dashboard-kpi',
  )
}

// ── 趋势箭头 ──
function trendClass(t: number) {
  return t >= 0 ? 'up' : 'down'
}
</script>

<template>
  <div class="page dashboard">
    <!-- 时间维度筛选 -->
    <div class="toolbar">
      <el-radio-group v-model="timeRange" size="small">
        <el-radio-button v-for="r in timeRanges" :key="r.value" :value="r.value">{{ r.label }}</el-radio-button>
      </el-radio-group>
      <div class="spacer" />
      <el-button size="small" @click="exportKpiCsv">导出 KPI</el-button>
      <el-button size="small" type="primary" :loading="loading" @click="loadDashboard">刷新</el-button>
    </div>

    <!-- KPI 指标卡片集群 -->
    <div v-if="data" class="kpi-grid">
      <div v-for="k in data.kpis" :key="k.key" class="kpi-card">
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-value">{{ k.value.toLocaleString() }}<span v-if="k.unit" class="kpi-unit">{{ k.unit }}</span></div>
        <div class="kpi-trend">
          <span :class="['trend-tag', trendClass(k.trend)]">
            {{ k.trend >= 0 ? '↑' : '↓' }} {{ Math.abs(k.trend) }}%
          </span>
          <span class="trend-label">{{ k.trendLabel }}</span>
        </div>
      </div>
    </div>

    <!-- 图表组件集 -->
    <div class="chart-grid">
      <div class="panel-card">
        <div class="panel-head">
          <span class="panel-title">在线人数趋势</span>
          <el-button link size="small" @click="exportPng(onlineChart, 'online-trend')">导出PNG</el-button>
        </div>
        <div ref="chartEls.online" class="chart-box" />
      </div>
      <div class="panel-card">
        <div class="panel-head">
          <span class="panel-title">用户增长趋势</span>
          <el-button link size="small" @click="exportPng(registerChart, 'register-trend')">导出PNG</el-button>
        </div>
        <div ref="chartEls.register" class="chart-box" />
      </div>
      <div class="panel-card span-2">
        <div class="panel-head">
          <span class="panel-title">日注册量 / 任务量</span>
          <el-button link size="small" @click="exportPng(barChart, 'daily-stats')">导出PNG</el-button>
        </div>
        <div ref="chartEls.bar" class="chart-box" />
      </div>
      <div class="panel-card">
        <div class="panel-head">
          <span class="panel-title">任务类型分布</span>
          <el-button link size="small" @click="exportPng(pieChart, 'task-type')">导出PNG</el-button>
        </div>
        <div ref="chartEls.pie" class="chart-box" />
      </div>
      <div class="panel-card">
        <div class="panel-head">
          <span class="panel-title">设备占比</span>
          <el-button link size="small" @click="exportPng(devicePieChart, 'device-dist')">导出PNG</el-button>
        </div>
        <div ref="chartEls.devicePie" class="chart-box" />
      </div>
      <div class="panel-card">
        <div class="panel-head">
          <span class="panel-title">注册-登录-发起任务 转化漏斗</span>
          <el-button link size="small" @click="exportPng(funnelChart, 'funnel')">导出PNG</el-button>
        </div>
        <div ref="chartEls.funnel" class="chart-box" />
      </div>
      <div class="panel-card">
        <div class="panel-head">
          <span class="panel-title">实时任务并发速率</span>
          <el-button link size="small" @click="exportPng(gaugeChart, 'concurrency')">导出PNG</el-button>
        </div>
        <div ref="chartEls.gauge" class="chart-box" />
      </div>
    </div>

    <!-- 告警流 + 在线清单 -->
    <div class="bottom-grid">
      <!-- 实时告警滚动流 -->
      <div class="panel-card">
        <div class="panel-title">实时告警</div>
        <el-scrollbar height="320px">
          <div v-for="a in alerts" :key="a.id" class="alert-item" :class="{ unread: !a.read }" @click="markRead(a)">
            <el-tag :type="a.level === 'critical' ? 'danger' : a.level === 'warning' ? 'warning' : 'info'" size="small">
              {{ a.levelName }}
            </el-tag>
            <span class="alert-title">{{ a.title }}</span>
            <span class="alert-detail">{{ a.detail }}</span>
            <span class="alert-time">{{ a.time }}</span>
          </div>
          <el-empty v-if="!alerts.length" description="暂无告警" :image-size="60" />
        </el-scrollbar>
      </div>

      <!-- 在线用户实时清单 -->
      <div class="panel-card">
        <div class="panel-title">在线用户实时清单</div>
        <el-table :data="onlineUsers" size="small" height="320">
          <el-table-column prop="username" label="账号" width="110" />
          <el-table-column prop="deviceShort" label="DeviceId" width="100" />
          <el-table-column prop="loginAt" label="登录时间" width="150" />
          <el-table-column prop="clientVersion" label="版本" width="80" />
          <el-table-column prop="ipRegion" label="IP 属地" width="110" />
          <el-table-column label="操作" width="90">
            <template #default="{ row }">
              <el-button v-perm="'online:kick'" link type="danger" size="small" @click="kickUser(row)">强制下线</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  padding: 16px;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 14px;
}

.kpi-card {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: var(--shadow-card);
}

.kpi-label {
  font-size: 13px;
  color: var(--c-text-2);
}

.kpi-value {
  font-size: 26px;
  font-weight: 700;
  margin: 6px 0;
  color: var(--c-text);
}

.kpi-unit {
  font-size: 13px;
  font-weight: 400;
  color: var(--c-text-3);
  margin-left: 4px;
}

.kpi-trend {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.trend-tag {
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.trend-tag.up {
  color: #d4380d;
  background: #fff1f0;
}

.trend-tag.down {
  color: #389e0d;
  background: #f6ffed;
}

.trend-label {
  color: var(--c-text-3);
}

.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  margin-bottom: 14px;
}

.span-2 {
  grid-column: span 2;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.chart-box {
  height: 260px;
}

.bottom-grid {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 14px;
}

.alert-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 6px;
  border-bottom: 1px solid var(--c-border);
  cursor: pointer;
  font-size: 13px;
}

.alert-item.unread {
  background: #f0f5ff;
}

.alert-title {
  font-weight: 600;
  flex-shrink: 0;
}

.alert-detail {
  color: var(--c-text-2);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alert-time {
  color: var(--c-text-3);
  font-size: 12px;
  flex-shrink: 0;
}

@media (max-width: 1200px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .bottom-grid {
    grid-template-columns: 1fr;
  }
}
</style>
