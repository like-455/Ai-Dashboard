import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { createPinia } from 'pinia'
import i18n from './i18n'

// ECharts setup
import ECharts from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart, PieChart, ScatterChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent } from 'echarts/components'

use([
  CanvasRenderer,
  LineChart,
  BarChart,
  PieChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent
])

window.addEventListener('error', (e) => {
  fetch('http://localhost:3000/log-error', { 
    method: 'POST', 
    body: JSON.stringify({ error: e.message, filename: e.filename, lineno: e.lineno, colno: e.colno }), 
    headers: {'Content-Type':'application/json'} 
  }).catch(() => {});
});
window.addEventListener('unhandledrejection', (e) => {
  fetch('http://localhost:3000/log-error', { 
    method: 'POST', 
    body: JSON.stringify({ error: e.reason?.message || String(e.reason) }), 
    headers: {'Content-Type':'application/json'} 
  }).catch(() => {});
});

const app = createApp(App)

app.use(createPinia())
app.use(i18n)
app.use(ElementPlus)

// Register Element Plus Icons
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.component('v-chart', ECharts)

app.mount('#app')
