<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import axios from 'axios'
import { ChatDotRound, Refresh, TrendCharts, Money, User, Opportunity, Moon, Sunny, Download, Share, Search } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import html2canvas from 'html2canvas'
import { GridLayout, GridItem } from 'grid-layout-plus'
import { io } from 'socket.io-client'
import { countryGeoMap } from './utils/countriesGeo'
import * as echarts from 'echarts'
import 'echarts-gl'
import DeepAnalysisDialog from './components/DeepAnalysisDialog.vue'

const { t, locale } = useI18n()

// Theme and Language
const isDark = ref(true)
const toggleTheme = () => {
  isDark.value = !isDark.value
  if (isDark.value) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  updateChartTheme()
}
const toggleLang = () => {
  locale.value = locale.value === 'zh' ? 'en' : 'zh'
}

// API Base
const apiBase = 'http://localhost:3000/api'

// KPI Data
const kpi = ref({
  total: 0,
  marketCap: 0,
  avgRevenue: 0,
  countries: 0
})

// Filters
const filters = ref<any>({
  industry: '',
  country: ''
})
const filterOptions = ref<any>({ industries: [], countries: [] })

const tableData = ref<any[]>([])
const countrySpan = ref<number[]>([])
const industrySpan = ref<number[]>([])

const tableSearchQuery = ref('')

const filteredTableData = computed(() => {
  const query = tableSearchQuery.value.trim().toLowerCase()
  if (!query) return tableData.value
  
  return tableData.value.filter(item => {
    const countryText = (item.country || '').toLowerCase()
    const industryText = (item.industry || '').toLowerCase()
    const nameText = (item.name || '').toLowerCase()
    
    const localizedCountry = item.country ? t(item.country).toLowerCase() : ''
    const localizedIndustry = item.industry ? t(item.industry).toLowerCase() : ''
    const localizedName = item.name ? t(item.name).toLowerCase() : ''
    
    return countryText.includes(query) || 
           industryText.includes(query) || 
           nameText.includes(query) ||
           localizedCountry.includes(query) ||
           localizedIndustry.includes(query) ||
           localizedName.includes(query)
  })
})

watch(filteredTableData, (newVal) => {
  computeSpans(newVal)
}, { immediate: true })

const maxMarketCap = computed(() => {
  const vals = tableData.value.map(c => parseFloat(c.marketCap) || 0)
  return vals.length > 0 ? Math.max(...vals) : 1
})

const maxRevenue = computed(() => {
  const vals = tableData.value.map(c => parseFloat(c.revenue) || 0)
  return vals.length > 0 ? Math.max(...vals) : 1
})

const showDiagnoseDialog = ref(false)
const diagnoseLoading = ref(false)
const diagnoseResult = ref('')
const selectedCompany = ref<any>(null)

const handleRowClick = async (row: any) => {
  selectedCompany.value = row
  showDiagnoseDialog.value = true
  diagnoseLoading.value = true
  diagnoseResult.value = ''
  
  try {
    const res = await axios.post(`${apiBase}/ai/diagnose`, {
      name: row.name,
      industry: row.industry,
      country: row.country,
      marketCap: row.marketCap,
      revenue: row.revenue
    })
    diagnoseResult.value = res.data.diagnosis
  } catch (e) {
    console.error('Failed to diagnose company', e)
    diagnoseResult.value = '系统繁忙，无法获取 AI 诊断结果。'
  } finally {
    diagnoseLoading.value = false
  }
}

function computeSpans(data: any[]) {
  countrySpan.value = []
  industrySpan.value = []
  let countryPos = 0
  let industryPos = 0
  
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      countrySpan.value.push(1)
      industrySpan.value.push(1)
      countryPos = 0
      industryPos = 0
    } else {
      if (data[i].country === data[i - 1].country) {
        countrySpan.value[countryPos] += 1
        countrySpan.value.push(0)
      } else {
        countrySpan.value.push(1)
        countryPos = i
      }
      
      if (data[i].country === data[i - 1].country && data[i].industry === data[i - 1].industry) {
        industrySpan.value[industryPos] += 1
        industrySpan.value.push(0)
      } else {
        industrySpan.value.push(1)
        industryPos = i
      }
    }
  }
}

const tableSpanMethod = ({ rowIndex, columnIndex }: any) => {
  if (columnIndex === 0) {
    const rowspan = countrySpan.value[rowIndex]
    return { rowspan, colspan: rowspan > 0 ? 1 : 0 }
  }
  if (columnIndex === 1) {
    const rowspan = industrySpan.value[rowIndex]
    return { rowspan, colspan: rowspan > 0 ? 1 : 0 }
  }
}

// Chart Data
const industryChartOptions = ref({})
const countryChartOptions = ref({})
const topCompaniesChartOptions = ref({})
let rawTrendData: any = null

// Drill-down State
const drilledCountry = ref<string | null>(null)
const countryCompanies = ref<any[]>([])
const countryChartRef = ref<any>(null)

// Custom AI Charts
const customCharts = ref<any[]>([])
const getCustomChart = (id: string) => customCharts.value.find(c => c.id === id)

// Socket.io Realtime Data
const socket = io('http://localhost:3000', {
  reconnection: import.meta.env.DEV,
  reconnectionAttempts: 5,
  timeout: 5000
})
const realtimeData = ref<any>(null)

socket.on('realtime_update', (data) => {
  realtimeData.value = data
  if (data.fluctuations && rawTrendData && rawTrendData.countries) {
    let changed = false;
    rawTrendData.countries.forEach((c: any) => {
      if (data.fluctuations[c.name]) {
        // Apply random mock fluctuation, ensure it doesn't go below 0
        c.count = Math.max(0, Math.floor(c.count * (1 + data.fluctuations[c.name])));
        changed = true;
      }
    });
    // Dynamically update charts if not currently drilling down
    if (changed && !drilledCountry.value) {
      updateChartTheme(true);
    }
  }
})

