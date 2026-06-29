<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue'
import axios from 'axios'
import * as echarts from 'echarts'
import { ElDialog, ElTabs, ElTabPane, ElLoading } from 'element-plus'

const props = defineProps<{
  visible: boolean
  country: string | null
  industry: string | null
  isDark: boolean
}>()

const emit = defineEmits(['update:visible'])

const activeTab = ref('trend')
const loading = ref(false)

const apiBase = 'http://localhost:3000/api'

// ECharts references
const trendChartRef = ref<HTMLElement | null>(null)
const sankeyChartRef = ref<HTMLElement | null>(null)
const scatterChartRef = ref<HTMLElement | null>(null)
const sunburstChartRef = ref<HTMLElement | null>(null)

let trendChart: echarts.ECharts | null = null
let sankeyChart: echarts.ECharts | null = null
let scatterChart: echarts.ECharts | null = null
let sunburstChart: echarts.ECharts | null = null

const initCharts = () => {
  destroyCharts()
  
  if (trendChartRef.value) trendChart = echarts.init(trendChartRef.value)
  if (sankeyChartRef.value) sankeyChart = echarts.init(sankeyChartRef.value)
  if (scatterChartRef.value) scatterChart = echarts.init(scatterChartRef.value)
  if (sunburstChartRef.value) sunburstChart = echarts.init(sunburstChartRef.value)
  
  window.addEventListener('resize', handleResize)
}

const destroyCharts = () => {
  window.removeEventListener('resize', handleResize)
  if (trendChart) { trendChart.dispose(); trendChart = null }
  if (sankeyChart) { sankeyChart.dispose(); sankeyChart = null }
  if (scatterChart) { scatterChart.dispose(); scatterChart = null }
  if (sunburstChart) { sunburstChart.dispose(); sunburstChart = null }
}

const handleResize = () => {
  trendChart?.resize()
  sankeyChart?.resize()
  scatterChart?.resize()
  sunburstChart?.resize()
}

// Fetch and Render
const fetchData = async () => {
  if (!props.visible) return
  loading.value = true
  
  try {
    const res = await axios.get(`${apiBase}/kpi/deep-analysis`, {
      params: {
        country: props.country,
        industry: props.industry
      }
    })
    
    const data = res.data
    
    await nextTick()
    initCharts()
    
    renderTrendChart(data.trend)
    renderSankeyChart(data.sankey)
    renderScatterChart(data.scatter)
    renderSunburstChart(data.sunburst)
    
    // Resize inside tab active change
    handleResize()
  } catch (error) {
    console.error('Failed to fetch deep analysis data', error)
  } finally {
    loading.value = false
  }
}

watch(() => props.visible, (newVal) => {
  if (newVal) {
    activeTab.value = 'trend'
    fetchData()
  } else {
    destroyCharts()
  }
})

watch(() => props.isDark, () => {
  if (props.visible) {
    fetchData()
  }
})

// Tab active change trigger resize to fix width 0 issues
watch(activeTab, () => {
  nextTick(() => {
    handleResize()
  })
})

onUnmounted(() => {
  destroyCharts()
})

const getThemeColors = () => {
  const isDark = props.isDark
  return {
    text: isDark ? '#cbd5e1' : '#475569',
    axisLine: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    splitLine: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    tooltipBg: isDark ? '#1e293b' : '#ffffff',
    tooltipBorder: isDark ? '#38bdf8' : '#cbd5e1',
    tooltipText: isDark ? '#f8fafc' : '#1e293b'
  }
}

// --- Render Functions ---

