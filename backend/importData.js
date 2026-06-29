const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

const companiesData = [
  { name: 'Apple', industry: 'Technology', country: 'United States', revenue: 383, marketCap: 3000 },
  { name: 'Microsoft', industry: 'Technology', country: 'United States', revenue: 211, marketCap: 2900 },
  { name: 'Saudi Aramco', industry: 'Energy', country: 'Saudi Arabia', revenue: 604, marketCap: 2100 },
  { name: 'Alphabet (Google)', industry: 'Technology', country: 'United States', revenue: 282, marketCap: 1700 },
  { name: 'Amazon', industry: 'Retail', country: 'United States', revenue: 513, marketCap: 1500 },
  { name: 'NVIDIA', industry: 'Technology', country: 'United States', revenue: 26, marketCap: 1200 },
  { name: 'Meta Platforms', industry: 'Technology', country: 'United States', revenue: 116, marketCap: 800 },
  { name: 'Berkshire Hathaway', industry: 'Finance', country: 'United States', revenue: 302, marketCap: 780 },
  { name: 'Tesla', industry: 'Automotive', country: 'United States', revenue: 81, marketCap: 700 },
  { name: 'Tencent', industry: 'Technology', country: 'China', revenue: 85, marketCap: 400 },
  { name: 'TSMC', industry: 'Technology', country: 'Taiwan', revenue: 75, marketCap: 450 },
  { name: 'Alibaba', industry: 'Retail', country: 'China', revenue: 126, marketCap: 200 },
  { name: 'Samsung Electronics', industry: 'Technology', country: 'South Korea', revenue: 200, marketCap: 350 },
  { name: 'LVMH', industry: 'Luxury', country: 'France', revenue: 86, marketCap: 400 },
  { name: 'JPMorgan Chase', industry: 'Finance', country: 'United States', revenue: 128, marketCap: 450 },
  { name: 'Johnson & Johnson', industry: 'Healthcare', country: 'United States', revenue: 94, marketCap: 380 },
  { name: 'Visa', industry: 'Finance', country: 'United States', revenue: 29, marketCap: 500 },
  { name: 'Walmart', industry: 'Retail', country: 'United States', revenue: 611, marketCap: 420 },
  { name: 'ExxonMobil', industry: 'Energy', country: 'United States', revenue: 413, marketCap: 400 },
  { name: 'Toyota', industry: 'Automotive', country: 'Japan', revenue: 275, marketCap: 250 },
  { name: 'Procter & Gamble', industry: 'Consumer Goods', country: 'United States', revenue: 80, marketCap: 350 },
  { name: 'Nestle', industry: 'Consumer Goods', country: 'Switzerland', revenue: 102, marketCap: 300 },
  { name: 'Roche', industry: 'Healthcare', country: 'Switzerland', revenue: 68, marketCap: 250 },
  { name: 'Chevron', industry: 'Energy', country: 'United States', revenue: 246, marketCap: 280 },
  { name: 'ASML', industry: 'Technology', country: 'Netherlands', revenue: 22, marketCap: 280 },
  { name: 'Novo Nordisk', industry: 'Healthcare', country: 'Denmark', revenue: 25, marketCap: 400 },
  { name: 'Broadcom', industry: 'Technology', country: 'United States', revenue: 33, marketCap: 350 },
  { name: 'Oracle', industry: 'Technology', country: 'United States', revenue: 50, marketCap: 300 },
  { name: 'PepsiCo', industry: 'Consumer Goods', country: 'United States', revenue: 86, marketCap: 230 },
  { name: 'Coca-Cola', industry: 'Consumer Goods', country: 'United States', revenue: 43, marketCap: 250 },
  { name: 'Sony', industry: 'Technology', country: 'Japan', revenue: 85, marketCap: 100 },
  { name: 'BHP Group', industry: 'Mining', country: 'Australia', revenue: 53, marketCap: 150 },
  { name: 'Reliance Industries', industry: 'Conglomerate', country: 'India', revenue: 108, marketCap: 200 },
  { name: 'AstraZeneca', industry: 'Healthcare', country: 'United Kingdom', revenue: 44, marketCap: 200 },
  { name: 'Novartis', industry: 'Healthcare', country: 'Switzerland', revenue: 50, marketCap: 200 },
  { name: 'Shell', industry: 'Energy', country: 'United Kingdom', revenue: 381, marketCap: 200 },
  { name: 'SAP', industry: 'Technology', country: 'Germany', revenue: 33, marketCap: 150 },
  { name: 'TotalEnergies', industry: 'Energy', country: 'France', revenue: 280, marketCap: 150 },
  { name: 'HSBC', industry: 'Finance', country: 'United Kingdom', revenue: 51, marketCap: 150 },
  { name: 'Unilever', industry: 'Consumer Goods', country: 'United Kingdom', revenue: 65, marketCap: 130 }
];

async function setup() {
  const db = await open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver: sqlite3.Database
  });

  console.log('Database connected.');

  // Drop old tables
  await db.exec(`DROP TABLE IF EXISTS programs;`);
  await db.exec(`DROP TABLE IF EXISTS countries;`);
  await db.exec(`DROP TABLE IF EXISTS companies;`);
  
  // Create companies table
  await db.exec(`
    CREATE TABLE companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      industry TEXT,
      country TEXT,
      revenue REAL,
      marketCap REAL
    );
  `);

  console.log('Table companies created.');

  try {
    const stmt = await db.prepare('INSERT INTO companies (name, industry, country, revenue, marketCap) VALUES (?, ?, ?, ?, ?)');
    
    for (const company of companiesData) {
      await stmt.run(company.name, company.industry, company.country, company.revenue, company.marketCap);
    }

    await stmt.finalize();
    console.log(`Successfully inserted ${companiesData.length} companies into database.`);
    
  } catch (error) {
    console.error('Error inserting data:', error.message);
  }

  await db.close();
}

setup().catch(err => {
  console.error('Error setting up DB:', err);
});