// Layout Data
const defaultLayout = [
  { x: 0, y: 0, w: 6, h: 12, i: 'countryChart' },
  { x: 6, y: 0, w: 6, h: 12, i: 'industryChart' },
  { x: 0, y: 12, w: 12, h: 12, i: 'topCompaniesChart' },
  { x: 0, y: 24, w: 12, h: 12, i: 'dataTable' }
]

const layout = ref([...defaultLayout])

const globeChartOptions = ref<any>({})
let globeChartInstance: echarts.ECharts | null = null;
const setupGlobe = (el: any) => {
  if (el && !globeChartInstance) {
    globeChartInstance = echarts.init(el);
    const ro = new ResizeObserver(() => globeChartInstance?.resize());
    ro.observe(el);
    globeChartInstance.setOption(globeChartOptions.value);
  }
}
watch(globeChartOptions, (newVal) => {
  if (globeChartInstance) {
    globeChartInstance.setOption(newVal);
  }
}, { deep: true })

const updateChartTheme = (isRealtime = false) => {
  if (!rawTrendData) return
  
  const textColor = isDark.value ? '#cbd5e1' : '#475569'
  const splitLineColor = isDark.value ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'

  const buildChart = (data: any[], colorStops: any[], isLog = false) => {
    return {
      backgroundColor: 'transparent',
      tooltip: { 
        trigger: 'axis', 
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          let html = '';
          params.forEach((p: any) => {
            html += `<div style="display:flex;align-items:center;gap:8px;">${p.marker} <span style="font-weight:bold">${p.name ? t(p.name) : ''}</span>: ${p.value.toLocaleString()}</div>`
          })
          return html;
        } 
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: data.map(i => i.name), triggerEvent: true, axisLabel: { color: textColor, interval: 0, rotate: 30, formatter: (val: string) => val ? t(val) : '' } },
      yAxis: { type: isLog ? 'log' : 'value', logBase: 10, axisLabel: { color: textColor }, splitLine: { lineStyle: { color: splitLineColor } } },
      series: [
        {
          type: 'bar',
          barWidth: '40%',
          barMinHeight: 15,
          animationDurationUpdate: 500, // Smooth transition for real-time pulse
          label: {
            show: true,
            position: 'top',
            color: textColor,
            formatter: (p: any) => {
              const val = p.data.rawCount !== undefined ? p.data.rawCount : p.value;
              return val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val;
            }
          },
          itemStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops },
            borderRadius: [4, 4, 0, 0]
          },
          data: data.map(i => ({ value: Math.max(i.count || i.value, 1), rawCount: i.count || i.value }))
        }
      ]
    }
  }

  // Generate Cyberpunk Grid Texture
  const generateGridTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= 18; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * (canvas.height / 18));
      ctx.lineTo(canvas.width, i * (canvas.height / 18));
      ctx.stroke();
    }
    for (let i = 0; i <= 36; i++) {
      ctx.beginPath();
      ctx.moveTo(i * (canvas.width / 36), 0);
      ctx.lineTo(i * (canvas.width / 36), canvas.height);
      ctx.stroke();
    }
    return canvas.toDataURL('image/png');
  }

  // Globe chart
  const countryData = rawTrendData.countries || [];
  const globeSeriesData = countryData.map((c: any) => {
    const coords = countryGeoMap[c.name] || (c.name ? countryGeoMap[c.name.split(' ')[0]] : null) || [0, 0];
    return {
      name: c.name || 'Unknown',
      value: [coords[0], coords[1], 0],
      rawCount: c.count
    }
  }).filter((i: any) => i.value[0] !== 0);

  const globeBorder = isDark.value ? '#1e293b' : '#cbd5e1';
  const globeBg = isDark.value ? '#0f172a' : '#f8fafc';
  
  const globeConfig: any = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => `${p.name}: ${p.data.rawCount.toLocaleString()}`
    },
    globe: {
      baseTexture: generateGridTexture(),
      environment: 'none',
      shading: 'lambert',
      light: {
        main: { intensity: 2, shadow: true, alpha: 40, beta: 30 },
        ambient: { intensity: 0.4 }
      }
    },
    series: [
      {
        type: 'scatter3D',
        coordinateSystem: 'globe',
        data: globeSeriesData,
        symbolSize: (val: any, params: any) => Math.max(Math.log(params.data.rawCount + 1) * 1.5, 3),
        shading: 'color',
        itemStyle: {
          color: '#00f3ff', // Neon Cyan
          opacity: 1
        },
        blendMode: 'lighter',
        animationDurationUpdate: 1000,
        animationEasingUpdate: 'cubicOut'
      }
    ]
  };

  if (!isRealtime) {
    if (!globeChartOptions.value.globe) {
      globeConfig.globe.viewControl = {
        autoRotate: true,
        autoRotateSpeed: 4,
        targetCoord: [116.46, 39.92], // Default Asia view
        distance: 220
      };
      globeChartOptions.value = globeConfig;
    } else {
      if (globeChartInstance) {
        // Full update when theme changes
        globeChartInstance.setOption(globeConfig);
      }
    }
  }

  industryChartOptions.value = buildChart(rawTrendData.industries || [], [{ offset: 0, color: '#3b82f6' }, { offset: 1, color: '#10b981' }])
  
  if (drilledCountry.value) {
    const drillData = countryCompanies.value.map(c => ({
      name: c.name,
      value: c.marketCap,
      raw: c
    }))
    
    countryChartOptions.value = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const c = params.data.raw
          if (!c) return params.name;
          return `
            <div style="padding: 8px;">
              <div style="font-weight: bold; margin-bottom: 4px; font-size: 14px;">${c.name ? t(c.name) : ''}</div>
              <div style="color: #cbd5e1; font-size: 12px; margin-bottom: 4px;">${c.industry ? t(c.industry) : ''}</div>
              <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1);">
                <strong>${t('totalMarketCap')}:</strong> <span style="color: #00f3ff;">$${c.marketCap}B</span>
              </div>
            </div>
          `
        }
      },
      series: [
        {
          name: 'Top Companies',
          type: 'treemap',
          width: '94%',
          height: '85%',
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          itemStyle: {
            borderColor: isDark.value ? '#0f172a' : '#fff',
            borderWidth: 2,
            gapWidth: 2,
            borderRadius: 4
          },
          label: {
            show: true,
            formatter: '{b}\n\n${c}B',
            color: '#fff',
            fontSize: 12,
            fontWeight: 'bold',
            overflow: 'truncate'
          },
          levels: [
            {
              itemStyle: {
                borderColor: '#00f3ff',
                borderWidth: 1,
                gapWidth: 2
              }
            }
          ],
          color: ['#00f3ff', '#bc13fe', '#3b82f6', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6'],
          colorMappingBy: 'value',
          data: drillData
        }
      ]
    }
  } else {
    countryChartOptions.value = buildChart(rawTrendData.countries || [], [{ offset: 0, color: '#8b5cf6' }, { offset: 1, color: '#ec4899' }], true)
  }
  
  topCompaniesChartOptions.value = buildChart(rawTrendData.topCompanies || [], [{ offset: 0, color: '#f59e0b' }, { offset: 1, color: '#ef4444' }])
}