const renderTrendChart = (data: any[]) => {
  if (!trendChart || !data || data.length === 0) return
  const colors = getThemeColors()
  
  const years = data.map(d => d.year)
  const revenues = data.map(d => d.revenue)
  const caps = data.map(d => d.marketCap)
  
  trendChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: colors.tooltipBg,
      borderColor: colors.tooltipBorder,
      textStyle: { color: colors.tooltipText },
      axisPointer: { type: 'cross' }
    },
    grid: { top: '15%', left: '5%', right: '5%', bottom: '10%', containLabel: true },
    legend: {
      data: ['总营收 (Revenue)', '总市值 (Market Cap)'],
      textStyle: { color: colors.text }
    },
    xAxis: {
      type: 'category',
      data: years,
      axisLine: { lineStyle: { color: colors.axisLine } },
      axisLabel: { color: colors.text }
    },
    yAxis: [
      {
        type: 'value',
        name: '营收 (十亿美元)',
        axisLine: { lineStyle: { color: colors.axisLine } },
        axisLabel: { color: colors.text },
        splitLine: { lineStyle: { color: colors.splitLine } }
      },
      {
        type: 'value',
        name: '市值 (十亿美元)',
        axisLine: { lineStyle: { color: colors.axisLine } },
        axisLabel: { color: colors.text },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: '总营收 (Revenue)',
        type: 'bar',
        barWidth: '35%',
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#38bdf8' },
            { offset: 1, color: '#0284c7' }
          ]),
          borderRadius: [4, 4, 0, 0]
        },
        data: revenues
      },
      {
        name: '总市值 (Market Cap)',
        type: 'line',
        yAxisIndex: 1,
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: { color: '#bc13fe' },
        lineStyle: { width: 3, shadowBlur: 10, shadowColor: 'rgba(188, 19, 254, 0.4)' },
        data: caps
      }
    ]
  })
}

const renderSankeyChart = (data: any) => {
  if (!sankeyChart || !data || !data.nodes || data.nodes.length === 0) return
  const colors = getThemeColors()
  
  sankeyChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
      backgroundColor: colors.tooltipBg,
      borderColor: colors.tooltipBorder,
      textStyle: { color: colors.tooltipText }
    },
    series: [
      {
        type: 'sankey',
        data: data.nodes,
        links: data.links,
        emphasis: { focus: 'adjacency' },
        nodeAlign: 'left',
        nodeWidth: 18,
        nodeGap: 12,
        lineStyle: {
          color: 'gradient',
          curveness: 0.5,
          opacity: 0.35
        },
        label: {
          color: colors.text,
          fontSize: 11,
          fontFamily: 'sans-serif'
        },
        itemStyle: {
          borderWidth: 1,
          borderColor: colors.axisLine
        }
      }
    ]
  })
}

const renderScatterChart = (data: any[]) => {
  if (!scatterChart || !data || data.length === 0) return
  const colors = getThemeColors()
  
  // Extract distinct industries for coloring
  const industries = Array.from(new Set(data.map(d => d[3])))
  const industryColors = ['#38bdf8', '#bc13fe', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6']
  
  scatterChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: colors.tooltipBg,
      borderColor: colors.tooltipBorder,
      textStyle: { color: colors.tooltipText },
      formatter: (params: any) => {
        const val = params.value
        return `
          <div style="font-weight:bold;margin-bottom:4px;">${val[2]}</div>
          <div>行业: ${val[3]}</div>
          <div>营收: $${val[0]}B</div>
          <div>市值: <span style="color:#00f3ff;font-weight:bold;">$${val[1]}B</span></div>
        `
      }
    },
    grid: { top: '15%', left: '5%', right: '5%', bottom: '10%', containLabel: true },
    xAxis: {
      type: 'value',
      name: '营收 (十亿美元)',
      nameLocation: 'middle',
      nameGap: 25,
      axisLine: { lineStyle: { color: colors.axisLine } },
      axisLabel: { color: colors.text },
      splitLine: { lineStyle: { color: colors.splitLine } }
    },
    yAxis: {
      type: 'value',
      name: '市值 (十亿美元)',
      axisLine: { lineStyle: { color: colors.axisLine } },
      axisLabel: { color: colors.text },
      splitLine: { lineStyle: { color: colors.splitLine } }
    },
    series: [
      {
        type: 'scatter',
        data: data,
        symbolSize: (val: any) => Math.max(Math.sqrt(val[1]) * 4, 10),
        itemStyle: {
          color: (params: any) => {
            const ind = params.value[3]
            const colorIdx = industries.indexOf(ind) % industryColors.length
            return industryColors[colorIdx]
          },
          opacity: 0.8,
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.3)'
        }
      }
    ]
  })
}

