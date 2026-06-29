const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const OpenAI = require('openai');
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');

// Polyfill for fetch and FormData (required by openai in Node < 18)
if (!globalThis.fetch) {
  const nodeFetch = require('node-fetch');
  globalThis.fetch = nodeFetch;
  globalThis.Headers = nodeFetch.Headers;
  globalThis.Request = nodeFetch.Request;
  globalThis.Response = nodeFetch.Response;
}
if (!globalThis.FormData) {
  const { FormData } = require('formdata-node');
  globalThis.FormData = FormData;
}

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.post('/log-error', (req, res) => {
  console.log("BROWSER ERROR REPORTED:", req.body);
  res.send('ok');
});

// Emit mock real-time data
setInterval(() => {
  const mockRealtimeData = {
    activeUsers: Math.floor(Math.random() * 500) + 100,
    serverLoad: Math.floor(Math.random() * 40) + 20,
    transactions: Math.floor(Math.random() * 1000) + 5000,
    timestamp: new Date().toISOString(),
    fluctuations: {
      'USA': (Math.random() * 0.02 - 0.01),
      'China': (Math.random() * 0.02 - 0.01),
      'Japan': (Math.random() * 0.04 - 0.02),
      'Germany': (Math.random() * 0.04 - 0.02),
      'UK': (Math.random() * 0.04 - 0.02),
      'Saudi Arabia': (Math.random() * 0.01 - 0.005)
    }
  };
  io.emit('realtime_update', mockRealtimeData);
}, 3000);

const port = process.env.PORT || 3000;

// Initialize DeepSeek OpenAI client
const openai = new OpenAI({
  baseURL: process.env.AI_BASE_URL || 'https://api.deepseek.com/v1',
  apiKey: process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || 'sk-mock-key' // Default mock key
});

let db;

async function initDb() {
  db = await open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver: sqlite3.Database
  });
}
initDb();

// --- KPI APIs ---

function buildWhereClause(query) {
  const conditions = [];
  const params = [];
  if (query.industry) { conditions.push('industry = ?'); params.push(query.industry); }
  if (query.country) { conditions.push('country = ?'); params.push(query.country); }
  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  return { where, params };
}