const fetchFilters = async () => {
  try {
    const res = await axios.get(`${apiBase}/kpi/filters`)
    filterOptions.value = res.data
  } catch (e) { console.error('Error fetching filters', e) }
}

const fetchDashboardData = async () => {
  try {
    drilledCountry.value = null
    countryCompanies.value = []
    const params = { ...filters.value };
    Object.keys(params).forEach(k => { if (!params[k]) delete params[k] });

    const [summaryRes, distRes, tableRes] = await Promise.all([
      axios.get(`${apiBase}/kpi/summary`, { params }),
      axios.get(`${apiBase}/kpi/distributions`, { params }),
      axios.get(`${apiBase}/kpi/companies`, { params })
    ])
    
    kpi.value = summaryRes.data
    rawTrendData = distRes.data
    
    tableData.value = tableRes.data.sort((a: any, b: any) => {
      if (a.country === b.country) {
        return a.industry.localeCompare(b.industry)
      }
      return a.country.localeCompare(b.country)
    })
    computeSpans(tableData.value)
    
    updateChartTheme()
  } catch (error) { console.error('Error fetching data', error) }
}

const fetchCountryCompanies = async (country: string) => {
  try {
    const params = { ...filters.value, country }
    Object.keys(params).forEach(k => { if (!params[k]) delete params[k] })
    const res = await axios.get(`${apiBase}/kpi/companies`, { params })
    countryCompanies.value = res.data
    drilledCountry.value = country
    updateChartTheme()
  } catch (e) { console.error('Error fetching country companies', e) }
}

const showAnalysisDialog = ref(false)
const selectedCountryForAnalysis = ref<string | null>(null)
const selectedIndustryForAnalysis = ref<string | null>(null)

const triggerDeepAnalysis = (country: string | null, industry: string | null) => {
  selectedCountryForAnalysis.value = country
  selectedIndustryForAnalysis.value = industry
  showAnalysisDialog.value = true
}

const handleCountryChartClick = (params: any) => {
  const clickedName = params.name || params.value; 
  if (clickedName) {
    triggerDeepAnalysis(clickedName, null);
  }
}

const handleIndustryChartClick = (params: any) => {
  const clickedName = params.name || params.value;
  if (clickedName) {
    triggerDeepAnalysis(null, clickedName);
  }
}

const handleZrClick = (params: any) => {
  // Find the ECharts instance by DOM to safely use containPixel
  let chart = countryChartRef.value?.chart || countryChartRef.value?.getEchartsInstance?.();
  if (!chart && countryChartRef.value?.$el) {
    // Try global echarts instance fallback
    const echartsObj = (window as any).echarts;
    if (echartsObj) {
      chart = echartsObj.getInstanceByDom(countryChartRef.value.$el);
    }
  }
  
  if (!chart || typeof chart.containPixel !== 'function') return;

  const pointInPixel = [params.offsetX, params.offsetY];
  if (chart.containPixel('grid', pointInPixel)) {
    const xIndex = chart.convertFromPixel({ seriesIndex: 0 }, pointInPixel)[0];
    const countryData = rawTrendData?.countries || [];
    const dataItem = countryData[xIndex];
    if (dataItem && dataItem.name) {
      triggerDeepAnalysis(dataItem.name, null);
    }
  }
}

const resetDrillDown = () => {
  drilledCountry.value = null
  countryCompanies.value = []
  updateChartTheme()
}

// AI Chat Logic
const showAiPanel = ref(false)
const chatInput = ref('')
const isAiTyping = ref(false)
const chatHistory = ref<any[]>([
  { role: 'assistant', content: '您好！我是智能大屏专属 AI 助手。您可以问我关于各行各业的分布情况，或者直接要求我画一张图表，比如：**“帮我分析中美两国的半导体分布，并生成图表”**。' }
])

// AI Drag Logic
const aiBtnPos = ref({ x: -1, y: -1 })
let isAiDragging = false
let aiDragStartX = 0, aiDragStartY = 0
let aiInitialX = 0, aiInitialY = 0

const initAiBtnPosition = () => {
  if (aiBtnPos.value.x === -1) {
    aiBtnPos.value = {
      x: window.innerWidth - 80,
      y: window.innerHeight - 80
    }
  }
}

const handleAiDragStart = (e: MouseEvent | TouchEvent) => {
  isAiDragging = false
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
  
  aiDragStartX = clientX
  aiDragStartY = clientY
  aiInitialX = aiBtnPos.value.x
  aiInitialY = aiBtnPos.value.y

  document.addEventListener('mousemove', handleAiDragMove)
  document.addEventListener('touchmove', handleAiDragMove, { passive: false })
  document.addEventListener('mouseup', handleAiDragEnd)
  document.addEventListener('touchend', handleAiDragEnd)
}