const renderSunburstChart = (data: any) => {
  if (!sunburstChart || !data || !data.children) return
  const colors = getThemeColors()
  
  sunburstChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: colors.tooltipBg,
      borderColor: colors.tooltipBorder,
      textStyle: { color: colors.tooltipText }
    },
    series: {
      type: 'sunburst',
      data: data.children,
      radius: [0, '90%'],
      sort: undefined,
      emphasis: { focus: 'ancestor' },
      levels: [
        {},
        {
          r0: '0%',
          r: '35%',
          itemStyle: { borderWidth: 2, color: '#0284c7' },
          label: { rotate: 'tangential', color: '#fff', fontSize: 12, fontWeight: 'bold' }
        },
        {
          r0: '35%',
          r: '70%',
          itemStyle: { borderWidth: 1, color: '#3b82f6' },
          label: { rotate: 'tangential', color: '#fff', fontSize: 10 }
        },
        {
          r0: '70%',
          r: '95%',
          itemStyle: { borderWidth: 1, color: '#10b981' },
          label: { position: 'outside', padding: 3, silent: false, color: colors.text, fontSize: 9 }
        }
      ]
    }
  })
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    :title="country ? `${country} - 深度数据分析` : (industry ? `${industry} - 行业深度数据分析` : '深度数据分析')"
    width="80%"
    custom-class="cyber-dialog"
    destroy-on-close
    append-to-body
  >
    <div v-loading="loading" element-loading-background="rgba(15, 23, 42, 0.8)">
      <el-tabs v-model="activeTab" class="cyber-tabs">
        <el-tab-pane label="趋势预测" name="trend">
          <div ref="trendChartRef" class="chart-container"></div>
        </el-tab-pane>
        
        <el-tab-pane label="流向分析" name="sankey">
          <div ref="sankeyChartRef" class="chart-container"></div>
        </el-tab-pane>
        
        <el-tab-pane label="多维对比" name="scatter">
          <div ref="scatterChartRef" class="chart-container"></div>
        </el-tab-pane>
        
        <el-tab-pane label="占比结构" name="sunburst">
          <div ref="sunburstChartRef" class="chart-container"></div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </el-dialog>
</template>

<style>
/* Scoped overrides for cyber futuristic dialog look */
.el-overlay {
  backdrop-filter: blur(8px);
}

.cyber-dialog {
  background: rgba(15, 23, 42, 0.85) !important;
  border: 1px solid rgba(56, 189, 248, 0.3) !important;
  border-radius: 16px !important;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(0, 243, 255, 0.2) !important;
  overflow: hidden;
}

.dark .cyber-dialog {
  background: rgba(15, 23, 42, 0.95) !important;
}

.cyber-dialog .el-dialog__header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-right: 0;
  padding: 20px 24px;
}

.cyber-dialog .el-dialog__title {
  color: #00f3ff !important;
  font-weight: bold;
  font-size: 1.25rem;
  letter-spacing: 0.05em;
  text-shadow: 0 0 8px rgba(0, 243, 255, 0.5);
}

.cyber-dialog .el-dialog__body {
  padding: 24px !important;
  color: #e2e8f0;
}

.cyber-dialog .el-dialog__close {
  color: #94a3b8 !important;
}
.cyber-dialog .el-dialog__close:hover {
  color: #00f3ff !important;
}

/* Cyber tabs style overrides */
.cyber-tabs .el-tabs__item {
  color: #94a3b8 !important;
  font-weight: 500;
  transition: all 0.3s;
}
.cyber-tabs .el-tabs__item.is-active {
  color: #00f3ff !important;
  text-shadow: 0 0 6px rgba(0, 243, 255, 0.4);
}
.cyber-tabs .el-tabs__active-bar {
  background-color: #00f3ff !important;
  box-shadow: 0 0 8px #00f3ff;
}
.cyber-tabs .el-tabs__nav-wrap::after {
  background-color: rgba(255, 255, 255, 0.05) !important;
}

.chart-container {
  width: 100%;
  height: 500px;
  margin-top: 15px;
}
</style>