app.get('/api/kpi/filters', async (req, res) => {
  try {
    const industries = await db.all('SELECT DISTINCT industry as value, industry as label FROM companies ORDER BY industry');
    const countries = await db.all('SELECT DISTINCT country as value, country as label FROM companies ORDER BY country');
    
    res.json({ industries, countries });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/kpi/summary', async (req, res) => {
  try {
    const { where, params } = buildWhereClause(req.query);
    const totalCompanies = await db.get(`SELECT COUNT(*) as total FROM companies ${where}`, ...params);
    const totalMarketCap = await db.get(`SELECT SUM(marketCap) as marketCap FROM companies ${where}`, ...params);
    const avgRevenue = await db.get(`SELECT AVG(revenue) as revenue FROM companies ${where}`, ...params);
    const totalCountries = await db.get(`SELECT COUNT(DISTINCT country) as countries FROM companies ${where}`, ...params);
    
    res.json({
      total: totalCompanies?.total || 0,
      marketCap: totalMarketCap?.marketCap || 0,
      avgRevenue: avgRevenue?.revenue || 0,
      countries: totalCountries?.countries || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/kpi/distributions', async (req, res) => {
  try {
    const { where, params } = buildWhereClause(req.query);
    const industries = await db.all(`SELECT industry as name, COUNT(*) as count FROM companies ${where} GROUP BY industry ORDER BY count DESC`, ...params);
    const countries = await db.all(`SELECT country as name, SUM(marketCap) as count FROM companies ${where} GROUP BY country ORDER BY count DESC`, ...params);
    const topCompanies = await db.all(`SELECT name, marketCap as count FROM companies ${where} ORDER BY marketCap DESC LIMIT 15`, ...params);
    res.json({ industries, countries, topCompanies });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/kpi/companies', async (req, res) => {
  try {
    const { where, params } = buildWhereClause(req.query);
    const companies = await db.all(`SELECT * FROM companies ${where}`, ...params);
    res.json(companies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/kpi/deep-analysis', async (req, res) => {
  try {
    const { country, industry } = req.query;
    
    // Build filter
    const conditions = [];
    const params = [];
    if (country) { conditions.push('country = ?'); params.push(country); }
    if (industry) { conditions.push('industry = ?'); params.push(industry); }
    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    
    // Fetch target companies
    const companies = await db.all(`SELECT * FROM companies ${where} ORDER BY marketCap DESC LIMIT 30`, ...params);
    
    if (companies.length === 0) {
      return res.json({ trend: [], sankey: { nodes: [], links: [] }, scatter: [], sunburst: {} });
    }

    // 1. Trend Data (5 years: 2021-2025)
    const years = [2021, 2022, 2023, 2024, 2025];
    const trend = years.map((year) => {
      const mult = Math.pow(0.9, 2025 - year); 
      const noise = 1 + (Math.sin(year) * 0.02);
      
      let totalRevenue = 0;
      let totalMarketCap = 0;
      companies.forEach(c => {
        totalRevenue += c.revenue * mult * noise;
        totalMarketCap += c.marketCap * mult * noise;
      });

      return {
        year,
        revenue: Math.round(totalRevenue * 100) / 100,
        marketCap: Math.round(totalMarketCap * 100) / 100
      };
    });

    // 2. Sankey Data
    const nodesMap = new Set();
    const links = [];

    companies.forEach(c => {
      if (c.country) nodesMap.add(c.country);
      if (c.industry) nodesMap.add(c.industry);
      if (c.name) nodesMap.add(c.name);
    });

    const countryIndustryMap = {};
    const industryCompanyMap = {};

    companies.forEach(c => {
      if (c.country && c.industry) {
        const ciKey = `${c.country} -> ${c.industry}`;
        countryIndustryMap[ciKey] = (countryIndustryMap[ciKey] || 0) + c.revenue;
      }
      if (c.industry && c.name) {
        const icKey = `${c.industry} -> ${c.name}`;
        industryCompanyMap[icKey] = c.revenue;
      }
    });

    Object.keys(countryIndustryMap).forEach(key => {
      const [source, target] = key.split(' -> ');
      links.push({ source, target, value: Math.round(countryIndustryMap[key] * 100) / 100 });
    });

    Object.keys(industryCompanyMap).forEach(key => {
      const [source, target] = key.split(' -> ');
      links.push({ source, target, value: Math.round(industryCompanyMap[key] * 100) / 100 });
    });

    const nodes = Array.from(nodesMap).map(name => ({ name }));

    // 3. Scatter Data (Multi-dimensional)
    const scatter = companies.map(c => [
      c.revenue, 
      c.marketCap, 
      c.name, 
      c.industry
    ]);

    // 4. Sunburst Data
    const rootName = country || industry || 'Global';
    const countryGroups = {};
    companies.forEach(c => {
      if (!countryGroups[c.country]) {
        countryGroups[c.country] = {};
      }
      if (!countryGroups[c.country][c.industry]) {
        countryGroups[c.country][c.industry] = [];
      }
      countryGroups[c.country][c.industry].push({
        name: c.name,
        value: c.marketCap
      });
    });

    const sunburstChildren = Object.keys(countryGroups).map(cName => {
      const indGroups = countryGroups[cName];
      const indChildren = Object.keys(indGroups).map(iName => {
        return {
          name: iName,
          children: indGroups[iName]
        };
      });
      return {
        name: cName,
        children: indChildren
      };
    });

    const sunburst = {
      name: rootName,
      children: sunburstChildren
    };

    res.json({ trend, sankey: { nodes, links }, scatter, sunburst });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- AI Endpoints ---

app.post('/api/ai/chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages array' });
  }

  // Prepend system prompt
  const systemMessage = {
    role: 'system',
    content: `你是一个商业数据分析助手。
数据表：companies (id, name, industry, country, revenue, marketCap)

请基于提问进行专业分析。
如果你需要展示图表，请在回复末尾附上 ECharts Option 的 JSON 数据，用 \`\`\`json 包裹。
示例：
\`\`\`json
{
  "type": "chart",
  "title": "图表标题",
  "options": {
    "tooltip": {},
    "xAxis": { "type": "category", "data": ["A", "B"] },
    "yAxis": { "type": "value" },
    "series": [{ "type": "bar", "data": [10, 20] }]
  }
}
\`\`\`
注意：JSON 必须绝对合法，不要包含注释。`
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 45000); // 45 seconds max timeout

    let currentMessages = [systemMessage, ...messages];
    let maxIterations = 3;
    const tools = [{
      type: "function",
      function: {
        name: "execute_sql",
        description: "Execute a SQL SELECT query on the companies table (id, name, industry, country, revenue, marketCap)",
        parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
      }
    }];

    while (maxIterations > 0) {
      const response = await openai.chat.completions.create({
        model: process.env.AI_MODEL || 'deepseek-chat',
        messages: currentMessages,
        tools: tools,
        tool_choice: "auto",
        temperature: 0.1,
      });

      const message = response.choices[0].message;

      if (message.tool_calls && message.tool_calls.length > 0) {
        currentMessages.push(message);
        for (const toolCall of message.tool_calls) {
          if (toolCall.function.name === 'execute_sql') {
             let sqlResult = "";
             try {
               const args = JSON.parse(toolCall.function.arguments);
               let query = args.query;
               if (!query.toUpperCase().includes('SELECT') || query.toUpperCase().includes('UPDATE') || query.toUpperCase().includes('DELETE') || query.toUpperCase().includes('DROP')) {
                   sqlResult = "ERROR: Only SELECT queries are allowed for safety.";
               } else {
                   const rows = await db.all(query);
                   sqlResult = JSON.stringify(rows);
               }
             } catch (e) {
                 sqlResult = "ERROR: " + e.message;
             }
             currentMessages.push({
               role: 'tool',
               tool_call_id: toolCall.id,
               content: sqlResult
             });
          }
        }
        maxIterations--;
      } else {
        // No more tools, break and prepare for streaming
        break;
      }
    }

    const stream = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'deepseek-chat',
      messages: currentMessages,
      stream: true,
      temperature: 0.1,
      max_tokens: 1500
    }, { signal: controller.signal });

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let totalTokens = 0;
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
        totalTokens++;
        if (totalTokens > 1500) {
          controller.abort();
          break;
        }
      }
    }
    clearTimeout(timeout);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('OpenAI Error:', error);
    // Return a mock stream response if API key is invalid (for local dev without real key)
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    const mockResponse = "这是一个来自AI助手的模拟回复。由于您当前尚未配置真实的 DeepSeek API Key，无法调用真实模型。要启用真实对话，请在 backend 目录下的 .env 文件中设置 DEEPSEEK_API_KEY。";
    res.write(`data: ${JSON.stringify({ text: mockResponse })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

app.post('/api/ai/diagnose', async (req, res) => {
  const { name, industry, country, marketCap, revenue } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Company name is required' });
  }

  const prompt = `分析公司名为 "${name}"，属于 ${industry || '未知'} 行业，国家为 ${country || '未知'}，市值为 $${marketCap || '未知'}B，年营收为 $${revenue || '未知'}B 的企业。请用大约 100 字，言简意赅地总结其商业模式、核心竞争优势，并给出一个综合竞争力评级（如 A+++、AA、A 等）。输出语言为中文。`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一个顶尖的商业咨询专家和数据分析师。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.6,
      max_tokens: 300
    });

    const result = response.choices[0].message.content;
    res.json({ diagnosis: result });
  } catch (error) {
    console.error('AI Diagnose Error:', error);
    const mockRating = marketCap > 500 ? 'A+++' : (marketCap > 100 ? 'AA' : 'A');
    const mockText = `${name} 是一家位于 ${country} 的 ${industry} 巨头企业。其凭借庞大的市场规模与卓越的品牌影响力，在行业中处于主导地位。该公司市值为 $${marketCap}B，年营收为 $${revenue}B，拥有强劲的现金流与技术壁垒，商业模式高度可持续。综合竞争力评级为 [${mockRating}]。`;
    res.json({ diagnosis: mockText });
  }
});

server.listen(port, () => {
  console.log(`Backend server is running on http://localhost:${port}`);
});