const handleAiDragMove = (e: MouseEvent | TouchEvent) => {
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
  
  const dx = clientX - aiDragStartX
  const dy = clientY - aiDragStartY
  
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
    isAiDragging = true
  }
  
  if (isAiDragging) {
    if (e.cancelable) e.preventDefault()
    aiBtnPos.value = {
      x: Math.min(Math.max(0, aiInitialX + dx), window.innerWidth - 60),
      y: Math.min(Math.max(0, aiInitialY + dy), window.innerHeight - 60)
    }
  }
}

const handleAiDragEnd = () => {
  document.removeEventListener('mousemove', handleAiDragMove)
  document.removeEventListener('touchmove', handleAiDragMove)
  document.removeEventListener('mouseup', handleAiDragEnd)
  document.removeEventListener('touchend', handleAiDragEnd)
}

const handleAiBtnClick = () => {
  if (!isAiDragging) {
    showAiPanel.value = true
  }
}

const quickPrompts = [
  "分析中美两国的半导体和软件服务分布",
  "画一张图表示全球Top 10的行业占比",
  "预测明年各科技巨头的市值增长趋势"
];

const useQuickPrompt = (prompt: string) => {
  chatInput.value = prompt;
  sendChatMessage();
}

const chatBody = ref<HTMLElement | null>(null)

watch(chatHistory, () => {
  setTimeout(() => {
    if (chatBody.value) chatBody.value.scrollTop = chatBody.value.scrollHeight
  }, 100)
}, { deep: true })

const parseMessageContent = (text: string) => {
  const parts = [];
  const regex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.substring(lastIndex, match.index).replace(/\n/g, '<br/>') });
    }
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.type === 'chart' && parsed.options) {
        parts.push(parsed);
      } else {
        parts.push({ type: 'text', content: match[0].replace(/\n/g, '<br/>') });
      }
    } catch (e) {
      console.warn("Chart parse error:", e);
      // Fallback: try finding the first '{' and last '}' inside the block just in case there is leading/trailing text
      try {
        const str = match[1];
        const first = str.indexOf('{');
        const last = str.lastIndexOf('}');
        if (first >= 0 && last >= 0) {
          const parsed = JSON.parse(str.substring(first, last + 1));
          if (parsed.type === 'chart' && parsed.options) {
            parts.push(parsed);
            lastIndex = regex.lastIndex;
            continue;
          }
        }
      } catch (err) {}
      parts.push({ type: 'text', content: match[0].replace(/\n/g, '<br/>') });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIndex).replace(/\n/g, '<br/>') });
  }
  return parts;
}

const addChartToDashboard = (chartData: any) => {
  const id = 'ai_chart_' + Date.now();
  customCharts.value.push({ id, ...chartData });
  layout.value.push({ x: 0, y: 100, w: 6, h: 12, i: id }); 
}

const removeChartFromDashboard = (id: string) => {
  layout.value = layout.value.filter(item => item.i !== id);
  customCharts.value = customCharts.value.filter(c => c.id !== id);
}

