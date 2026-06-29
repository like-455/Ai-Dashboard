# AI 驱动的科技与商业大屏仪表盘 (Ai-Dashboard)

一个基于 Vue 3 + TypeScript + Vite 和 Express + SQLite 开发的赛博朋克风智能大屏数据仪表盘，集成了 DeepSeek AI 数据助理与竞争力诊断功能。

🌐 **在线预览地址**: [https://like-455.github.io/Ai-Dashboard/](https://like-455.github.io/Ai-Dashboard/)  
*(注：在线预览为静态前端展示，AI 诊断与对话等动态分析功能需要运行本地后端服务)*

---

## 🚀 项目亮点

- **赛博朋克科幻视觉**：精心设计的暗黑/明亮双主题、霓虹渐变与柔和的玻璃拟态板式。
- **3D 沉浸式地球背景**：采用 ECharts GL 绘制的 3D 地球背景，随数据展示自适应贴合与定位。
- **深度数据穿透下钻**：点击图表柱条时，触发包含“趋势预测”、“桑基资金流向”、“多维对比散点”和“多层同心旭日图”四合一深度穿透分析面板。
- **AI 竞争力诊断**：数据明细表格支持智能模糊搜索并动态重绘合并单元格，点击任意企业行即可调取 AI 对其商业模式与核心壁垒进行现场诊断与评级。
- **DeepSeek 智能助理**：内置悬浮 AI 聊天助手，支持直接通过对话命令自动在大屏上绘制并生成自定义图表。

---

## 🛠️ 技术栈

### 前端 (Frontend)
- **核心框架**：Vue 3 (Composition API) + TypeScript + Vite
- **图表库**：ECharts 5.x + ECharts-GL (3D 渲染)
- **UI 组件**：Element Plus (赛博风定制) + `@element-plus/icons-vue`
- **样式方案**：Tailwind CSS (Vanilla CSS & 渐变微动画定制)
- **网格拖拽**：Grid Layout Plus (支持大屏布局自由排版)
- **其他库**：html2canvas (支持超清长图快照导出)、Socket.io-client (实时数据联动)

### 后端 (Backend)
- **Web 服务**：Node.js + Express
- **数据库**：SQLite 3
- **模型集成**：DeepSeek API / OpenAI SDK
- **实时通信**：Socket.io (向前端广播服务负载与模拟波动数据)

---

## 📦 本地快速开始

### 1. 克隆项目
```bash
git clone https://github.com/like-455/Ai-Dashboard.git
cd Ai-Dashboard
```

### 2. 配置后端 (Backend)
1. 进入 backend 目录，安装依赖：
   ```bash
   cd backend
   npm install
   ```
2. 配置环境变量：在 `backend` 目录下创建 `.env` 文件，写入您的密钥与 API 配置：
   ```env
   PORT=3000
   AI_API_KEY=您的_DEEPSEEK_或_OPENAI_API_KEY
   AI_BASE_URL=https://api.deepseek.com/v1 # 或者您的代理中转地址
   AI_MODEL=deepseek-chat
   ```
3. 运行本地数据库初始化与数据导入：
   ```bash
   node setupDb.js
   node importData.js
   ```
4. 启动服务：
   ```bash
   node index.js
   ```

### 3. 配置前端 (Frontend)
1. 进入 frontend 目录，安装依赖：
   ```bash
   cd ../frontend
   npm install
   ```
2. 启动开发服务器：
   ```bash
   npm run dev
   ```
3. 在浏览器打开终端输出的地址（默认是 [http://localhost:5173/](http://localhost:5173/)）。

---

## 📷 功能快照

*(可以在此放置导出的超清大屏快照截图)*
- 3D 地球炫酷背景氛围
- AI 智能聊天绘图对话框
- 四合一下钻深度分析弹窗 (Sankey / Sunburst / Scatter)
- 带有霓虹进度条与 AI 诊断的交互表格