const sendChatMessage = async () => {
  if (!chatInput.value.trim()) return
  
  const userMsg = chatInput.value
  chatHistory.value.push({ role: 'user', content: userMsg })
  chatInput.value = ''
  isAiTyping.value = true
  
  chatHistory.value.push({ role: 'assistant', content: '' })
  const replyIndex = chatHistory.value.length - 1

  try {
    const messagesToSend = chatHistory.value.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
    const response = await fetch(`${apiBase}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messagesToSend })
    })

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let done = false
    let buffer = ''
    
    while (!done && reader) {
      const { value, done: readerDone } = await reader.read()
      done = readerDone
      if (value) {
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          if (line.trim().startsWith('data: ')) {
            const dataStr = line.trim().slice(6)
            if (dataStr === '[DONE]') {
              done = true
              break
            }
            try {
              const data = JSON.parse(dataStr)
              chatHistory.value[replyIndex].content += data.text || ''
            } catch (e) {
              // Ignore parse error on partial or broken JSON
            }
          }
        }
      }
    }
  } catch (e) {
    chatHistory.value[replyIndex].content = 'Sorry, there was an error connecting to the AI.'
  } finally {
    isAiTyping.value = false
  }
}

watch(locale, () => {
  updateChartTheme()
})

// Export and Share Logic
const exportDashboard = async () => {
  const target = document.querySelector('main') as HTMLElement
  if (!target) {
    ElMessage.error('未能找到大屏主体区域')
    return
  }
  
  const loading = ElMessage({ message: '正在渲染高清快照，请稍候...', type: 'info', duration: 0 })
  try {
    const canvas = await html2canvas(target, {
      backgroundColor: isDark.value ? '#0f172a' : '#f8fafc',
      scale: 2,
      useCORS: true,
      logging: false,
      ignoreElements: (el) => el.classList.contains('cyber-loader')
    })
    const link = document.createElement('a')
    link.download = `CyberDashboard_Snapshot_${Date.now()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    loading.close()
    ElMessage.success('大屏长图已成功导出！')
  } catch (err) {
    console.error(err)
    loading.close()
    ElMessage.error('导出过程发生错误')
  }
}

const generateShareLink = () => {
  try {
    const state = { layout: layout.value, filters: filters.value, customCharts: customCharts.value }
    const base64 = btoa(encodeURIComponent(JSON.stringify(state)))
    const url = new URL(window.location.href)
    url.hash = `share=${base64}`
    navigator.clipboard.writeText(url.toString())
    ElMessage.success('分享链接已复制到剪贴板！发送给同事即可 1:1 复原此仪表盘')
  } catch (err) {
    console.error(err)
    ElMessage.error('分享链接生成失败')
  }
}

onMounted(() => {
  if (document.documentElement.classList.contains('dark')) {
    isDark.value = true
  }
  fetchFilters()
  fetchDashboardData()
  
  const hash = window.location.hash
  if (hash.startsWith('#share=')) {
    try {
      const base64 = hash.replace('#share=', '')
      const jsonStr = decodeURIComponent(atob(base64))
      const state = JSON.parse(jsonStr)
      if (state.layout) layout.value = state.layout
      if (state.filters) filters.value = state.filters
      if (state.customCharts) customCharts.value = state.customCharts
      
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      ElMessage.success('已成功从分享链接复原大屏布局！')
      
      // Delay fetch to apply filters
      setTimeout(fetchDashboardData, 100)
    } catch (e) {
      console.error('Invalid share link', e)
      ElMessage.warning('分享链接已失效或解析失败')
    }
  }
  
  const savedLayout = localStorage.getItem('dashboard_layout_v2')
  const savedCharts = localStorage.getItem('dashboard_custom_charts')
  if (savedLayout) {
    try {
      layout.value = JSON.parse(savedLayout)
      // Ensure dataTable is added for existing users
      if (!layout.value.some(item => item.i === 'dataTable')) {
        layout.value.push({ x: 0, y: 24, w: 12, h: 12, i: 'dataTable' })
      }
    } catch (e) {
      console.error(e)
    }
  }
  if (savedCharts) {
    try { customCharts.value = JSON.parse(savedCharts) } catch (e) {}
  }
  
  initAiBtnPosition()
  window.addEventListener('resize', initAiBtnPosition)
})

onUnmounted(() => {
  window.removeEventListener('resize', initAiBtnPosition)
})

watch(layout, (newVal) => {
  localStorage.setItem('dashboard_layout_v2', JSON.stringify(newVal))
}, { deep: true })
watch(customCharts, (newVal) => {
  localStorage.setItem('dashboard_custom_charts', JSON.stringify(newVal))
}, { deep: true })

</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-dark-900 transition-colors duration-300 relative overflow-hidden text-slate-800 dark:text-slate-200">
    <!-- Animated background elements -->
    <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary-500/10 blur-[120px] pointer-events-none"></div>
    <div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-neon-purple/10 blur-[120px] pointer-events-none"></div>
    
    <!-- Immersive 3D Globe Background -->
    <div class="fixed inset-0 z-0 flex items-center justify-center opacity-80 mix-blend-screen pointer-events-none">
      <div v-if="Object.keys(globeChartOptions).length > 0" :ref="setupGlobe" class="w-[120%] h-[120%]"></div>
    </div>
    
    <!-- AI Floating Action Button -->
    <div 
      class="fixed z-[100] cursor-move touch-none"
      :style="aiBtnPos.x !== -1 ? { left: aiBtnPos.x + 'px', top: aiBtnPos.y + 'px' } : { bottom: '1.5rem', right: '1.5rem' }"
      @mousedown="handleAiDragStart"
      @touchstart="handleAiDragStart"
      @click="handleAiBtnClick"
    >
      <el-button 
        class="!p-4 shadow-xl shadow-primary-500/30 hover:scale-110 transition-transform pointer-events-none" 
        type="primary" 
        circle 
        size="large">
        <el-icon size="24"><ChatDotRound /></el-icon>
      </el-button>
    </div>

    <header class="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center px-8 py-6 mb-2 border-b border-white/10 bg-white/40 dark:bg-dark-800/40 backdrop-blur-md">
      <div>
        <h1 class="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-neon-blue to-neon-purple mb-2 tracking-tight pb-1 leading-normal">
          {{ t('title') }} 2.0
        </h1>
        <p class="text-slate-500 dark:text-slate-400 text-sm font-medium">{{ t('subtitle') }}</p>
      </div>
      
      <div class="flex items-center gap-3 mt-4 md:mt-0">
        <el-button @click="exportDashboard" :icon="Download" circle class="!bg-white/80 dark:!bg-dark-800/80 dark:!text-slate-300" title="导出超清快照" />
        <el-button @click="generateShareLink" :icon="Share" circle class="!bg-white/80 dark:!bg-dark-800/80 dark:!text-slate-300" title="生成只读分享链接" />
        <el-button @click="toggleLang" plain class="!bg-white/80 dark:!bg-dark-800/80 dark:!text-slate-300">
          {{ locale === 'zh' ? 'EN' : '中文' }}
        </el-button>
        <el-button @click="toggleTheme" circle :icon="isDark ? Sunny : Moon" class="!bg-white/80 dark:!bg-dark-800/80 dark:!text-slate-300" />
        <el-button @click="fetchDashboardData" :icon="Refresh" circle class="!bg-white/80 dark:!bg-dark-800/80 dark:!text-slate-300" />
        <el-button @click="showAiPanel = true" type="primary" :icon="ChatDotRound" class="shadow-lg shadow-neon-blue/30 hidden md:flex">
          {{ t('askAi') }}
        </el-button>
      </div>
    </header>

    <main class="relative z-10 space-y-6 px-8 pb-10">
      
      <!-- Filters -->
      <div class="glass-panel p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
        <el-select v-model="filters.industry" :placeholder="t('filterIndustry')" clearable @change="fetchDashboardData" class="w-full">
          <el-option v-for="item in filterOptions.industries" :key="item.value" :label="item.label ? t(item.label) : ''" :value="item.value" />
        </el-select>
        <el-select v-model="filters.country" :placeholder="t('filterCountry')" clearable @change="fetchDashboardData" class="w-full">
          <el-option v-for="item in filterOptions.countries" :key="item.value" :label="item.label ? t(item.label) : ''" :value="item.value" />
        </el-select>
      </div>

      <!-- KPI Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div class="glass-panel p-6 hover:-translate-y-1 transition-transform duration-300">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{{ t('totalCompanies') }}</p>
              <h3 class="text-2xl font-bold text-slate-800 dark:text-white">{{ kpi.total }}</h3>
            </div>
            <div class="p-3 bg-blue-100 dark:bg-blue-500/20 rounded-lg text-blue-600 dark:text-blue-400"><el-icon size="20"><TrendCharts /></el-icon></div>
          </div>
        </div>

        <div class="glass-panel p-6 hover:-translate-y-1 transition-transform duration-300">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{{ t('totalMarketCap') }}</p>
              <h3 class="text-2xl font-bold text-slate-800 dark:text-white">{{ Math.round(kpi.marketCap).toLocaleString() }}</h3>
            </div>
            <div class="p-3 bg-green-100 dark:bg-green-500/20 rounded-lg text-green-600 dark:text-green-400"><el-icon size="20"><Money /></el-icon></div>
          </div>
        </div>

        <div class="glass-panel p-6 hover:-translate-y-1 transition-transform duration-300">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{{ t('avgRevenue') }}</p>
              <h3 class="text-2xl font-bold text-slate-800 dark:text-white">{{ Math.round(kpi.avgRevenue).toLocaleString() }}</h3>
            </div>
            <div class="p-3 bg-purple-100 dark:bg-purple-500/20 rounded-lg text-purple-600 dark:text-purple-400"><el-icon size="20"><User /></el-icon></div>
          </div>
        </div>

        <div class="glass-panel p-6 hover:-translate-y-1 transition-transform duration-300">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{{ t('totalCountries') }}</p>
              <h3 class="text-2xl font-bold text-slate-800 dark:text-white">{{ kpi.countries }}</h3>
            </div>
            <div class="p-3 bg-amber-100 dark:bg-amber-500/20 rounded-lg text-amber-600 dark:text-amber-400"><el-icon size="20"><Opportunity /></el-icon></div>
          </div>
        </div>
        
        <!-- Real-time Status Card -->
        <div class="glass-panel p-6 relative overflow-hidden flex flex-col justify-center">
          <div v-if="realtimeData" class="absolute inset-0 border-[2px] border-neon-blue rounded-2xl animate-glow-border pointer-events-none"></div>
          <div class="flex justify-between items-start z-10">
            <div>
              <p class="text-neon-blue text-sm font-medium mb-1 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-neon-blue animate-pulse"></span>
                实时活跃访问
              </p>
              <h3 class="text-3xl font-bold text-white drop-shadow-[0_0_8px_rgba(0,243,255,0.8)]">
                {{ realtimeData ? realtimeData.activeUsers : '--' }}
              </h3>
            </div>
          </div>
        </div>
      </div>

      <!-- Drag and Drop Grid Layout Area -->
      <div class="mt-8">
        <h2 class="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <el-icon><TrendCharts /></el-icon> 智能洞察工作台
        </h2>
        <div class="-mx-4">
          <GridLayout
            v-model:layout="layout"
            :col-num="12"
            :row-height="18"
            :is-draggable="true"
            :is-resizable="true"
            :vertical-compact="true"
            :margin="[20, 20]"
            :use-css-transforms="false"
            drag-allow-from=".drag-handle"
            drag-ignore-from=".echarts-container"
          >
            <GridItem
              v-for="item in layout"
              :key="item.i"
              :x="item.x"
              :y="item.y"
              :w="item.w"
              :h="item.h"
              :i="item.i"
              class="glass-panel flex flex-col p-4 group hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,243,255,0.12)] transition-all duration-300"
            >
              <!-- Delete button for custom charts -->
              <el-button 
                v-if="item.i.startsWith('ai_chart_')"
                type="danger" 
                circle 
                size="small" 
                class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                @click="removeChartFromDashboard(item.i)"
              >
                <el-icon><Close /></el-icon>
              </el-button>
              
              <!-- Core Charts -->
              <template v-if="item.i === 'countryChart'">
                <div class="flex justify-between items-center mb-2 drag-handle cursor-move select-none">
                  <h3 class="text-lg font-medium flex items-center gap-2">
                    <span 
                      class="transition-colors"
                      :class="drilledCountry ? 'text-slate-500 hover:text-neon-blue cursor-pointer' : 'text-slate-800 dark:text-slate-200'"
                      @click="drilledCountry ? resetDrillDown() : null"
                      :title="drilledCountry ? '点击返回上一级' : ''"
                    >
                      {{ t('chartCountry') }}
                    </span>
                    
                    <template v-if="drilledCountry">
                      <span class="text-slate-400">/</span>
                      <span class="text-neon-blue drop-shadow-[0_0_5px_rgba(0,243,255,0.5)] flex items-center gap-1.5 text-sm">
                        <span class="w-1.5 h-1.5 rounded-full bg-neon-blue animate-pulse"></span>
                        {{ t(drilledCountry) }} 头部企业巨头
                      </span>
                    </template>

                    <span v-if="!drilledCountry" class="text-sm text-slate-500 ml-2 font-normal hidden sm:inline-block">{{ t('clickToDrill') }}</span>
                  </h3>
                </div>
                <div class="flex-1 w-full relative echarts-container">
                  <v-chart ref="countryChartRef" v-if="Object.keys(countryChartOptions).length > 0" class="absolute inset-0 cursor-pointer" :option="countryChartOptions" :update-options="{ notMerge: true }" autoresize @click="handleCountryChartClick" @zr:click="handleZrClick" />
                  <div v-else class="absolute inset-0 flex items-center justify-center text-slate-400">{{ t('loadingChart') }}</div>
                </div>
              </template>
              
              <template v-else-if="item.i === 'industryChart'">
                <h3 class="text-lg font-medium text-slate-800 dark:text-slate-200 mb-2 drag-handle cursor-move select-none">
                  {{ t('chartIndustry') }}
                  <span class="text-sm text-slate-500 ml-2 font-normal hidden sm:inline-block">{{ t('clickToDrillIndustry') }}</span>
                </h3>
                <div class="flex-1 w-full relative echarts-container">
                  <v-chart v-if="Object.keys(industryChartOptions).length > 0" class="absolute inset-0 cursor-pointer" :option="industryChartOptions" autoresize @click="handleIndustryChartClick" />
                  <div v-else class="absolute inset-0 flex items-center justify-center">
                    <div class="cyber-loader"></div>
                  </div>
                </div>
              </template>

              <template v-else-if="item.i === 'topCompaniesChart'">
                <h3 class="text-lg font-medium text-slate-800 dark:text-slate-200 mb-2 drag-handle cursor-move select-none">{{ t('chartTopCompanies') }}</h3>
                <div class="flex-1 w-full relative echarts-container">
                  <v-chart v-if="Object.keys(topCompaniesChartOptions).length > 0" class="absolute inset-0" :option="topCompaniesChartOptions" autoresize />
                  <div v-else class="absolute inset-0 flex items-center justify-center">
                    <div class="cyber-loader"></div>
                  </div>
                </div>
              </template>

              <template v-else-if="item.i === 'dataTable'">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 drag-handle cursor-move select-none">
                  <h3 class="text-lg font-medium text-slate-800 dark:text-slate-200">{{ t('dataTableTitle') }}</h3>
                  <el-input
                    v-model="tableSearchQuery"
                    placeholder="输入企业、行业或国家搜索..."
                    clearable
                    size="small"
                    class="max-w-[260px] !rounded-lg border-none"
                    style="width: 100%"
                  >
                    <template #prefix>
                      <el-icon><Search /></el-icon>
                    </template>
                  </el-input>
                </div>
                <div class="flex-1 w-full overflow-hidden relative">
                  <el-table 
                    :data="filteredTableData" 
                    border 
                    :span-method="tableSpanMethod" 
                    style="width: 100%; height: 100%; position: absolute; inset: 0;" 
                    :header-cell-style="{ background: isDark ? 'rgba(30,41,59,0.5)' : '#f8fafc', color: isDark ? '#cbd5e1' : '#475569', borderBottom: isDark ? '1px solid #334155' : '' }" 
                    :row-style="{ background: 'transparent' }" 
                    @row-click="handleRowClick"
                    class="!bg-transparent dark:!bg-transparent custom-dark-table clickable-rows"
                  >
                    <el-table-column prop="country" :label="t('filterCountry')" align="center">
                      <template #default="scope">
                        <span class="font-bold text-slate-800 dark:text-slate-200">{{ t(scope.row.country) }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="industry" :label="t('filterIndustry')" align="center">
                      <template #default="scope">
                        <span class="text-blue-600 dark:text-blue-400 font-medium">{{ t(scope.row.industry) }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="name" :label="t('companyName')" align="center">
                      <template #default="scope"><span class="font-bold text-slate-800 dark:text-slate-200">{{ t(scope.row.name) }}</span></template>
                    </el-table-column>
                    <el-table-column prop="marketCap" :label="t('totalMarketCap')" align="center">
                      <template #default="scope">
                        <div class="relative w-full h-full py-1.5 flex items-center justify-center">
                          <div 
                            class="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-neon-blue/20 to-neon-blue/5 rounded-r transition-all duration-500"
                            :style="{ width: ((scope.row.marketCap / maxMarketCap) * 100) + '%' }"
                          ></div>
                          <span class="relative z-10 font-mono font-medium text-slate-800 dark:text-slate-200">${{ scope.row.marketCap }}B</span>
                        </div>
                      </template>
                    </el-table-column>
                    <el-table-column prop="revenue" :label="t('avgRevenue')" align="center">
                      <template #default="scope">
                        <div class="relative w-full h-full py-1.5 flex items-center justify-center">
                          <div 
                            class="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-neon-purple/20 to-neon-purple/5 rounded-r transition-all duration-500"
                            :style="{ width: ((scope.row.revenue / maxRevenue) * 100) + '%' }"
                          ></div>
                          <span class="relative z-10 font-mono font-medium text-slate-800 dark:text-slate-200">${{ scope.row.revenue }}B</span>
                        </div>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </template>
              
              <!-- AI Generated Custom Charts -->
              <template v-else>
                <h3 class="text-lg font-medium text-slate-800 dark:text-slate-200 mb-2 drag-handle cursor-move select-none">{{ getCustomChart(item.i)?.title || '自定义图表' }}</h3>
                <div class="flex-1 w-full relative echarts-container">
                  <v-chart v-if="getCustomChart(item.i)" class="absolute inset-0" :option="getCustomChart(item.i)?.options" autoresize />
                  <div v-else class="absolute inset-0 flex items-center justify-center">
                    <div class="cyber-loader"></div>
                  </div>
                </div>
              </template>
            </GridItem>
          </GridLayout>
        </div>
      </div>
    </main>

    <!-- AI Drawer -->
    <el-drawer
      v-model="showAiPanel"
      :title="t('aiDrawerTitle')"
      direction="rtl"
      size="450px"
      class="!bg-slate-50 dark:!bg-dark-900/95 !backdrop-blur-2xl"
    >
      <div class="flex flex-col h-full -mx-4 -mb-4">
        <div class="flex-1 overflow-y-auto p-6 space-y-4" ref="chatBody">
          <div v-if="chatHistory.length === 0" class="text-center text-slate-400 mt-10">
            <el-icon size="48" class="mb-4 text-neon-purple"><ChatDotRound /></el-icon>
            <p class="text-slate-800 dark:text-slate-200 font-bold mb-2">{{ t('aiEmptyText1') }}</p>
            <p class="text-sm opacity-80">{{ t('aiEmptyText2') }}</p>
            <div class="mt-4 p-4 rounded-xl bg-primary-500/10 text-left text-sm cursor-pointer hover:bg-primary-500/20 transition-colors" @click="chatInput='帮我生成一个各行业平均市值的柱状图'; sendChatMessage()">
              "帮我生成一个各行业平均市值的柱状图"
            </div>
          </div>
          
          <div v-for="(msg, index) in chatHistory" :key="index" class="flex flex-col" :class="msg.role === 'user' ? 'items-end' : 'items-start'">
            <div class="text-xs text-slate-400 mb-1 ml-1">{{ msg.role === 'user' ? t('you') : t('ai') }}</div>
            <div class="max-w-[90%] rounded-2xl px-4 py-3"
                 :class="msg.role === 'user' 
                  ? 'bg-gradient-to-br from-primary-500 to-neon-purple text-white rounded-tr-sm shadow-md' 
                  : 'bg-white/60 dark:bg-dark-800/60 backdrop-blur-md text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/10 rounded-tl-sm shadow-xl'">
              
              <div v-if="msg.content">
                <template v-for="(part, pIndex) in parseMessageContent(msg.content)" :key="pIndex">
                  <div v-if="part.type === 'text'" class="prose prose-sm dark:prose-invert break-words" v-html="part.content"></div>
                  <div v-else-if="part.type === 'chart'" class="mt-4 p-4 rounded-xl bg-slate-100/50 dark:bg-dark-900/50 border border-slate-200 dark:border-slate-700">
                    <h4 class="font-bold text-sm mb-2 text-neon-blue flex items-center gap-2">
                      <el-icon><TrendCharts /></el-icon> {{ part.title }}
                    </h4>
                    <div class="h-48 w-full relative mb-3 bg-white dark:bg-dark-800 rounded-lg p-2">
                       <v-chart class="absolute inset-0" :option="part.options" autoresize />
                    </div>
                    <el-button size="small" type="primary" plain class="w-full !border-neon-blue !text-neon-blue hover:!bg-neon-blue/10" @click="addChartToDashboard(part)">
                       <el-icon class="mr-1"><Opportunity /></el-icon> 设为仪表盘卡片
                    </el-button>
                  </div>
                </template>
              </div>
              
              <div v-else-if="isAiTyping && index === chatHistory.length - 1" class="flex gap-1 items-center h-5">
                <div class="w-1.5 h-1.5 bg-neon-purple rounded-full animate-bounce"></div>
                <div class="w-1.5 h-1.5 bg-neon-purple rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                <div class="w-1.5 h-1.5 bg-neon-purple rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Quick Prompts -->
        <div class="px-6 pb-2" v-if="chatHistory.length > 0 && !isAiTyping">
          <div class="flex flex-wrap gap-2">
            <div v-for="qp in quickPrompts" :key="qp" 
                 class="px-3 py-1.5 rounded-full border border-neon-blue/30 bg-neon-blue/5 text-neon-blue text-xs font-medium cursor-pointer hover:bg-neon-blue/20 hover:shadow-[0_0_10px_rgba(0,243,255,0.3)] transition-all whitespace-nowrap"
                 @click="useQuickPrompt(qp)">
              ✨ {{ qp }}
            </div>
          </div>
        </div>
        
        <div class="p-4 bg-white/80 dark:bg-dark-800/80 backdrop-blur-md border-t border-slate-100 dark:border-white/10">
          <el-input
            v-model="chatInput"
            :placeholder="t('inputPlaceholder')"
            @keyup.enter="sendChatMessage"
            :disabled="isAiTyping"
            class="!rounded-xl"
          >
            <template #append>
              <el-button @click="sendChatMessage" :disabled="!chatInput.trim() || isAiTyping" type="primary">
                发送
              </el-button>
            </template>
          </el-input>
        </div>
      </div>
    </el-drawer>

    <!-- Deep Analysis Dialog component -->
    <DeepAnalysisDialog
      v-model:visible="showAnalysisDialog"
      :country="selectedCountryForAnalysis"
      :industry="selectedIndustryForAnalysis"
      :is-dark="isDark"
    />

    <!-- AI Diagnose Dialog -->
    <el-dialog
      v-model="showDiagnoseDialog"
      width="450px"
      custom-class="cyber-dialog"
      destroy-on-close
      append-to-body
    >
      <template #header>
        <div class="flex items-center gap-2">
          <el-icon class="text-neon-purple animate-pulse"><Opportunity /></el-icon>
          <span class="font-bold text-slate-100 tracking-wider">AI 商业竞争力扫描</span>
        </div>
      </template>

      <div v-if="diagnoseLoading" class="py-8 flex flex-col items-center justify-center gap-4">
        <div class="cyber-loader"></div>
        <div class="text-sm font-mono text-neon-blue animate-pulse">正在扫描核心竞争力指标数据...</div>
      </div>
      <div v-else class="text-left font-sans space-y-4">
        <div class="flex justify-between items-center border-b border-white/10 pb-2">
          <span class="text-lg font-bold text-slate-200">{{ t(selectedCompany?.name) }}</span>
          <span class="text-xs bg-slate-800 text-neon-blue border border-neon-blue/30 px-2 py-0.5 rounded-full font-mono">
            {{ t(selectedCompany?.industry) }}
          </span>
        </div>
        
        <div class="grid grid-cols-2 gap-3 text-sm border-b border-white/10 pb-3">
          <div class="bg-white/5 p-2 rounded border border-white/5">
            <div class="text-xs text-slate-400">总市值</div>
            <div class="text-base font-mono font-bold text-slate-200">${{ selectedCompany?.marketCap }}B</div>
          </div>
          <div class="bg-white/5 p-2 rounded border border-white/5">
            <div class="text-xs text-slate-400">平均营收</div>
            <div class="text-base font-mono font-bold text-slate-200">${{ selectedCompany?.revenue }}B</div>
          </div>
        </div>

        <div class="text-sm text-slate-300 leading-relaxed bg-primary-500/5 p-4 rounded-xl border border-primary-500/10">
          <div class="text-xs font-mono text-neon-purple mb-1.5">🚀 AI 诊断意见：</div>
          <p class="whitespace-pre-line">{{ diagnoseResult }}</p>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
/* Force grid-layout-plus to take full height inside grid items */
:deep(.vgl-item__inner) {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Table click row styles */
:deep(.clickable-rows tbody tr) {
  transition: background-color 0.2s;
}
:deep(.clickable-rows tbody tr:hover > td) {
  background-color: rgba(56, 189, 248, 0.08) !important;
}
</style>
